/**
 * End-to-end tests for the notification engine: detection, approval, delivery, quiet hours, caps, dead tokens,
 * retries, receipts, live sessions, the lock and the kill switch. Uses the in-memory store and a fake Expo.
 *
 *   node test-engine-run.mjs
 */
import assert from 'node:assert/strict';
import { MemoryStore } from './src/engine/memoryStore.js';
import { runEngine, effectiveSettings } from './src/engine/run.js';
import { enqueueCandidate } from './src/engine/enqueue.js';
import { encodeValue, decodeValue, FirestoreRest } from './src/engine/firestoreRest.js';
import { signAssertion, getGoogleAccessToken, clearGoogleTokenCache, GOOGLE_TOKEN_URL } from './src/googleAuth.js';
import { base64UrlFromBytes } from './src/firebaseCustomToken.js';

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

const H = 3600000;
const NOW = Date.UTC(2026, 10, 18, 12, 0); // 13:00 local (UTC+1): not quiet
const DAY_AGO = new Date(NOW - 24 * H);
const quietSettings = { enabled: true, categories: {}, quietHours: { enabled: true, startMin: 22 * 60, endMin: 7 * 60 }, maxPerDay: 3, perCategoryPerDay: {} };
const token = (name) => `ExponentPushToken[${name}]`;
const device = (uid, name, extra = {}) => ({
  token: token(name),
  uid,
  platform: 'android',
  prefs: { testimonies: true, live: true, announcements: true, promotions: true, choirs: true, loveworld: true, articles: true },
  utcOffsetMinutes: 60,
  ...extra,
});

/** A store with the engine's settings, a cursor that has already run, and the given devices. */
function world({ settings = quietSettings, devices = [device('a', 'a1')], cursorAt = DAY_AGO, extra = {} } = {}) {
  const initial = {
    'settings/notifications': settings,
    'settings/notificationEngine': { cursor: { testimonyAt: cursorAt, articleAt: cursorAt, lyricalAt: cursorAt, liveSession: null } },
    'settings/live': { isLive: false },
    ...extra,
  };
  for (const d of devices) initial[`pushTokens/${d.token}`] = d;
  return new MemoryStore(initial);
}

/**
 * Fake Expo. `plan(event)` decides the outcome. Events:
 *   { type: 'send', messages }   a whole request: return { http: 503 } to simulate an outage
 *   { type: 'message', to, n }   one message: return { error: 'DeviceNotRegistered' } or nothing (ok)
 *   { type: 'receipt', id }      one receipt: return a receipt object, or nothing (ok)
 * Only requests that succeed are recorded in calls.messages.
 */
function fakeExpo(plan = () => null) {
  const calls = { sends: [], receipts: [], messages: [] };
  let n = 0;
  const fetchFn = async (url, init) => {
    if (url.endsWith('/getReceipts')) {
      const ids = JSON.parse(init.body).ids;
      calls.receipts.push(ids);
      return Response.json({ data: Object.fromEntries(ids.map((id) => [id, plan({ type: 'receipt', id }) ?? { status: 'ok' }])) });
    }
    const messages = JSON.parse(init.body);
    const outage = plan({ type: 'send', messages });
    if (outage?.http) return new Response('unavailable', { status: outage.http });
    calls.sends.push(messages);
    calls.messages.push(...messages.map((m) => m.to));
    return Response.json({ data: messages.map((m) => {
      n += 1;
      const decision = plan({ type: 'message', to: m.to, n });
      return decision?.error ? { status: 'error', message: 'x', details: { error: decision.error } } : { status: 'ok', id: `ticket-${n}` };
    }) });
  };
  return { fetchFn, calls };
}

const noSleep = async () => {};
const run = (store, opts) => runEngine({ store, sleep: noSleep, now: NOW, ...opts });
const queueEntry = (store, key) => store.get(`notification_queue/${key}`);

// ---------------- detection, approval and delivery ----------------
await test('the first run only starts the cursor, so old content is never announced', async () => {
  const store = new MemoryStore({
    'settings/notifications': quietSettings,
    'settings/live': { isLive: false },
    'testimonies/old1': { title: 'Old story', isPublished: true, publishedAt: new Date(NOW - 400 * 24 * H) },
  });
  const r = await run(store, { fetchFn: fakeExpo().fetchFn });
  assert.equal(r.initialized, true);
  assert.equal([...store.docs.keys()].filter((k) => k.startsWith('notification_queue/')).length, 0);
  assert.ok((await store.get('settings/notificationEngine')).cursor.testimonyAt);
});

await test('new content is queued for approval and not sent until an admin approves it', async () => {
  const store = world({ extra: { 'testimonies/t1': { title: 'Healing in Lagos', isPublished: true, publishedAt: new Date(NOW - H) } } });
  const { fetchFn, calls } = fakeExpo();
  const r = await run(store, { fetchFn });
  assert.equal(r.queued.queued, 1);
  const entry = await queueEntry(store, 'testimony:t1:all:push');
  assert.equal(entry.status, 'pending');
  assert.equal(entry.title, 'NEW TESTIMONY AVAILABLE');
  assert.equal(entry.body, 'Healing in Lagos is now available to watch.');
  assert.equal(calls.sends.length, 0, 'nothing is sent before approval');
});

await test('after approval, only people opted in receive it, and it is never sent twice', async () => {
  const store = world({
    devices: [device('a', 'a1'), device('b', 'b1', { prefs: { ...device('b').prefs, testimonies: false } })],
    extra: { 'testimonies/t1': { title: 'Healing in Lagos', isPublished: true, publishedAt: new Date(NOW - H) } },
  });
  const { fetchFn, calls } = fakeExpo();
  await run(store, { fetchFn });
  await store.update('notification_queue/testimony:t1:all:push', { status: 'approved' });
  const r = await run(store, { fetchFn });
  assert.deepEqual(calls.messages, [token('a1')]);
  assert.equal(r.sent.counts.sent, 1);
  assert.equal((await queueEntry(store, 'testimony:t1:all:push')).status, 'sent');
  assert.equal((await store.get('notification_history/testimony_t1_all_push')).sent, 1);
  assert.equal((await store.get('notificationCounters/a')).total, 1, 'send counted for the cap');

  // A later run, and a reset cursor that re-detects the same story, must not send it again.
  await run(store, { fetchFn });
  await store.set('settings/notificationEngine', { cursor: { testimonyAt: DAY_AGO, articleAt: DAY_AGO, lyricalAt: DAY_AGO, liveSession: null } }, { merge: true });
  const again = await run(store, { fetchFn });
  assert.equal(again.queued.duplicate, 1);
  assert.deepEqual(calls.messages, [token('a1')], 'still exactly one message');
});

await test('the message payload carries the real content id for the app to open', async () => {
  const store = world({ extra: { 'testimonies/t9': { title: 'Peace', isPublished: true, publishedAt: new Date(NOW - H) } } });
  const { fetchFn, calls } = fakeExpo();
  await run(store, { fetchFn });
  await store.update('notification_queue/testimony:t9:all:push', { status: 'approved' });
  await run(store, { fetchFn });
  const msg = calls.sends[0][0];
  assert.deepEqual(msg.data, { type: 'testimony', contentId: 't9' });
  assert.equal(msg.priority, 'high');
});

// ---------------- quiet hours and caps ----------------
await test('a person in quiet hours is deferred, then receives it after quiet hours end', async () => {
  const lateNight = Date.UTC(2026, 10, 18, 22, 0); // 23:00 local
  const store = world({
    devices: [device('night', 'n1')],
    extra: { 'testimonies/t2': { title: 'Night prayer', isPublished: true, publishedAt: new Date(lateNight - H) } },
  });
  const { fetchFn, calls } = fakeExpo();
  await runEngine({ store, sleep: noSleep, now: lateNight, fetchFn });
  await store.update('notification_queue/testimony:t2:all:push', { status: 'approved' });
  const first = await runEngine({ store, sleep: noSleep, now: lateNight, fetchFn });
  assert.equal(calls.messages.length, 0);
  assert.equal(first.sent.counts.deferred, 1);
  assert.equal((await store.get('notification_deliveries/testimony_t2_all_push__night')).status, 'deferred');

  const morning = Date.UTC(2026, 10, 19, 6, 30); // 07:30 local
  const second = await runEngine({ store, sleep: noSleep, now: morning, fetchFn });
  assert.deepEqual(calls.messages, [token('n1')]);
  assert.equal(second.sent.counts.sent, 1);
});

await test('a person over the daily cap is recorded as capped and never sent it later', async () => {
  const store = world({
    devices: [device('a', 'a1')],
    extra: {
      'testimonies/t3': { title: 'Faith', isPublished: true, publishedAt: new Date(NOW - H) },
      'notificationCounters/a': { windowStart: new Date(NOW - H), total: 3, byCategory: { testimonies: 3 } },
    },
  });
  const { fetchFn, calls } = fakeExpo();
  await run(store, { fetchFn });
  await store.update('notification_queue/testimony:t3:all:push', { status: 'approved' });
  const r = await run(store, { fetchFn });
  assert.equal(r.sent.counts.capped, 1);
  assert.equal(calls.messages.length, 0);
  // Two days later the cap has reset, but the record is final: the old notice is not sent late.
  await run(store, { fetchFn, now: NOW + 48 * H });
  assert.equal(calls.messages.length, 0);
});

// ---------------- failures ----------------
await test('a dead device token is removed, and a person with no live device is recorded', async () => {
  const store = world({
    devices: [device('gone', 'dead1')],
    extra: { 'testimonies/t4': { title: 'Joy', isPublished: true, publishedAt: new Date(NOW - H) } },
  });
  const { fetchFn } = fakeExpo((e) => (e.type === 'message' && e.to === token('dead1') ? { error: 'DeviceNotRegistered' } : null));
  await run(store, { fetchFn });
  await store.update('notification_queue/testimony:t4:all:push', { status: 'approved' });
  const r = await run(store, { fetchFn });
  assert.equal(r.sent.counts.no_device, 1);
  assert.equal(r.sent.removed, 1);
  assert.equal(await store.get(`pushTokens/${token('dead1')}`), null, 'token deleted');
  assert.equal((await queueEntry(store, 'testimony:t4:all:push')).status, 'failed', 'nobody reached, so the entry is failed');
});

await test('a transient outage is retried, and gives up after three attempts', async () => {
  const store = world({
    extra: { 'testimonies/t5': { title: 'Hope', isPublished: true, publishedAt: new Date(NOW - H) } },
  });
  const { fetchFn } = fakeExpo((e) => (e.type === 'send' ? { http: 503 } : null));
  await run(store, { fetchFn });
  await store.update('notification_queue/testimony:t5:all:push', { status: 'approved' });
  const first = await run(store, { fetchFn });
  assert.equal(first.sent.counts.failed, 1);
  assert.equal((await store.get('notification_deliveries/testimony_t5_all_push__a')).attempts, 1);
  await run(store, { fetchFn });
  await run(store, { fetchFn });
  const delivery = await store.get('notification_deliveries/testimony_t5_all_push__a');
  assert.equal(delivery.attempts, 3);
  assert.equal((await queueEntry(store, 'testimony:t5:all:push')).status, 'failed');
});

await test('a recovered outage delivers exactly once', async () => {
  const store = world({ extra: { 'testimonies/t6': { title: 'Grace', isPublished: true, publishedAt: new Date(NOW - H) } } });
  let down = true;
  const { fetchFn, calls } = fakeExpo((e) => (down && e.type === 'send' ? { http: 503 } : null));
  await run(store, { fetchFn });
  await store.update('notification_queue/testimony:t6:all:push', { status: 'approved' });
  await run(store, { fetchFn });
  down = false;
  await run(store, { fetchFn });
  await run(store, { fetchFn });
  assert.equal(calls.messages.filter((t) => t === token('a1')).length, 1);
});

await test('delivery receipts record errors and remove the dead token', async () => {
  const store = world({
    devices: [device('a', 'a1'), device('b', 'b1')],
    extra: { 'testimonies/t7': { title: 'Light', isPublished: true, publishedAt: new Date(NOW - H) } },
  });
  // The second message gets ticket-2; Expo later reports that its device is not registered.
  const { fetchFn } = fakeExpo((e) => (e.type === 'receipt' && e.id === 'ticket-2' ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : null));
  await run(store, { fetchFn });
  await store.update('notification_queue/testimony:t7:all:push', { status: 'approved' });
  const r = await run(store, { fetchFn });
  assert.equal(r.sent.counts.sent, 2);
  assert.equal(r.receipts.checked, 2);
  assert.equal(r.receipts.delivered, 1);
  assert.equal(r.receipts.errors, 1);
  assert.equal(r.receipts.removed, 1);
  assert.equal(await store.get(`pushTokens/${token('b1')}`), null, 'the dead device is removed');
  assert.ok(await store.get(`pushTokens/${token('a1')}`), 'the live device is kept');
  assert.equal((await store.get('notification_deliveries/testimony_t7_all_push__b')).receiptStatus, 'error');
});

// ---------------- live, copy, lock, kill switch ----------------
await test('a live broadcast is queued once per session', async () => {
  const store = world({ extra: { 'settings/live': { isLive: true, sessionId: 'sess-42', title: 'Sunday Service' } } });
  const first = await run(store, { fetchFn: fakeExpo().fetchFn });
  assert.equal(first.queued.queued, 1);
  const entry = await queueEntry(store, 'live:sess-42:all:push');
  assert.equal(entry.title, 'WE ARE LIVE');
  assert.equal(entry.body, 'Sunday Service is live now. Join the broadcast.');
  const second = await run(store, { fetchFn: fakeExpo().fetchFn });
  assert.equal(second.candidates, 0);
});

await test('AI copy is used only when it passes validation; otherwise the template is used', async () => {
  const store = new MemoryStore();
  const candidate = { type: 'testimony', contentId: 'c1', title: 'Healing in Lagos' };
  const bad = await enqueueCandidate(store, candidate, { now: NOW, propose: async () => ({ title: 'NEW', body: 'Healing in Lagos at 3 PM, last chance', category: 'testimonies' }) });
  assert.equal(bad.status, 'queued');
  assert.equal((await queueEntry(store, 'testimony:c1:all:push')).copySource, 'template');

  const store2 = new MemoryStore();
  await enqueueCandidate(store2, candidate, { now: NOW, propose: async () => ({ title: 'Something to hear', body: 'Healing in Lagos is ready to watch.', category: 'testimonies' }) });
  assert.equal((await queueEntry(store2, 'testimony:c1:all:push')).copySource, 'ai');
});

await test('an AI proposal that throws does not stop the queue entry', async () => {
  const store = new MemoryStore();
  const r = await enqueueCandidate(store, { type: 'article', contentId: 'a1', title: 'Prayer basics' }, { now: NOW, propose: async () => { throw new Error('praxiom down'); } });
  assert.equal(r.status, 'queued');
  assert.equal((await queueEntry(store, 'article:a1:all:push')).copySource, 'template');
});

await test('a held lock stops an overlapping run', async () => {
  const store = world({ extra: { 'notificationLocks/engine': { expiresAt: new Date(NOW + H) } } });
  const r = await run(store, { fetchFn: fakeExpo().fetchFn });
  assert.equal(r.skipped, 'locked');
});

await test('an expired lock is taken over, and released after the run', async () => {
  const store = world({ extra: { 'notificationLocks/engine': { expiresAt: new Date(NOW - H) } } });
  const r = await run(store, { fetchFn: fakeExpo().fetchFn });
  assert.ok(!r.skipped);
  assert.equal(await store.get('notificationLocks/engine'), null);
});

await test('with the kill switch off nothing runs, and a switch flipped mid-run stops sending', async () => {
  const off = world({ settings: { ...quietSettings, enabled: false }, extra: { 'testimonies/t8': { title: 'Kindness', isPublished: true, publishedAt: new Date(NOW - H) } } });
  assert.equal((await run(off, { fetchFn: fakeExpo().fetchFn })).skipped, 'engine_disabled');
  assert.equal([...off.docs.keys()].filter((k) => k.startsWith('notification_queue/')).length, 0);

  const store = world({ extra: { 'testimonies/t8': { title: 'Kindness', isPublished: true, publishedAt: new Date(NOW - H) } } });
  const { fetchFn, calls } = fakeExpo();
  await run(store, { fetchFn });
  await store.update('notification_queue/testimony:t8:all:push', { status: 'approved' });
  await store.set('settings/notifications', { ...quietSettings, enabled: false });
  await run(store, { fetchFn });
  assert.equal(calls.messages.length, 0);
});

await test('a category switched off in settings is not sent, and the rest of the engine keeps working', async () => {
  const store = world({
    settings: { ...quietSettings, categories: { articles: { enabled: false } } },
    extra: { 'articles/ar1': { title: 'Prayer basics', isPublished: true, publishedAt: new Date(NOW - H) } },
  });
  const { fetchFn, calls } = fakeExpo();
  await run(store, { fetchFn });
  await store.update('notification_queue/article:ar1:all:push', { status: 'approved' });
  const r = await run(store, { fetchFn });
  assert.equal(calls.messages.length, 0);
  assert.equal(r.sent.stopped, 'category_disabled');
});

await test('settings fail closed and fall back to safe defaults', async () => {
  assert.equal(effectiveSettings(undefined).enabled, false);
  assert.equal(effectiveSettings({ enabled: 'yes' }).enabled, false);
  const s = effectiveSettings({ enabled: true, quietHours: { startMin: 'x' }, maxPerDay: -1 });
  assert.deepEqual(s.quietHours, { enabled: true, startMin: 22 * 60, endMin: 7 * 60 });
  assert.equal(s.caps.maxPerDay, 3);
});

// ---------------- Firestore REST encoding and service auth ----------------
await test('Firestore values round-trip through the REST encoding', async () => {
  const when = new Date(NOW);
  const data = { s: 'x', n: 5, f: 1.5, b: true, z: null, d: when, arr: ['a', 2], map: { k: false } };
  const back = decodeValue({ mapValue: { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encodeValue(v)])) } });
  assert.deepEqual(back, data);
});

await test('a create with a precondition returns false when the document exists', async () => {
  const replies = [new Response('{"error":{"status":"FAILED_PRECONDITION"}}', { status: 400 })];
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('oauth2')) return Response.json({ access_token: 'tok', expires_in: 3600 });
    return replies.shift();
  };
  const sa = await makeServiceAccount();
  clearGoogleTokenCache();
  const rest = new FirestoreRest({ serviceAccount: sa, projectId: 'demo-top', fetchFn });
  assert.equal(await rest.create('notification_queue/k1', { status: 'pending' }), false);
  const commit = calls.find((c) => c.url.endsWith(':commit'));
  const body = JSON.parse(commit.init.body);
  assert.deepEqual(body.writes[0].currentDocument, { exists: false }, 'precondition sent');
  assert.equal(commit.init.headers.Authorization, 'Bearer tok');
});

await test('an update sends an update mask and requires the document to exist', async () => {
  let body;
  const fetchFn = async (url, init) => {
    if (url.includes('oauth2')) return Response.json({ access_token: 'tok2', expires_in: 3600 });
    body = JSON.parse(init.body);
    return Response.json({});
  };
  const rest = new FirestoreRest({ serviceAccount: await makeServiceAccount(), projectId: 'demo-top', fetchFn, tokenFn: async () => 'tok2' });
  await rest.update('notification_queue/k2', { status: 'sent' });
  assert.deepEqual(body.writes[0].updateMask, { fieldPaths: ['status'] });
  assert.deepEqual(body.writes[0].currentDocument, { exists: true });
  assert.ok(body.writes[0].update.name.endsWith('/documents/notification_queue/k2'));
});

await test('the service-account assertion is a valid RS256 JWT for the Google token endpoint', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pem = await pemFromKey(pair.privateKey);
  const sa = JSON.stringify({ client_email: 'engine@demo-top.iam.gserviceaccount.com', private_key: pem });
  const jwt = await signAssertion(sa, 'https://www.googleapis.com/auth/datastore', NOW);
  const [h, p, s] = jwt.split('.');
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  assert.equal(claims.iss, 'engine@demo-top.iam.gserviceaccount.com');
  assert.equal(claims.aud, GOOGLE_TOKEN_URL);
  assert.equal(claims.exp - claims.iat, 3600);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, Buffer.from(s, 'base64url'), new TextEncoder().encode(`${h}.${p}`));
  assert.equal(ok, true, 'signature verifies');
});

await test('Google access tokens are cached until shortly before they expire', async () => {
  clearGoogleTokenCache();
  let exchanges = 0;
  const fetchFn = async () => {
    exchanges += 1;
    return Response.json({ access_token: `t${exchanges}`, expires_in: 3600 });
  };
  const sa = await makeServiceAccount();
  assert.equal(await getGoogleAccessToken(sa, 'scope-x', { fetchFn, now: NOW }), 't1');
  assert.equal(await getGoogleAccessToken(sa, 'scope-x', { fetchFn, now: NOW + 60 * 1000 }), 't1');
  assert.equal(await getGoogleAccessToken(sa, 'scope-x', { fetchFn, now: NOW + 3600 * 1000 }), 't2');
  assert.equal(exchanges, 2);
});

async function makeServiceAccount() {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  return JSON.stringify({ client_email: 'engine@demo-top.iam.gserviceaccount.com', private_key: await pemFromKey(pair.privateKey) });
}
async function pemFromKey(privateKey) {
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey));
  const b64 = Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n');
  return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`;
}

console.log(`\nengine runs: ${passed} tests passed`);
