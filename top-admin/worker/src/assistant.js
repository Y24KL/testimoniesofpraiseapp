/**
 * T.O.P AI Assistant: DeepSeek chat with three allow-listed tools. The model never touches the database
 * directly. Testimony search runs with the signed-in user's own Firebase token (so Firestore rules still
 * apply), web search reuses the existing DeepSeek search, and screen navigation is returned to the app as a
 * value the app checks against its own list.
 */
import { AIEndpointError, deepSeekSearch, enforceAiRateLimit, semanticSearch } from './ai.js';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 1000;
const MAX_TOOL_ROUNDS = 4;
const MAX_WEB_SEARCHES = 2;
const MAX_REPLY_CHARS = 2000;

/** Screens the assistant may point people to. The app repeats this list and refuses anything else. */
export const ASSISTANT_SCREENS = ['live', 'radio', 'adotopoc', 'written', 'testimonies', 'sponsor', 'downloads'];

const SYSTEM_PROMPT = `You are the T.O.P AI Assistant for the Testimonies of Praise app and website.
Help people use the app, find testimonies, and answer general questions. Be warm, brief and accurate.

What the app offers (use these exact names when you refer to them):
- "Click to watch Live": our live broadcasts, with live chat when we are on air.
- "T.O.P on Loveworld Radio": our 24/7 audio stream (Listen tab).
- "ADOTOPOC Resource Center": resources for hosting outreaches and crusades.
- "Read Testimonies": written testimonies people can read in full and comment on.
- "Watch powerful Testimonies": the video testimony archive (Testimonies tab).
- "Sponsor Testimonies of Praise show": how to support the show.
- Downloads: testimonies saved for offline viewing.

Rules:
- For testimonies in the app, use search_testimonies and mention only testimonies it returned.
- For general or current questions, use search_web. Report what the web sources say and name the source titles. Never claim a source says something it does not, and never make up links.
- Use open_screen only when the person asks to go somewhere; name the screen in your reply.
- If a tool fails or returns nothing, say so plainly. Do not guess.
- If you do not know something, say so. Never invent prices, bank details, phone numbers, links, dates or statistics.
- Never ask for or repeat passwords, codes or personal details.
- Keep answers short: a few sentences.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_testimonies',
      description: 'Search published testimonies in the app by meaning. Returns titles and short descriptions.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'What the person is looking for, in a few words.' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the public web for general or current information. Returns titles, links and short snippets.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'The question to look up, in a few words.' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_screen',
      description: 'Suggest opening one of the app screens.',
      parameters: {
        type: 'object',
        properties: { screen: { type: 'string', enum: ASSISTANT_SCREENS } },
        required: ['screen'],
      },
    },
  },
];

/** Checks the chat history sent by the app. Only user and assistant turns are accepted. */
export function validateMessages(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AIEndpointError(400, 'invalid_messages', 'Send your question to the assistant.');
  }
  const recent = value.slice(-MAX_MESSAGES);
  return recent.map((item) => {
    if (!item || typeof item !== 'object' || (item.role !== 'user' && item.role !== 'assistant')) {
      throw new AIEndpointError(400, 'invalid_messages', 'The conversation could not be read. Please start a new chat.');
    }
    if (typeof item.content !== 'string' || !item.content.trim()) {
      throw new AIEndpointError(400, 'invalid_messages', 'Messages cannot be empty.');
    }
    if (item.content.length > MAX_MESSAGE_CHARS) {
      throw new AIEndpointError(400, 'message_too_long', `Keep each message under ${MAX_MESSAGE_CHARS} characters.`);
    }
    return { role: item.role, content: item.content.trim() };
  });
}

/** Checks the arguments the model chose for a tool call before anything runs. */
export function validateToolCall(name, rawArguments) {
  let args;
  try {
    args = typeof rawArguments === 'string' ? JSON.parse(rawArguments) : rawArguments;
  } catch {
    return { ok: false, reason: 'invalid_arguments' };
  }
  if (name === 'search_testimonies' || name === 'search_web') {
    if (typeof args?.query !== 'string' || !args.query.trim() || args.query.length > 200) return { ok: false, reason: 'invalid_arguments' };
    return { ok: true, name, args: { query: args.query.trim() } };
  }
  if (name === 'open_screen') {
    if (!ASSISTANT_SCREENS.includes(args?.screen)) return { ok: false, reason: 'unknown_screen' };
    return { ok: true, name, args: { screen: args.screen } };
  }
  return { ok: false, reason: 'unknown_tool' };
}

/**
 * Runs one chat turn. Returns:
 *   reply       the answer text
 *   testimonies app testimonies found (internal)
 *   sources     web sources found (external, shown separately and labelled in the app)
 *   navigate    a screen name from ASSISTANT_SCREENS, or null
 */
export async function runAssistant(env, authorization, uid, rawMessages) {
  const messages = validateMessages(rawMessages);
  await enforceAiRateLimit(env, uid, 'assistant', 20);
  if (!env.DEEPSEEK_API_KEY) {
    throw new AIEndpointError(503, 'assistant_not_configured', 'The assistant is not available right now.');
  }

  const conversation = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
  let navigate = null;
  let testimonies = [];
  let sources = [];
  let webSearches = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const completion = await chatCompletion(env, conversation, round < MAX_TOOL_ROUNDS);
    const message = completion?.choices?.[0]?.message;
    if (!message) throw new AIEndpointError(502, 'invalid_provider_response', 'The assistant returned an unreadable answer.');

    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (calls.length === 0) {
      const reply = typeof message.content === 'string' ? message.content.trim().slice(0, MAX_REPLY_CHARS) : '';
      if (!reply) throw new AIEndpointError(502, 'empty_answer', 'The assistant did not return an answer. Please try again.');
      return { reply, navigate, testimonies, sources };
    }

    conversation.push({ role: 'assistant', content: message.content || '', tool_calls: calls });
    for (const call of calls) {
      const checked = validateToolCall(call?.function?.name, call?.function?.arguments);
      let result;
      if (!checked.ok) {
        result = { error: checked.reason };
      } else if (checked.name === 'search_testimonies') {
        const found = await semanticSearch(env, authorization, checked.args.query, 5);
        testimonies = found.results.slice(0, 5).map((t) => ({ id: t.id, title: t.title, description: String(t.description || '').slice(0, 300) }));
        result = { testimonies };
      } else if (checked.name === 'search_web') {
        if (webSearches >= MAX_WEB_SEARCHES) {
          result = { error: 'search_limit_reached' };
        } else {
          webSearches += 1;
          try {
            const found = await deepSeekSearch(env, checked.args.query);
            sources = found.sources.slice(0, 5).map((s) => ({ title: s.title, url: s.url, snippet: String(s.snippet || '').slice(0, 300) }));
            result = { sources: sources.map(({ title, url, snippet }) => ({ title, url, snippet })) };
          } catch {
            // The web search is optional: report the failure, never invent sources.
            result = { error: 'web_search_unavailable' };
          }
        }
      } else {
        navigate = checked.args.screen;
        result = { opened: checked.args.screen };
      }
      conversation.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new AIEndpointError(502, 'too_many_steps', 'That took too many steps. Please ask in a simpler way.');
}

async function chatCompletion(env, conversation, allowTools) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || 'deepseek-flash',
        messages: conversation,
        tools: allowTools ? TOOLS : undefined,
        temperature: 0.3,
        max_tokens: 700,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      // Provider details are not returned to the app.
      throw new AIEndpointError(502, 'provider_error', 'The assistant could not complete this request.');
    }
    return await response.json();
  } catch (error) {
    if (error instanceof AIEndpointError) throw error;
    if (error?.name === 'AbortError') throw new AIEndpointError(504, 'provider_timeout', 'The assistant took too long. Please try again.');
    throw new AIEndpointError(502, 'provider_unavailable', 'The assistant is temporarily unavailable.');
  } finally {
    clearTimeout(timer);
  }
}
