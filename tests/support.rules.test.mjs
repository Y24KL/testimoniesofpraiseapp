/**
 * Firestore rules tests for User Communication & Support (supportThreads and their messages), run against
 * the emulator with the production rules file.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const rules = readFileSync(new URL('../top-admin/firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-top-support', firestore: { rules } });

const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const admin = env.authenticatedContext('admin1').firestore();
const anon = env.unauthenticatedContext().firestore();

const T = 'supportThreads/th1';
const reset = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin1'), { role: 'admin' });
    await setDoc(doc(db, T), { uid: 'alice', subject: 'Choir request', category: 'choir_request', status: 'awaiting_user', unreadForUser: 1, unreadForAdmin: 0, messageCount: 1, lastSender: 'admin', lastMessagePreview: 'Please send a new link', lastMessageAt: new Date(), updatedAt: new Date(), createdAt: new Date() });
    await setDoc(doc(db, `${T}/messages/m1`), { senderType: 'admin', senderUid: 'admin1', body: 'Please send a new link', createdAt: new Date(), readAt: null });
    await setDoc(doc(db, `${T}/messages/u0`), { senderType: 'user', senderUid: 'alice', body: 'Earlier reply', createdAt: new Date(), readAt: null });
  });
};

let passed = 0;
const test = async (name, fn) => {
  await reset();
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

const reply = (db, uid = 'alice', msg = {}, thread = {}) => {
  const b = writeBatch(db);
  b.set(doc(db, `${T}/messages/r1`), { senderType: 'user', senderUid: uid, body: 'Thank you, I have replaced the link.', createdAt: serverTimestamp(), readAt: null, ...msg });
  b.update(doc(db, T), { lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp(), lastSender: 'user', status: 'awaiting_admin', lastMessagePreview: 'Thank you, I have replaced the link.', unreadForAdmin: increment(1), messageCount: increment(1), ...thread });
  return b.commit();
};

// ---------------- privacy ----------------
await test('a person reads only their own conversations and messages', async () => {
  await assertSucceeds(getDoc(doc(alice, T)));
  await assertSucceeds(getDocs(collection(alice, `${T}/messages`)));
  await assertSucceeds(getDocs(query(collection(alice, 'supportThreads'), where('uid', '==', 'alice'))));
  await assertFails(getDoc(doc(bob, T)));
  await assertFails(getDocs(collection(bob, `${T}/messages`)));
  await assertFails(getDocs(collection(bob, 'supportThreads')));
  await assertFails(getDoc(doc(anon, T)));
});

await test('admins read every conversation', async () => {
  await assertSucceeds(getDocs(collection(admin, 'supportThreads')));
  await assertSucceeds(getDocs(collection(admin, `${T}/messages`)));
});

await test('nobody creates or deletes conversations or messages from the app (the Worker does)', async () => {
  await assertFails(setDoc(doc(admin, 'supportThreads/th2'), { uid: 'alice', subject: 'x' }));
  await assertFails(setDoc(doc(alice, 'supportThreads/th2'), { uid: 'alice', subject: 'x' }));
  await assertFails(setDoc(doc(admin, `${T}/messages/a2`), { senderType: 'admin', senderUid: 'admin1', body: 'x', createdAt: serverTimestamp(), readAt: null }));
  await assertFails(deleteDoc(doc(admin, T)));
  await assertFails(deleteDoc(doc(alice, `${T}/messages/m1`)));
});

// ---------------- replies ----------------
await test('the owner replies as themselves, updating the conversation in the same batch', async () => {
  await assertSucceeds(reply(alice));
});

await test('a reply cannot pretend to be the admin team or someone else', async () => {
  await assertFails(reply(alice, 'alice', { senderType: 'admin' }));
  await assertFails(reply(alice, 'bob'));
  await assertFails(reply(bob, 'bob'));
});

await test('a reply needs the conversation update, server time, a sensible length and no extra fields', async () => {
  await assertFails(setDoc(doc(alice, `${T}/messages/r1`), { senderType: 'user', senderUid: 'alice', body: 'Hi', createdAt: serverTimestamp(), readAt: null }));
  await assertFails(reply(alice, 'alice', { createdAt: new Date() }));
  await assertFails(reply(alice, 'alice', { body: '' }));
  await assertFails(reply(alice, 'alice', { body: 'x'.repeat(2001) }));
  await assertFails(reply(alice, 'alice', { action: { label: 'x', url: 'https://evil.example' } }));
});

await test('the conversation update cannot reset counters, resolve it or change who it belongs to', async () => {
  await assertFails(reply(alice, 'alice', {}, { status: 'resolved' }));
  await assertFails(reply(alice, 'alice', {}, { unreadForAdmin: 0 }));
  await assertFails(reply(alice, 'alice', {}, { uid: 'bob' }));
  await assertFails(reply(alice, 'alice', {}, { subject: 'Changed' }));
});

// ---------------- read receipts ----------------
await test('the owner marks admin messages read and clears their unread count, nothing else', async () => {
  await assertSucceeds(updateDoc(doc(alice, `${T}/messages/m1`), { readAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(alice, T), { unreadForUser: 0 }));
  await assertFails(updateDoc(doc(alice, `${T}/messages/u0`), { readAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(alice, `${T}/messages/m1`), { body: 'edited' }));
  await assertFails(updateDoc(doc(alice, T), { unreadForUser: 5 }));
  await assertFails(updateDoc(doc(bob, `${T}/messages/m1`), { readAt: serverTimestamp() }));
});

await test('admins mark user messages read, change status and resolve with their own id', async () => {
  await assertSucceeds(updateDoc(doc(admin, `${T}/messages/u0`), { readAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(admin, `${T}/messages/m1`), { readAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(admin, T), { status: 'resolved', resolvedAt: serverTimestamp(), resolvedBy: 'admin1', updatedAt: serverTimestamp() }));
  await reset();
  await assertFails(updateDoc(doc(admin, T), { status: 'resolved', resolvedAt: serverTimestamp(), resolvedBy: 'someone' }));
  await assertFails(updateDoc(doc(admin, T), { status: 'closed' }));
  await assertFails(updateDoc(doc(admin, T), { uid: 'bob' }));
  await assertFails(updateDoc(doc(admin, T), { lastMessagePreview: 'rewritten' }));
});

await test('people cannot change a conversation’s status themselves', async () => {
  await assertFails(updateDoc(doc(alice, T), { status: 'resolved' }));
});

await env.cleanup();
console.log(`support rules: ${passed} tests passed`);
