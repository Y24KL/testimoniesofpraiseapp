/**
 * T.O.P AI Assistant on Gemini. The model never touches the database directly.
 *  - Chat turns use Gemini function calling with three allow-listed tools.
 *  - search_testimonies runs with the signed-in user's own Firebase token (so Firestore rules apply).
 *  - search_web is a separate Gemini request with Google Search grounding. Its sources are shown only when
 *    Gemini returns them.
 *  - open_screen returns a screen name that the app checks against its own list.
 */
import { AIEndpointError, enforceAiRateLimit, semanticSearch } from './ai.js';
import { searchClips } from './clips.js';

export const ASSISTANT_MODEL = 'gemini-3.8-flash';
const GEMINI = 'https://generativelanguage.googleapis.com';
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
- For general or current questions, use search_web and report what it found. Name the source titles it gives. Never invent sources or links.
- When someone asks to find a moment inside a video (for example "the part where a cat appears"), use search_clips and name the video and the time.
- Use open_screen only when the person asks to go somewhere; name the screen in your reply.
- If a tool fails or finds nothing, say so plainly. Do not guess.
- If you do not know something, say so. Never invent prices, bank details, phone numbers, links, dates or statistics.
- Never ask for or repeat passwords, codes or personal details.
- Keep answers short: a few sentences.`;

const FUNCTION_DECLARATIONS = [
  {
    name: 'search_testimonies',
    description: 'Search published testimonies in the app by meaning. Returns titles and short descriptions.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'What the person is looking for, in a few words.' } }, required: ['query'] },
  },
  {
    name: 'search_clips',
    description: 'Find the moment inside a testimony video that matches a description (for example "a cat", "the pastor prays"). Returns the video and the start time.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'What is seen or said in the moment, in a few words.' } }, required: ['query'] },
  },
  {
    name: 'search_web',
    description: 'Search the public web for general or current information. Returns a short answer and any sources found.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'The question to look up, in a few words.' } }, required: ['query'] },
  },
  {
    name: 'open_screen',
    description: 'Suggest opening one of the app screens.',
    parameters: { type: 'OBJECT', properties: { screen: { type: 'STRING', enum: ASSISTANT_SCREENS } }, required: ['screen'] },
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
export function validateToolCall(name, args) {
  if (name === 'search_testimonies' || name === 'search_web' || name === 'search_clips') {
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
 *   sources     web sources found by Gemini (external; shown separately, labelled in the app)
 *   navigate    a screen name from ASSISTANT_SCREENS, or null
 */
export async function runAssistant(env, authorization, uid, rawMessages) {
  const messages = validateMessages(rawMessages);
  await enforceAiRateLimit(env, uid, 'assistant', 20);
  if (!env.GEMINI_API_KEY) {
    throw new AIEndpointError(503, 'assistant_not_configured', 'The assistant is not available right now.');
  }

  const contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  let navigate = null;
  let testimonies = [];
  let clips = [];
  let sources = [];
  let webSearches = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const allowTools = round < MAX_TOOL_ROUNDS;
    const data = await generate(env, ASSISTANT_MODEL, {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      ...(allowTools ? { tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }] } : {}),
      generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
    });
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
      throw new AIEndpointError(502, 'empty_answer', 'The assistant did not return an answer. Please try again.');
    }

    const calls = parts.filter((p) => p.functionCall);
    if (calls.length === 0) {
      const reply = parts.map((p) => p.text || '').join('').trim().slice(0, MAX_REPLY_CHARS);
      if (!reply) throw new AIEndpointError(502, 'empty_answer', 'The assistant did not return an answer. Please try again.');
      return { reply, navigate, testimonies, clips, sources };
    }

    // Keep the model's own turn exactly as returned (including thought signatures) before its results.
    contents.push({ role: 'model', parts });
    const responses = [];
    for (const part of calls) {
      const checked = validateToolCall(part.functionCall.name, part.functionCall.args);
      let result;
      if (!checked.ok) {
        result = { error: checked.reason };
      } else if (checked.name === 'search_testimonies') {
        const found = await semanticSearch(env, authorization, checked.args.query, 5);
        testimonies = found.results.slice(0, 5).map((t) => ({ id: t.id, title: t.title, description: String(t.description || '').slice(0, 300) }));
        result = { testimonies };
      } else if (checked.name === 'search_clips') {
        const found = await searchClips(env, authorization, uid, checked.args.query, 4);
        clips = found.clips.slice(0, 4);
        result = { clips: clips.map((c) => ({ testimonyId: c.testimonyId, title: c.title, startLabel: c.startLabel, startSec: c.startSec, description: c.description })) };
      } else if (checked.name === 'search_web') {
        if (webSearches >= MAX_WEB_SEARCHES) {
          result = { error: 'search_limit_reached' };
        } else {
          webSearches += 1;
          try {
            const found = await webSearch(env, checked.args.query);
            sources = found.sources;
            result = { answer: found.answer, sources: found.sources.map(({ title, url }) => ({ title, url })) };
          } catch {
            // The web search is optional: report the failure, never invent sources.
            result = { error: 'web_search_unavailable' };
          }
        }
      } else {
        navigate = checked.args.screen;
        result = { opened: checked.args.screen };
      }
      responses.push({ functionResponse: { name: part.functionCall.name, response: result } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  throw new AIEndpointError(502, 'too_many_steps', 'That took too many steps. Please ask in a simpler way.');
}

/** A web question with Google Search grounding. Sources come only from Gemini's grounding data. */
export async function webSearch(env, query) {
  const data = await generate(env, ASSISTANT_MODEL, {
    contents: [{ role: 'user', parts: [{ text: `Answer briefly with current facts: ${query}` }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
  });
  const candidate = data?.candidates?.[0];
  const answer = (candidate?.content?.parts || []).map((p) => p.text || '').join('').trim().slice(0, 1200);
  const chunks = candidate?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.flatMap((c) => {
    const url = c?.web?.uri;
    if (typeof url !== 'string' || !/^https:\/\//.test(url)) return [];
    return [{ title: String(c.web.title || new URL(url).hostname).slice(0, 200), url }];
  }).slice(0, 5);
  return { answer, sources };
}

/** One Gemini request. Only the HTTP status is logged; the request and reply are never logged. */
async function generate(env, model, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${GEMINI}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error('[assistant] Gemini returned HTTP', response.status);
      if (response.status === 429) throw new AIEndpointError(429, 'provider_rate_limit', 'The assistant is busy. Please wait a moment and try again.');
      if (response.status === 401 || response.status === 403) throw new AIEndpointError(502, 'provider_auth_error', 'The assistant key needs checking. Please tell the administrator.');
      if (response.status === 402) throw new AIEndpointError(503, 'provider_balance', 'The assistant is out of AI credit. Please tell the administrator.');
      throw new AIEndpointError(502, 'provider_error', `The assistant could not complete this request (code ${response.status}).`);
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
