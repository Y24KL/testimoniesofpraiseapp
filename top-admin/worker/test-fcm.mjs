/**
 * Tests for direct FCM delivery on Android: notification messages (shown by Android even when the app is
 * asleep), routing in the engine, fallback to Expo, and clean-up of uninstalled apps.
 *
 *   node test-fcm.mjs
 */
import assert from 'node:assert/strict';
import { COL, eventCampaign, runDispatcher } from './src/notify/engine.js';
import { createFcmSender } from './src/notify/senders.js';
import { clearGoogleTokenCache, GOOGLE_TOKEN_URL } from './src/googleAuth.js';
import { memoryStore } from './test-memory-store.mjs';

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

const NOW = Date.UTC(2026, 10, 22, 17, 0);
const FCM = (n) => `fcm_${n}:APA91b${'x'.repeat(40)}`;
const device = (uid, n, extra = {}) => ({ uid, token: `ExponentPushToken[${n}]`, platform: 'android', prefs: { live: true, announcements: true, testimonies: true }, updatedAt: NOW, ...extra });
const live = { type: 'live', title: 'WE ARE LIVE', body: 'Join the service now.', category: 'live' };
async function publish(store, ev, now = NOW) {
  const c = eventCampaign({ contentId: null, ...ev }, now);
  await store.commit([{ col: COL.campaigns, id: c.id, kind: 'create', data: c.data }], false);
}
function sender({ fcmResult = () => ({ status: 'ok' }) } = {}) {
  const expo = [];
  const fcm = [];
  return {
    expoSent: expo,
    fcmSent: fcm,
    async expo(msgs) { msgs.forEach((m) => expo.push(m)); return msgs.map((_, i) => ({ status: 'ok', id: `t${i}` })); },
    async fcm(token, payload) { fcm.push({ token, payload }); return fcmResult(token); },
    async receipts() { return {}; },
    async webPush() { return { status: 'ok' }; },
  };
}

// ---------------- engine routing ----------------
await test('an Android phone with an FCM token gets a notification message, not an Expo data message', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1', { fcmToken: FCM('a') }), 'pushTokens/b1': device('b', 'b1') });
  const s = sender();
  await publish(store, live);
  const rep = await runDispatcher(store, s, { now: NOW });
  assert.deepEqual(s.fcmSent.map((x) => x.token), [FCM('a')]);
  assert.equal(s.fcmSent[0].payload.title, 'WE ARE LIVE');
  assert.equal(s.fcmSent[0].payload.data.type, 'live');
  assert.equal(s.expoSent.length, 1, 'the phone without an FCM token still gets Expo');
  assert.equal(s.expoSent[0].to, 'ExponentPushToken[b1]');
  assert.equal(rep.sent, 2);
});

await test('if FCM fails, the same phone gets the Expo message in the same run', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1', { fcmToken: FCM('a') }) });
  const s = sender({ fcmResult: () => ({ status: 'error', code: 'FCM_INVALID_ARGUMENT', retryable: false, tokenGone: false }) });
  await publish(store, live);
  const rep = await runDispatcher(store, s, { now: NOW });
  assert.equal(s.fcmSent.length, 1);
  assert.equal(s.expoSent.length, 1);
  assert.equal(rep.sent, 1);
  assert.ok(store.doc('pushTokens/a1'), 'the device is kept');
});

await test('an uninstalled app (FCM unregistered) is removed and not sent twice', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1', { fcmToken: FCM('a') }) });
  const s = sender({ fcmResult: () => ({ status: 'error', code: 'FcmUnregistered', retryable: false, tokenGone: true }) });
  await publish(store, live);
  await runDispatcher(store, s, { now: NOW });
  assert.equal(s.expoSent.length, 0);
  assert.equal(store.doc('pushTokens/a1'), null);
});

await test('iPhones and malformed FCM tokens keep using Expo', async () => {
  const store = memoryStore({ 'pushTokens/i1': device('i', 'i1', { platform: 'ios', fcmToken: FCM('i') }), 'pushTokens/x1': device('x', 'x1', { fcmToken: 'bad token <>' }) });
  const s = sender();
  await publish(store, live);
  await runDispatcher(store, s, { now: NOW });
  assert.equal(s.fcmSent.length, 0);
  assert.equal(s.expoSent.length, 2);
});

await test('urgent announcements go through FCM too', async () => {
  const store = memoryStore({ 'pushTokens/a1': device('a', 'a1', { fcmToken: FCM('a') }) });
  const s = sender();
  await publish(store, { type: 'announcement', title: "WE'LL BE LIVE SHORTLY", body: 'Stay tuned.', category: 'announcements', urgent: true });
  await runDispatcher(store, s, { now: NOW });
  assert.equal(s.fcmSent.length, 1);
});

// ---------------- the FCM sender ----------------
async function makeServiceAccount() {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
  return JSON.stringify({ client_email: 'engine@demo.iam.gserviceaccount.com', private_key: pem });
}
const sa = await makeServiceAccount();
function fakeGoogle(fcmResponse) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url) === GOOGLE_TOKEN_URL) return new Response(JSON.stringify({ access_token: 'ya29.test', expires_in: 3600 }), { status: 200 });
    return fcmResponse();
  };
  return { calls, fetchFn };
}

await test('the sender builds a high-priority notification message on the app channel, with string data', async () => {
  clearGoogleTokenCache();
  const g = fakeGoogle(() => new Response('{"name":"projects/p/messages/1"}', { status: 200 }));
  const send = createFcmSender({ FIREBASE_SERVICE_ACCOUNT: sa, FIREBASE_PROJECT_ID: 'demo' }, g.fetchFn);
  const r = await send(FCM('a'), { title: 'WE ARE LIVE', body: 'Join now', data: { type: 'live', contentId: undefined, campaignId: 'c1' } });
  assert.equal(r.status, 'ok');
  const call = g.calls.find((c) => c.url.includes('fcm.googleapis.com'));
  assert.equal(call.url, 'https://fcm.googleapis.com/v1/projects/demo/messages:send');
  assert.equal(call.init.headers.Authorization, 'Bearer ya29.test');
  const { message } = JSON.parse(call.init.body);
  assert.deepEqual(message.notification, { title: 'WE ARE LIVE', body: 'Join now' });
  assert.equal(message.android.priority, 'HIGH');
  assert.equal(message.android.notification.channel_id, 'default');
  assert.equal(message.android.notification.sound, 'default');
  assert.deepEqual(message.data, { type: 'live', campaignId: 'c1' });
  const tokenCall = g.calls.find((c) => c.url === GOOGLE_TOKEN_URL);
  assert.match(String(tokenCall.init.body), /assertion=/);
});

await test('sender errors: uninstalled, retryable outage, and bad requests', async () => {
  clearGoogleTokenCache();
  const unreg = createFcmSender({ FIREBASE_SERVICE_ACCOUNT: sa, FIREBASE_PROJECT_ID: 'demo' }, fakeGoogle(() => new Response(JSON.stringify({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }), { status: 404 })).fetchFn);
  assert.equal((await unreg(FCM('a'), { title: 'T', body: 'B' })).tokenGone, true);
  const down = createFcmSender({ FIREBASE_SERVICE_ACCOUNT: sa, FIREBASE_PROJECT_ID: 'demo' }, fakeGoogle(() => new Response('unavailable', { status: 503 })).fetchFn);
  const d = await down(FCM('a'), { title: 'T', body: 'B' });
  assert.equal(d.retryable, true);
  assert.equal(d.tokenGone, false);
  const bad = createFcmSender({ FIREBASE_SERVICE_ACCOUNT: sa, FIREBASE_PROJECT_ID: 'demo' }, fakeGoogle(() => new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT' } }), { status: 400 })).fetchFn);
  const b = await bad(FCM('a'), { title: 'T', body: 'B' });
  assert.equal(b.code, 'FCM_INVALID_ARGUMENT');
  assert.equal(b.retryable, false);
  const none = createFcmSender({}, async () => { throw new Error('should not call'); });
  assert.equal((await none(FCM('a'), { title: 'T', body: 'B' })).code, 'FcmNotConfigured');
});

console.log(`\ndirect FCM delivery: ${passed} tests passed`);
