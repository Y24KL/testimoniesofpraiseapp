import assert from 'node:assert/strict';
import { praxiomChat, parseStreamLine, PRAXIOM_BASE_URL } from './src/praxiom.js';
import { AIEndpointError } from './src/ai.js';

const env = { PRAXIOM_API_KEY: 'px_live_test_key' };
const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

async function expectError(promise, status, code) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof AIEndpointError, `expected AIEndpointError, got ${err}`);
    assert.equal(err.status, status);
    assert.equal(err.code, code);
    return true;
  });
}

// Success: the right URL, model and key, and the usage Praxiom reports is returned.
let seen;
const ok = async (url, init) => {
  seen = { url, init, body: JSON.parse(init.body) };
  return json(200, {
    choices: [{ message: { role: 'assistant', content: ' Hello there. ' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 3092, completion_tokens: 58, total_tokens: 3150 },
  });
};
const reply = await praxiomChat(env, { messages: [{ role: 'user', content: 'Hi' }] }, { fetchFn: ok });
assert.equal(seen.url, `${PRAXIOM_BASE_URL}/chat/completions`);
assert.equal(seen.init.headers.Authorization, 'Bearer px_live_test_key');
assert.equal(seen.body.model, 'praxiom');
assert.equal(seen.body.max_tokens, 700);
assert.equal(reply.text, 'Hello there.');
assert.equal(reply.usage.total_tokens, 3150);
assert.equal(reply.finishReason, 'stop');

// Tool calls are passed through to the caller.
const withTool = async () =>
  json(200, {
    choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'open_screen', arguments: '{"screen":"live"}' } }] }, finish_reason: 'tool_calls' }],
    usage: null,
  });
const toolReply = await praxiomChat(env, { messages: [{ role: 'user', content: 'Take me to live' }], tools: [{ type: 'function', function: { name: 'open_screen', parameters: {} } }] }, { fetchFn: withTool });
assert.equal(toolReply.toolCalls[0].function.name, 'open_screen');

// Error mapping, from the docs' error codes.
const failing = (status, code, headers) => async () => json(status, { error: { code, message: 'x' } }, headers);
await expectError(praxiomChat(env, { messages: [{ role: 'user', content: 'x' }] }, { fetchFn: failing(402, 'insufficient_credit') }), 503, 'provider_balance');
await expectError(praxiomChat(env, { messages: [{ role: 'user', content: 'x' }] }, { fetchFn: failing(401, 'invalid_api_key') }), 502, 'provider_auth_error');
await expectError(praxiomChat(env, { messages: [{ role: 'user', content: 'x' }] }, { fetchFn: failing(429, 'rate_limited', { 'Retry-After': '5' }) }), 429, 'provider_rate_limit');
await expectError(praxiomChat(env, { messages: [{ role: 'user', content: 'x' }] }, { fetchFn: failing(429, 'concurrency_limit') }), 429, 'provider_rate_limit');
await expectError(praxiomChat(env, { messages: [{ role: 'user', content: 'x' }] }, { fetchFn: failing(503, 'model_unavailable') }), 503, 'provider_unavailable');
await expectError(praxiomChat(env, { messages: [{ role: 'user', content: 'x' }] }, { fetchFn: failing(400, 'context_length_exceeded') }), 400, 'context_too_long');
await expectError(praxiomChat(env, { messages: [{ role: 'user', content: 'x' }] }, { fetchFn: failing(400, 'invalid_messages') }), 400, 'provider_request_error');
await expectError(praxiomChat(env, { messages: [{ role: 'user', content: 'x' }] }, { fetchFn: failing(500, 'internal_error') }), 502, 'provider_error');

// Timeout: a request that never answers is aborted and reported as a timeout.
const hangs = (url, init) =>
  new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
const started = Date.now();
await expectError(praxiomChat(env, { messages: [{ role: 'user', content: 'x' }] }, { fetchFn: hangs }).catch((e) => { throw e; }), 504, 'provider_timeout');
assert.ok(Date.now() - started >= 20000, 'timeout should wait for the configured limit');

// No key configured: refused before any call.
await expectError(praxiomChat({}, { messages: [{ role: 'user', content: 'x' }] }, { fetchFn: ok }), 503, 'assistant_not_configured');

// Streaming lines: text chunks, then the usage chunk, then [DONE].
assert.deepEqual(parseStreamLine('data: {"choices":[{"delta":{"content":"Hel"}}]}'), { done: false, text: 'Hel', usage: null });
assert.deepEqual(parseStreamLine('data: {"choices":[],"usage":{"total_tokens":9}}'), { done: false, text: '', usage: { total_tokens: 9 } });
assert.deepEqual(parseStreamLine('data: [DONE]'), { done: true, text: '', usage: null });
assert.equal(parseStreamLine(': keep-alive'), null);
assert.equal(parseStreamLine('data: {not json'), null);

console.log('praxiom client tests passed');
