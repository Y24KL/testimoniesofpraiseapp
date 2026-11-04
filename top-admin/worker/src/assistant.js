/**
 * V.O.G, the T.O.P AI Assistant, powered by Praxiom AI. The model never touches the database directly.
 *  - Chat turns use Praxiom tool calling with three allow-listed tools.
 *  - search_testimonies runs with the signed-in user's own Firebase token (so Firestore rules apply).
 *  - search_clips runs the moment search with the same token.
 *  - open_screen returns a screen name that the app checks against its own list.
 *  - There is no web search: Praxiom has no live data, so the assistant says when it does not know.
 */
import { AIEndpointError, enforceAiRateLimit, semanticSearch as defaultSemanticSearch } from './ai.js';
import { searchClips as defaultSearchClips } from './clips.js';
import { praxiomChat } from './praxiom.js';

const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 1000;
const MAX_TOOL_ROUNDS = 4;
const MAX_REPLY_CHARS = 2000;

/** Screens the assistant may point people to. The app repeats this list and refuses anything else. */
export const ASSISTANT_SCREENS = ['live', 'radio', 'adotopoc', 'written', 'testimonies', 'sponsor', 'downloads'];

const SYSTEM_PROMPT = `You are V.O.G, the T.O.P AI Assistant for the Testimonies of Praise app and website, powered by Praxiom AI.
Help people use the app, find testimonies, and answer general questions. Be friendly, patient, respectful and encouraging. Be brief and accurate. This is a Christian testimony-sharing platform, so keep a respectful tone when discussing faith.

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
- When someone asks to find a moment inside a video (for example "the part where a cat appears"), use search_clips and name the video and the time.
- Use open_screen only when the person asks to go somewhere; name the screen in your reply.
- You have no live or current information and no web search. For questions about current events, prices, schedules or anything that changes, say you do not have that information and suggest checking with the TOP team.
- If a tool fails or finds nothing, say so plainly. Do not guess.
- For login, sign-in, verification, playback, download or notification problems: suggest the likely fix step by step, then say that if it still fails the person should contact the TOP team. Never say you fixed a problem, because you cannot change anything in the account or app.
- If you do not know something, say so. Never invent prices, bank details, phone numbers, links, dates, Bible verses, testimonies or statistics.
- Never ask for or repeat passwords, codes or personal details.
- Keep answers short: a few sentences. Give more detail only when the person asks for it.
- Format: plain text. For a list, start each item on its own line with "- ". Do not use asterisks, bold markers or headings.`;

/** Tool definitions in the Praxiom (OpenAI-style) format. */
export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_testimonies',
      description: 'Search published testimonies in the app by meaning. Returns titles and short descriptions.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'What the person is looking for, in a few words.' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_clips',
      description: 'Find the moment inside a testimony video that matches a description (for example "a cat", "the pastor prays"). Returns the video and the start time.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'What is seen or said in the moment, in a few words.' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_screen',
      description: 'Suggest opening one of the app screens.',
      parameters: { type: 'object', properties: { screen: { type: 'string', enum: ASSISTANT_SCREENS } }, required: ['screen'] },
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
    const content = item.content.trim();
    // A person's own question is limited. Earlier answers in the history are trimmed, not rejected.
    if (item.role === 'user' && content.length > MAX_MESSAGE_CHARS) {
      throw new AIEndpointError(400, 'message_too_long', `Keep each message under ${MAX_MESSAGE_CHARS} characters.`);
    }
    return { role: item.role, content: content.slice(0, MAX_MESSAGE_CHARS) };
  });
}

/** Checks the arguments the model chose for a tool call before anything runs. */
export function validateToolCall(name, args) {
  if (name === 'search_testimonies' || name === 'search_clips') {
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
 *   clips       video moments found (internal)
 *   navigate    a screen name from ASSISTANT_SCREENS, or null
 *   sources     always empty: there is no web search any more (kept so older app builds still read the reply)
 *
 * `deps` lets tests replace the network calls. The app never passes it.
 */
export async function runAssistant(env, authorization, uid, rawMessages, deps = {}) {
  const messages = validateMessages(rawMessages);
  await enforceAiRateLimit(env, uid, 'assistant', 20);

  const semanticSearch = deps.semanticSearch || defaultSemanticSearch;
  const searchClips = deps.searchClips || defaultSearchClips;
  const conversation = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
  let navigate = null;
  let testimonies = [];
  let clips = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const allowTools = round < MAX_TOOL_ROUNDS;
    const turn = await praxiomChat(
      env,
      { messages: conversation, tools: allowTools ? TOOLS : undefined, maxTokens: 700, temperature: 0.3 },
      { fetchFn: deps.fetchFn },
    );

    if (turn.toolCalls.length === 0) {
      const reply = turn.text.slice(0, MAX_REPLY_CHARS);
      if (!reply) throw new AIEndpointError(502, 'empty_answer', 'The assistant did not return an answer. Please try again.');
      return { reply, navigate, testimonies, clips, sources: [] };
    }

    // Keep the model's own turn (including its tool calls) before the results, as the API expects.
    conversation.push({ role: 'assistant', content: turn.text || null, tool_calls: turn.toolCalls });
    for (const call of turn.toolCalls) {
      let args = null;
      try {
        args = JSON.parse(call.function?.arguments || '{}');
      } catch {
        args = null;
      }
      const checked = validateToolCall(call.function?.name, args);
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
      } else {
        navigate = checked.args.screen;
        result = { opened: checked.args.screen };
      }
      conversation.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new AIEndpointError(502, 'too_many_steps', 'That took too many steps. Please ask in a simpler way.');
}
