// Offline test of the relay logic with mocked Firestore + Expo. Run: node test.mjs
import worker from './src/index.js';
import assert from 'node:assert';

const env = { FIREBASE_PROJECT_ID: 'demo', ALLOWED_ORIGINS: 'http://localhost:5173' };
const calls = [];
let admin = true;

globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  if (String(url).includes(':runQuery')) {
    if (!admin) return new Response('{}', { status: 403 });
    const many = Array.from({ length: 150 }, (_, i) => ({ document: { name: `projects/demo/databases/(default)/documents/pushTokens/t${i}`, fields: { token: { stringValue: `ExponentPushToken[t${i}]` } } } }));
    return new Response(JSON.stringify([...many, { readTime: 'x' }]), { status: 200 });
  }
  if (String(url).startsWith('https://exp.host')) {
    const msgs = JSON.parse(init.body);
    return new Response(JSON.stringify({ data: msgs.map((m, i) => (m.to.endsWith('t3]') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' })) }), { status: 200 });
  }
  if (init.method === 'DELETE') return new Response('{}', { status: 200 });
  throw new Error('unexpected ' + url);
};

const call = (over = {}, headers = {}) =>
  worker.fetch(new Request('https://relay/', { method: 'POST', headers: { Origin: 'http://localhost:5173', Authorization: 'Bearer x', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ pref: 'testimonies', title: 'T', body: 'B', data: { type: 'testimony', contentId: 'abc' }, ...over }) }), env);

// happy path: 150 devices -> 2 Expo batches, 1 dead token removed
let r = await call();
let j = await r.json();
assert.equal(r.status, 200); assert.equal(j.sent, 149); assert.equal(j.failed, 1); assert.equal(j.removed, 1);
assert.equal(calls.filter((c) => c.url.startsWith('https://exp.host')).length, 2);
assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');

// non-admin (Firestore denies the read) -> nothing is sent
calls.length = 0; admin = false;
r = await call(); assert.equal(r.status, 403);
assert.equal(calls.filter((c) => c.url.startsWith('https://exp.host')).length, 0);
admin = true;

// wrong origin, missing auth, bad payloads
assert.equal((await call({}, { Origin: 'https://evil.example' })).status, 403);
assert.equal((await call({}, { Authorization: '' })).status, 401);
assert.equal((await call({ pref: 'everyone' })).status, 400);
assert.equal((await call({ title: '' })).status, 400);
assert.equal((await call({ data: { type: 'hack' } })).status, 400);
const pre = await worker.fetch(new Request('https://relay/', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }), env);
assert.equal(pre.status, 204);
console.log('relay tests passed');
