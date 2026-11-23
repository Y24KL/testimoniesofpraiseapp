// Offline tests of the Worker's notification endpoint guards, CORS policy and the Expo sender. Run: node test.mjs
import worker from './src/index.js';
import assert from 'node:assert';
import { createExpoSender } from './src/notify/senders.js';

const env = { FIREBASE_PROJECT_ID: 'demo', ALLOWED_ORIGINS: 'http://localhost:5173' };
const calls = [];
let admin = true;

// Only the admin check (a Firestore runQuery with the caller's token) is reachable before the engine runs.
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  if (String(url).includes(':runQuery')) return admin ? new Response('[{"readTime":"x"}]', { status: 200 }) : new Response('{}', { status: 403 });
  throw new Error('unexpected ' + url);
};

const call = (over = {}, headers = {}, e = env) =>
  worker.fetch(new Request('https://relay/', { method: 'POST', headers: { Origin: 'http://localhost:5173', Authorization: 'Bearer x', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ pref: 'testimonies', title: 'T', body: 'B', data: { type: 'testimony', contentId: 'abc' }, ...over }) }), e);

// without the service account the engine refuses clearly, after the admin check
let r = await call();
assert.equal(r.status, 503);
assert.match((await r.json()).error, /FIREBASE_SERVICE_ACCOUNT/);
assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
assert.equal(r.headers.get('Cache-Control'), 'no-store');

// non-admin (Firestore denies the read) -> refused before anything else
admin = false;
r = await call(); assert.equal(r.status, 403);
admin = true;

// wrong origin, missing auth
assert.equal((await call({}, { Origin: 'https://evil.example' })).status, 403);
assert.equal((await call({}, { Authorization: '' })).status, 401);

// bad payloads are rejected before any engine work (a service account is set, but nothing is fetched)
const engineEnv = { ...env, FIREBASE_SERVICE_ACCOUNT: '{}' };
calls.length = 0;
assert.equal((await call({ pref: 'everyone' }, {}, engineEnv)).status, 400);
assert.equal((await call({ title: '' }, {}, engineEnv)).status, 400);
assert.equal((await call({ body: 'x'.repeat(301) }, {}, engineEnv)).status, 400);
assert.equal((await call({ data: { type: 'hack' } }, {}, engineEnv)).status, 400);
assert.equal((await call({ data: { type: 'testimony', contentId: 'x'.repeat(101) } }, {}, engineEnv)).status, 400);
assert.ok(calls.every((c) => c.url.includes(':runQuery')), 'only the admin check ran for rejected payloads');

const pre = await worker.fetch(new Request('https://relay/', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }), env);
assert.equal(pre.status, 204);

// the public VAPID key is served without sign-in
const vk = await worker.fetch(new Request('https://relay/api/notifications/vapid-key', { headers: { Origin: 'http://localhost:5173' } }), { ...env, VAPID_PUBLIC_KEY: 'BPub' });
assert.equal(vk.status, 200);
assert.deepEqual(await vk.json(), { publicKey: 'BPub' });
console.log('notification endpoint tests passed');

// ---- CORS policy (regression tests for the "Worker Status Error" in TOP Admin) ----
const prodEnv = { ...env, ALLOWED_ORIGINS: 'http://localhost:5173,https://testimoniesofpraiseweb.onrender.com, https://top-admin.onrender.com/' };
const ADMIN = 'https://top-admin.onrender.com';
// 1. production admin origin passes preflight for the headers the dashboard actually sends
let p = await worker.fetch(new Request('https://relay/api/media/status', { method: 'OPTIONS', headers: { Origin: ADMIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'cache-control' } }), prodEnv);
assert.equal(p.status, 204);
assert.equal(p.headers.get('Access-Control-Allow-Origin'), ADMIN, 'trailing slash / spaces in ALLOWED_ORIGINS must not break matching');
assert.match(p.headers.get('Access-Control-Allow-Headers'), /cache-control/);
assert.match(p.headers.get('Access-Control-Allow-Headers'), /authorization/);
assert.match(p.headers.get('Vary'), /Origin/);
// 2. status GET from the admin origin returns provider data with CORS headers
let s = await worker.fetch(new Request('https://relay/api/media/status', { headers: { Origin: ADMIN } }), prodEnv);
assert.equal(s.status, 200);
assert.equal(s.headers.get('Access-Control-Allow-Origin'), ADMIN);
assert.ok((await s.json()).providers, 'status must include providers');
// 3. a non-allowed origin gets no ACAO header (browser blocks it) and its preflight is refused
s = await worker.fetch(new Request('https://relay/api/media/status', { headers: { Origin: 'https://evil.example' } }), prodEnv);
assert.equal(s.headers.get('Access-Control-Allow-Origin'), null);
p = await worker.fetch(new Request('https://relay/', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), prodEnv);
assert.equal(p.status, 403);
assert.equal(p.headers.get('Access-Control-Allow-Origin'), null);
// 4. empty ALLOWED_ORIGINS no longer means "allow everyone"
p = await worker.fetch(new Request('https://relay/', { method: 'OPTIONS', headers: { Origin: ADMIN } }), { ...env, ALLOWED_ORIGINS: '' });
assert.equal(p.status, 403);
// 5. error responses still carry CORS headers so the dashboard can read them
s = await worker.fetch(new Request('https://relay/upload/bunny', { method: 'POST', headers: { Origin: ADMIN } }), prodEnv);
assert.equal(s.status, 401);
assert.equal(s.headers.get('Access-Control-Allow-Origin'), ADMIN);
console.log('cors tests passed');

// ---- Expo sender: mixed Expo projects (PUSH_TOO_MANY_EXPERIENCE_IDS) are split and each sent ----
{
  const project = (t) => (t.includes('[b') ? '@y24kl/top10' : '@y24kl/testimonies-of-praise');
  const requests = [];
  const fakeFetch = async (url, init = {}) => {
    const msgs = JSON.parse(init.body);
    requests.push(msgs.length);
    const projects = [...new Set(msgs.map((m) => project(m.to)))];
    if (projects.length > 1) {
      const details = {};
      for (const m of msgs) (details[project(m.to)] ||= []).push(m.to);
      return new Response(JSON.stringify({ errors: [{ code: 'PUSH_TOO_MANY_EXPERIENCE_IDS', message: 'same project', details }] }), { status: 400 });
    }
    return new Response(JSON.stringify({ data: msgs.map((m) => (m.to.endsWith('a2]') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: `id-${m.to}` })) }), { status: 200 });
  };
  const sender = createExpoSender(fakeFetch);
  const out = await sender.expo(['ExponentPushToken[a1]', 'ExponentPushToken[a2]', 'ExponentPushToken[b1]'].map((to) => ({ to, title: 'T', body: 'B' })));
  assert.deepEqual(requests, [3, 2, 1], 'one rejected mixed batch, then one request per project');
  assert.equal(out[0].status, 'ok');
  assert.equal(out[1].tokenGone, true, 'a dead token is reported so the engine removes it');
  assert.equal(out[2].status, 'ok');
  // a server error is retryable; a network failure is retryable; nothing throws
  const s500 = createExpoSender(async () => new Response('down', { status: 503 }));
  assert.equal((await s500.expo([{ to: 'ExponentPushToken[x]' }]))[0].retryable, true);
  const sNet = createExpoSender(async () => { throw new Error('offline'); });
  assert.equal((await sNet.expo([{ to: 'ExponentPushToken[x]' }]))[0].code, 'NetworkError');
  console.log('expo sender tests passed');
}
