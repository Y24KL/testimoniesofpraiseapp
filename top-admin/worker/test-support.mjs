/**
 * Tests for User Communication & Support (src/support.js): validation, conversations, idempotency, and
 * push delivery through the notification engine to only the recipient's devices.
 *
 *   node test-support.mjs
 */
import assert from 'node:assert/strict';
import { parseAction, parseSendRequest, sendSupportMessage, SupportInputError } from './src/support.js';
import { runDispatcher } from './src/notify/engine.js';
import { memoryStore } from './test-memory-store.mjs';

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

const NOW = Date.UTC(2026, 10, 21, 11, 0);
const tok = (n) => `ExponentPushToken[${n}]`;
const device = (uid, n) => ({ uid, token: tok(n), platform: 'android', prefs: { testimonies: true }, updatedAt: NOW });
const world = (extra = {}) => memoryStore({ 'users/alice': { fullName: 'Alice A' }, 'users/bob': { fullName: 'Bob B' }, 'pushTokens/a1': device('alice', 'a1'), 'pushTokens/a2': device('alice', 'a2'), 'pushTokens/b1': device('bob', 'b1'), ...extra });
const newMsg = (over = {}) => parseSendRequest({ uid: 'alice', clientMessageId: 'key_00000001', subject: 'Action Required – Choir Feature Request', category: 'choir_request', related: { type: 'choir_request', id: 'req1', label: 'Grace Choir' }, body: 'Your ministration link could not be opened. Please send another.', action: { label: 'Update choir submission', route: 'correction/choir/req1' }, ...over });
const fakeSender = () => {
  const sent = [];
  return { sent, async expo(msgs) { msgs.forEach((m) => sent.push(m)); return msgs.map((_, i) => ({ status: 'ok', id: `t${i}` })); }, async receipts() { return {}; }, async webPush() { return { status: 'ok' }; } };
};

// ---------------- validation ----------------
await test('action buttons accept app screens and secure web links only', () => {
  assert.deepEqual(parseAction({ label: 'Open', route: 'choir' }), { label: 'Open', route: 'choir' });
  assert.deepEqual(parseAction({ label: 'Open', route: '/messages/th_1' }), { label: 'Open', route: 'messages/th_1' });
  assert.equal(parseAction({ label: 'Site', url: 'https://example.org/page' }).url, 'https://example.org/page');
  for (const bad of [{ label: 'x', route: 'admin' }, { label: 'x', route: 'choir/../../x' }, { label: 'x', url: 'http://example.org' }, { label: 'x', url: 'javascript:alert(1)' }, { label: 'x', url: 'https://user:pw@example.org' }, { label: '', route: 'choir' }, { label: 'x' }]) {
    assert.throws(() => parseAction(bad), SupportInputError, JSON.stringify(bad));
  }
});

await test('messages are validated: recipient, key, category, length and characters', () => {
  assert.throws(() => newMsg({ uid: 'bad uid!' }), SupportInputError);
  assert.throws(() => newMsg({ clientMessageId: 'x' }), SupportInputError);
  assert.throws(() => newMsg({ category: 'spam' }), SupportInputError);
  assert.throws(() => newMsg({ body: 'x'.repeat(4001) }), SupportInputError);
  assert.throws(() => newMsg({ subject: '' }), SupportInputError);
  assert.throws(() => newMsg({ body: 'bad\u0007bell' }), SupportInputError);
  assert.throws(() => newMsg({ related: { type: 'payments', id: 'x' } }), SupportInputError);
  const reply = parseSendRequest({ uid: 'alice', clientMessageId: 'key_00000002', threadId: 'th_x', body: 'Thanks' });
  assert.equal(reply.threadId, 'th_x');
});

// ---------------- conversations ----------------
await test('a new message creates the conversation, the message and a push campaign', async () => {
  const store = world();
  const out = await sendSupportMessage(store, newMsg(), { adminUid: 'admin1', now: NOW });
  assert.equal(out.created, true);
  const t = store.doc(`supportThreads/${out.threadId}`);
  assert.equal(t.uid, 'alice');
  assert.equal(t.status, 'awaiting_user');
  assert.equal(t.unreadForUser, 1);
  assert.equal(t.related.id, 'req1');
  const m = store.doc(`supportThreads/${out.threadId}/messages/${out.messageId}`);
  assert.equal(m.senderType, 'admin');
  assert.equal(m.senderUid, 'admin1');
  assert.equal(m.action.route, 'correction/choir/req1');
  const c = store.doc(`notificationCampaigns/${out.campaignId}`);
  assert.deepEqual(c.audienceUids, ['alice']);
  assert.equal(c.category, 'messages');
});

await test('sending the same message twice (a retry) creates it once', async () => {
  const store = world();
  await sendSupportMessage(store, newMsg(), { adminUid: 'admin1', now: NOW });
  const again = await sendSupportMessage(store, newMsg(), { adminUid: 'admin1', now: NOW + 1000 });
  assert.equal(again.duplicate, true);
  assert.equal(store.col(`supportThreads/${again.threadId}/messages`).length, 1);
  assert.equal(store.doc(`supportThreads/${again.threadId}`).unreadForUser, 1);
});

await test('a follow-up adds to the same conversation and its unread count', async () => {
  const store = world();
  const first = await sendSupportMessage(store, newMsg(), { adminUid: 'admin1', now: NOW });
  await sendSupportMessage(store, parseSendRequest({ uid: 'alice', clientMessageId: 'key_00000003', threadId: first.threadId, body: 'Just checking in.' }), { adminUid: 'admin1', now: NOW + 60000 });
  const t = store.doc(`supportThreads/${first.threadId}`);
  assert.equal(t.unreadForUser, 2);
  assert.equal(t.messageCount, 2);
  assert.equal(t.lastMessagePreview, 'Just checking in.');
});

await test('a conversation cannot be continued with a different person', async () => {
  const store = world();
  const first = await sendSupportMessage(store, newMsg(), { adminUid: 'admin1', now: NOW });
  await assert.rejects(sendSupportMessage(store, parseSendRequest({ uid: 'bob', clientMessageId: 'key_00000004', threadId: first.threadId, body: 'Hi' }), { adminUid: 'admin1', now: NOW }), SupportInputError);
});

await test('unknown recipients and missing conversations are refused', async () => {
  const store = world();
  await assert.rejects(sendSupportMessage(store, newMsg({ uid: 'nobody' }), { adminUid: 'admin1', now: NOW }), SupportInputError);
  await assert.rejects(sendSupportMessage(store, parseSendRequest({ uid: 'alice', clientMessageId: 'key_00000005', threadId: 'th_missing', body: 'Hi' }), { adminUid: 'admin1', now: NOW }), SupportInputError);
});

// ---------------- push delivery ----------------
await test('the push reaches every device of the recipient and nobody else, without the message text', async () => {
  const store = world();
  const sender = fakeSender();
  await sendSupportMessage(store, newMsg(), { adminUid: 'admin1', now: NOW });
  await runDispatcher(store, sender, { now: NOW });
  assert.deepEqual(sender.sent.map((m) => m.to).sort(), [tok('a1'), tok('a2')]);
  const push = sender.sent[0];
  assert.equal(push.title, 'Message from Testimonies of Praise');
  assert.match(push.body, /about your choir request/);
  assert.equal(push.body.includes('ministration link'), false, 'the message itself is never on the lock screen');
  assert.equal(push.data.type, 'message');
  assert.equal(push.data.contentId, 'th_key_00000001', 'opens the exact conversation');
});

await test('private messages arrive even when the person has reached their daily limit', async () => {
  const store = world({ 'notificationSettings/alice': { dailyMax: 1 }, 'notificationLedger/alice': { entries: { x: { at: NOW - 1000, day: '2026-11-21', key: 'k', cat: 'testimonies', lane: 'normal' } }, uid: 'alice' } });
  const sender = fakeSender();
  await sendSupportMessage(store, newMsg(), { adminUid: 'admin1', now: NOW });
  await runDispatcher(store, sender, { now: NOW });
  assert.equal(sender.sent.length, 2);
});

await test('without a device the message still waits in the inbox', async () => {
  const store = memoryStore({ 'users/alice': { fullName: 'Alice A' } });
  const sender = fakeSender();
  const out = await sendSupportMessage(store, newMsg(), { adminUid: 'admin1', now: NOW });
  await runDispatcher(store, sender, { now: NOW });
  assert.equal(sender.sent.length, 0);
  assert.ok(store.doc(`supportThreads/${out.threadId}/messages/${out.messageId}`));
});

console.log(`\nuser communication: ${passed} tests passed`);
