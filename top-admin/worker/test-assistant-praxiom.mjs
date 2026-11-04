import assert from 'node:assert/strict';
import { runAssistant, TOOLS } from './src/assistant.js';
import { AIEndpointError } from './src/ai.js';

const store = new Map();
const env = {
  PRAXIOM_API_KEY: 'px_live_test_key',
  OTP_KV: {
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => void store.set(key, value),
    delete: async (key) => void store.delete(key),
  },
};
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

// Tools offered to Praxiom: no web search.
assert.deepEqual(TOOLS.map((t) => t.function.name).sort(), ['open_screen', 'search_clips', 'search_testimonies']);

// Turn 1: the model asks to search testimonies. Turn 2: it answers from the results.
const sent = [];
const replies = [
  json({
    choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search_testimonies', arguments: '{"query":"healing"}' } }] }, finish_reason: 'tool_calls' }],
    usage: null,
  }),
  json({
    choices: [{ message: { role: 'assistant', content: 'I found one testimony about healing.' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
  }),
];
const fetchFn = async (url, init) => {
  sent.push(JSON.parse(init.body));
  return replies.shift();
};
const semanticSearch = async (_env, _auth, query) => {
  assert.equal(query, 'healing');
  return { results: [{ id: 't1', title: 'Healed at last', description: 'A story of healing.' }] };
};

const result = await runAssistant(env, 'Bearer token', 'uid-1', [{ role: 'user', content: 'Any testimonies about healing?' }], {
  fetchFn,
  semanticSearch,
  searchClips: async () => ({ clips: [] }),
});

// The system prompt is first, V.O.G is named, and the tool result goes back with its call id.
assert.equal(sent[0].messages[0].role, 'system');
assert.match(sent[0].messages[0].content, /V\.O\.G/);
assert.match(sent[0].messages[0].content, /Praxiom AI/);
assert.equal(sent[1].messages.at(-1).role, 'tool');
assert.equal(sent[1].messages.at(-1).tool_call_id, 'call_1');
assert.deepEqual(JSON.parse(sent[1].messages.at(-1).content), { testimonies: [{ id: 't1', title: 'Healed at last', description: 'A story of healing.' }] });

assert.equal(result.reply, 'I found one testimony about healing.');
assert.equal(result.testimonies[0].id, 't1');
assert.equal(result.navigate, null);
assert.deepEqual(result.sources, []);

// An unknown tool name is refused and the turn still completes.
const refusedReplies = [
  json({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c2', type: 'function', function: { name: 'search_web', arguments: '{"query":"x"}' } }] }, finish_reason: 'tool_calls' }], usage: null }),
  json({ choices: [{ message: { role: 'assistant', content: 'I cannot search the web.' }, finish_reason: 'stop' }], usage: null }),
];
const refusedSent = [];
const refused = await runAssistant(env, 'Bearer token', 'uid-2', [{ role: 'user', content: 'latest news' }], {
  fetchFn: async (url, init) => {
    refusedSent.push(JSON.parse(init.body));
    return refusedReplies.shift();
  },
});
assert.equal(refused.reply, 'I cannot search the web.');
assert.deepEqual(JSON.parse(refusedSent[1].messages.at(-1).content), { error: 'unknown_tool' });

// An empty answer from Praxiom is an error, not a silent blank reply.
await assert.rejects(
  runAssistant(env, 'Bearer token', 'uid-3', [{ role: 'user', content: 'hi' }], {
    fetchFn: async () => json({ choices: [{ message: { role: 'assistant', content: '   ' }, finish_reason: 'stop' }], usage: null }),
  }),
  (err) => err instanceof AIEndpointError && err.code === 'empty_answer',
);

// A Praxiom error reaches the caller with its own message (no fallback to another provider).
await assert.rejects(
  runAssistant(env, 'Bearer token', 'uid-4', [{ role: 'user', content: 'hi' }], {
    fetchFn: async () => new Response(JSON.stringify({ error: { code: 'insufficient_credit' } }), { status: 402 }),
  }),
  (err) => err instanceof AIEndpointError && err.code === 'provider_balance' && err.status === 503,
);

console.log('assistant on Praxiom tests passed');
