/**
 * Tests for Praxiom support code: AI notification copy validation, structured output, retry rules and the
 * account-wide concurrency gate. No network: Praxiom and the Durable Object are replaced by fakes.
 *
 *   node test-praxiom-core.mjs
 */
import assert from 'node:assert/strict';
import { validatePushCopy } from './src/notify/copy.js';
import { parseModelJson, validateModelOutput } from './src/structured.js';
import { retryDecision, parseRetryAfter, applyLeaseAction, invalidLeaseRequest } from './src/praxiomPolicy.js';
import { PraxiomConcurrencyGate, acquireChatSlot, resetLocalGateForTests } from './src/praxiomGate.js';
import { praxiomChat, PRAXIOM_BASE_URL } from './src/praxiom.js';
import { AIEndpointError } from './src/ai.js';

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

// ---------------- AI copy validation ----------------
const facts = { title: 'Healing Testimony from Lagos', allowedNumbers: ['1', '13', '12:00'] };
const goodCopy = { title: 'NEW TESTIMONY', body: 'Healing Testimony from Lagos is now available to watch.', category: 'testimonies' };

await test('copy that names the content and uses only supplied facts is accepted', async () => {
  const r = validatePushCopy(goodCopy, facts);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

await test('copy with a link, email or domain is refused', async () => {
  for (const body of ['Watch at https://example.com Healing Testimony from Lagos', 'Healing Testimony from Lagos: write to a@b.com', 'Healing Testimony from Lagos at watch.example.ng']) {
    assert.equal(validatePushCopy({ ...goodCopy, body }, facts).ok, false, body);
  }
});

await test('artificial urgency and overclaims are refused', async () => {
  assert.equal(validatePushCopy({ ...goodCopy, body: 'Healing Testimony from Lagos - last chance!' }, facts).ok, false);
  assert.equal(validatePushCopy({ ...goodCopy, body: 'Healing Testimony from Lagos guarantees a miracle' }, facts).ok, false);
});

await test('an invented number, date or time is refused', async () => {
  const r = validatePushCopy({ ...goodCopy, body: 'Healing Testimony from Lagos, 500 testimonies this year' }, facts);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /500/);
  assert.equal(validatePushCopy({ ...goodCopy, body: 'Healing Testimony from Lagos at 12:00 Wednesday' }, facts).ok, true);
  assert.equal(validatePushCopy({ ...goodCopy, body: 'Healing Testimony from Lagos at 1 PM' }, facts).ok, true, '1 is an allowed number');
  assert.equal(validatePushCopy({ ...goodCopy, body: 'Healing Testimony from Lagos at 3 PM' }, facts).ok, false);
});

await test('copy that does not name the content is refused unless allowed', async () => {
  assert.equal(validatePushCopy({ ...goodCopy, body: 'Something new has arrived for you.' }, facts).ok, false);
  assert.equal(validatePushCopy({ ...goodCopy, body: 'Something new has arrived for you.' }, { ...facts, allowTitleOmitted: true }).ok, true);
});

await test('copy must match the schema: length, category, and no extra fields', async () => {
  assert.equal(validatePushCopy({ ...goodCopy, title: 'x'.repeat(61) }, facts).ok, false);
  assert.equal(validatePushCopy({ ...goodCopy, body: 'x'.repeat(181) }, facts).ok, false);
  assert.equal(validatePushCopy({ ...goodCopy, category: 'surveillance' }, facts).ok, false);
  assert.equal(validatePushCopy({ ...goodCopy, sendNow: true }, facts).ok, false);
  assert.equal(validatePushCopy({ ...goodCopy, body: 'Healing Testimony from Lagos\u0007' }, facts).ok, false, 'control characters');
});

await test('mostly-capitals body is refused', async () => {
  assert.equal(validatePushCopy({ ...goodCopy, body: 'HEALING TESTIMONY FROM LAGOS IS NOW OUT' }, facts).ok, false);
});

// ---------------- structured output ----------------
await test('model JSON is read from a bare object, a fenced block or inside prose', async () => {
  assert.deepEqual(parseModelJson('{"a":1}').value, { a: 1 });
  assert.deepEqual(parseModelJson('```json\n{"a":2}\n```').value, { a: 2 });
  assert.deepEqual(parseModelJson('Here you go: {"a":3} thanks').value, { a: 3 });
  assert.equal(parseModelJson('[1,2]').ok, false, 'arrays are not objects');
  assert.equal(parseModelJson('no json here').ok, false);
  assert.equal(parseModelJson('x'.repeat(30000)).ok, false, 'oversized text is refused');
});

await test('model output is checked against the schema and unknown keys are refused', async () => {
  const schema = { type: 'object', required: ['ids'], properties: { ids: { type: 'array', maxItems: 2, items: { type: 'string', maxLength: 5 } } } };
  assert.equal(validateModelOutput('{"ids":["a","b"]}', schema).ok, true);
  assert.equal(validateModelOutput('{"ids":["a","b","c"]}', schema).ok, false);
  assert.equal(validateModelOutput('{"ids":["toolongvalue"]}', schema).ok, false);
  assert.equal(validateModelOutput('{"ids":["a"],"url":"x"}', schema).ok, false);
  assert.equal(validateModelOutput('{}', schema).ok, false);
});

// ---------------- retries and leases ----------------
await test('retries only transient provider failures, within attempts and budget', async () => {
  assert.equal(retryDecision({ providerCode: 'concurrency_limit', status: 429, retryAfterMs: 5000 }, { attempt: 1, maxAttempts: 2, elapsedMs: 0, budgetMs: 20000 }).waitMs, 5000);
  assert.equal(retryDecision({ providerCode: 'insufficient_credit', status: 402 }, { attempt: 1, maxAttempts: 3 }).retry, false);
  assert.equal(retryDecision({ providerCode: 'invalid_api_key', status: 401 }, { attempt: 1, maxAttempts: 3 }).retry, false);
  assert.equal(retryDecision({ providerCode: 'gate_busy', status: 429 }, { attempt: 1, maxAttempts: 3 }).retry, false, 'our own gate is not retried');
  assert.equal(retryDecision({ providerCode: 'rate_limited', status: 429 }, { attempt: 2, maxAttempts: 2 }).reason, 'attempts_exhausted');
  assert.equal(retryDecision({ providerCode: 'capacity', status: 429, retryAfterMs: 8000 }, { attempt: 1, maxAttempts: 3, elapsedMs: 15000, budgetMs: 20000 }).reason, 'budget_exhausted');
  assert.equal(retryDecision({ status: 503 }, { attempt: 1, maxAttempts: 2 }).retry, true, 'a 503 with no code is retried');
  assert.equal(retryDecision({ status: 504 }, { attempt: 1, maxAttempts: 2 }).retry, false, 'timeouts are not retried');
  assert.equal(retryDecision({ providerCode: 'rate_limited', status: 429, retryAfterMs: 60000 }, { attempt: 1, maxAttempts: 2 }).waitMs, 8000, 'waits are capped');
});

await test('Retry-After is read as seconds and capped', async () => {
  assert.equal(parseRetryAfter('5'), 5000);
  assert.equal(parseRetryAfter('600'), 8000);
  assert.equal(parseRetryAfter('soon'), null);
  assert.equal(parseRetryAfter(null), null);
});

await test('a lease grants up to the limit, frees on release and on expiry', async () => {
  let s = {};
  let r = applyLeaseAction(s, 'acquire', { leaseId: 'a', limit: 2, ttlMs: 1000 }, 0); s = r.leases; assert.equal(r.granted, true);
  r = applyLeaseAction(s, 'acquire', { leaseId: 'b', limit: 2, ttlMs: 1000 }, 0); s = r.leases; assert.equal(r.granted, true);
  r = applyLeaseAction(s, 'acquire', { leaseId: 'c', limit: 2, ttlMs: 1000 }, 0); assert.equal(r.granted, false, 'third request waits');
  r = applyLeaseAction(s, 'release', { leaseId: 'a' }, 0); s = r.leases;
  r = applyLeaseAction(s, 'acquire', { leaseId: 'c', limit: 2, ttlMs: 1000 }, 0); s = r.leases; assert.equal(r.granted, true);
  r = applyLeaseAction(s, 'acquire', { leaseId: 'd', limit: 2, ttlMs: 1000 }, 5000); assert.equal(r.granted, true, 'expired leases free their slot');
});

await test('lease requests are validated', async () => {
  assert.equal(invalidLeaseRequest({ action: 'acquire', leaseId: 'a', limit: 2, ttlMs: 5000 }), null);
  assert.equal(invalidLeaseRequest({ action: 'acquire', leaseId: 'a', limit: 0, ttlMs: 5000 }), 'limit');
  assert.equal(invalidLeaseRequest({ action: 'acquire', leaseId: 'a', limit: 2, ttlMs: 10 }), 'ttlMs');
  assert.equal(invalidLeaseRequest({ action: 'drop', leaseId: 'a' }), 'action');
  assert.equal(invalidLeaseRequest({ action: 'release', leaseId: '' }), 'leaseId');
});

// ---------------- Durable Object and gate ----------------
function fakeNamespace() {
  const storage = new Map();
  const object = new PraxiomConcurrencyGate({
    storage: { get: async (k) => storage.get(k), put: async (k, v) => void storage.set(k, v) },
  });
  return {
    idFromName: (name) => name,
    get: () => ({ fetch: (url, init) => object.fetch(new Request(url, init)) }),
  };
}

await test('the gate object enforces the account-wide limit across callers', async () => {
  const env = { PRAXIOM_GATE: fakeNamespace() };
  const a = await acquireChatSlot(env, 'a', { limit: 2, waitMs: 0 });
  const b = await acquireChatSlot(env, 'b', { limit: 2, waitMs: 0 });
  await assert.rejects(acquireChatSlot(env, 'c', { limit: 2, waitMs: 0 }), (err) => err instanceof AIEndpointError && err.status === 429 && err.providerCode === 'gate_busy');
  await a.release();
  const c = await acquireChatSlot(env, 'c', { limit: 2, waitMs: 0 });
  await b.release();
  await c.release();
});

await test('the gate object rejects malformed requests', async () => {
  const object = new PraxiomConcurrencyGate({ storage: { get: async () => undefined, put: async () => {} } });
  const bad = await object.fetch(new Request('https://gate/lease', { method: 'POST', body: '{"action":"acquire"}' }));
  assert.equal(bad.status, 400);
  const notJson = await object.fetch(new Request('https://gate/lease', { method: 'POST', body: 'nope' }));
  assert.equal(notJson.status, 400);
});

// ---------------- client retries ----------------
const reply = () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const fail = (status, code, headers = {}) => new Response(JSON.stringify({ error: { code } }), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const msgs = [{ role: 'user', content: 'Hi' }];

await test('a concurrency rejection is retried once after Retry-After, then succeeds', async () => {
  resetLocalGateForTests();
  let calls = 0;
  const waits = [];
  const fetchFn = async () => {
    calls += 1;
    return calls === 1 ? fail(429, 'concurrency_limit', { 'Retry-After': '5' }) : reply();
  };
  const r = await praxiomChat({ PRAXIOM_API_KEY: 'px_live_x' }, { messages: msgs }, { fetchFn, sleep: async (ms) => waits.push(ms) });
  assert.equal(r.text, 'ok');
  assert.equal(calls, 2);
  assert.deepEqual(waits, [5000]);
});

await test('insufficient credit is never retried', async () => {
  resetLocalGateForTests();
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return fail(402, 'insufficient_credit');
  };
  await assert.rejects(praxiomChat({ PRAXIOM_API_KEY: 'px_live_x' }, { messages: msgs }, { fetchFn, sleep: async () => {} }), (err) => err.code === 'provider_balance');
  assert.equal(calls, 1);
});

await test('the idempotency key is sent with every attempt of one request', async () => {
  resetLocalGateForTests();
  const keys = [];
  const fetchFn = async (url, init) => {
    keys.push(init.headers['Idempotency-Key']);
    return keys.length === 1 ? fail(503, 'model_unavailable', { 'Retry-After': '1' }) : reply();
  };
  await praxiomChat({ PRAXIOM_API_KEY: 'px_live_x' }, { messages: msgs }, { fetchFn, sleep: async () => {}, idempotencyKey: 'chat-test-0001' });
  assert.deepEqual(keys, ['chat-test-0001', 'chat-test-0001']);
  assert.equal(PRAXIOM_BASE_URL.endsWith('/v1'), true);
});

console.log(`\npraxiom core (copy, structured output, retries, gate): ${passed} tests passed`);
