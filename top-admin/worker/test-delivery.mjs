/**
 * Tests for admin delivery tests (src/notify/testSend.js): a real campaign through the engine, and a
 * per-person stage report (queued, accepted, provider, receipt, failure).
 *
 *   node test-delivery.mjs
 */
import assert from 'node:assert/strict';
import { runDispatcher } from './src/notify/engine.js';
import { sendTestNotification, testDeliveryStatus, TestInputError } from './src/notify/testSend.js';
import { memoryStore } from './test-memory-store.mjs';

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

const NOW = Date.UTC(2026, 10, 22, 19, 0);
const device = (uid, n, extra = {}) => ({ uid, token: `ExponentPushToken[${n}]`, platform: 'android', prefs: { announcements: false }, updatedAt: NOW, ...extra });
function sender({ expoResult = () => ({ status: 'ok', id: 'tk1' }), receipts = {} } = {}) {
  const sent = [];
  return {
    sent,
    async expo(msgs) { msgs.forEach((m) => sent.push(m)); return msgs.map(expoResult); },
    async fcm(token) { sent.push({ fcm: token }); return { status: 'ok' }; },
    async receipts() { return receipts; },
    async webPush() { return { status: 'ok' }; },
  };
}

await test('no registered device: nothing is sent and the admin is told', async () => {
  const store = memoryStore({ 'users/a': { fullName: 'A' } });
  const out = await sendTestNotification(store, { uid: 'a', adminUid: 'admin', now: NOW });
  assert.equal(out.created, false);
  assert.deepEqual(out.devices, []);
});

await test('unknown users and bad ids are refused', async () => {
  await assert.rejects(sendTestNotification(memoryStore({}), { uid: 'nobody', adminUid: 'admin', now: NOW }), TestInputError);
  await assert.rejects(sendTestNotification(memoryStore({}), { uid: 'bad id!', adminUid: 'admin', now: NOW }), TestInputError);
});

await test('a test reaches the person even with announcements off, and reports accepted + receipt', async () => {
  const store = memoryStore({ 'users/a': { fullName: 'A' }, 'pushTokens/a1': device('a', 'a1'), 'notificationSettings/a': { dailyMax: 1 } });
  const s = sender({ receipts: { tk1: { status: 'ok' } } });
  const out = await sendTestNotification(store, { uid: 'a', adminUid: 'admin', now: NOW });
  assert.equal(out.created, true);
  assert.equal(out.devices.length, 1);
  assert.equal(out.devices[0].provider, 'expo');
  assert.equal(JSON.stringify(out.devices).includes('ExponentPushToken'), false, 'tokens are never returned');
  await runDispatcher(store, s, { now: NOW });
  assert.equal(s.sent.length, 1);
  assert.equal(s.sent[0].title, 'Test notification from Testimonies of Praise');
  const st = await testDeliveryStatus(store, s, out.campaignId);
  assert.equal(st.people.length, 1);
  assert.equal(st.people[0].accepted, true);
  assert.equal(st.people[0].provider, 'expo');
  assert.equal(st.people[0].receipt, 'ok');
});

await test('receipts that are not back yet show as pending; provider errors are reported', async () => {
  const store = memoryStore({ 'users/a': { fullName: 'A' }, 'pushTokens/a1': device('a', 'a1') });
  const out = await sendTestNotification(store, { uid: 'a', adminUid: 'admin', now: NOW });
  await runDispatcher(store, sender(), { now: NOW });
  assert.equal((await testDeliveryStatus(store, sender(), out.campaignId)).people[0].receipt, 'pending');
  const bad = memoryStore({ 'users/b': { fullName: 'B' }, 'pushTokens/b1': device('b', 'b1') });
  const out2 = await sendTestNotification(bad, { uid: 'b', adminUid: 'admin', now: NOW });
  const failing = sender({ expoResult: () => ({ status: 'error', code: 'InvalidCredentials', retryable: false, tokenGone: false }) });
  await runDispatcher(bad, failing, { now: NOW });
  const st = await testDeliveryStatus(bad, failing, out2.campaignId);
  assert.equal(st.people[0].accepted, false);
  assert.equal(st.people[0].error, 'InvalidCredentials');
});

await test('FCM deliveries say a receipt is not available (FCM gives none)', async () => {
  const store = memoryStore({ 'users/a': { fullName: 'A' }, 'pushTokens/a1': device('a', 'a1', { fcmToken: `fcm_a:APA91b${'x'.repeat(40)}` }) });
  const s = sender();
  const out = await sendTestNotification(store, { uid: 'a', adminUid: 'admin', now: NOW });
  assert.equal(out.devices[0].provider, 'fcm');
  await runDispatcher(store, s, { now: NOW });
  const st = await testDeliveryStatus(store, s, out.campaignId);
  assert.equal(st.people[0].accepted, true);
  assert.equal(st.people[0].provider, 'fcm');
  assert.equal(st.people[0].receipt, 'not_available');
});

console.log(`\ndelivery tests: ${passed} tests passed`);
