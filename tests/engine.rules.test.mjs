/**
 * Firestore security-rules tests for the notification engine collections and personal discovery data
 * (T.O.P. 2.0, Phase 1), run against the emulator with the production rules file.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const rules = readFileSync(new URL('../top-admin/firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-top-engine', firestore: { rules } });

const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const admin = env.authenticatedContext('admin1').firestore();
const anon = env.unauthenticatedContext().firestore();

const reset = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'settings/notifications'), { enabled: false, updatedAt: new Date() });
    await setDoc(doc(db, 'notification_queue/testimony:t1:all:push'), { status: 'pending', title: 'NEW TESTIMONY', body: 'Healing from Lagos', category: 'testimonies', type: 'testimony', contentId: 't1' });
    await setDoc(doc(db, 'notification_queue/live:s1:all:push'), { status: 'approved', decidedBy: 'admin1', decidedAt: new Date(), title: 'WE ARE LIVE', body: 'Join now', category: 'live', type: 'live', contentId: 's1' });
    await setDoc(doc(db, 'notification_history/h1'), { type: 'testimony', sent: 3 });
    await setDoc(doc(db, 'settings/notificationEngine'), { cursor: {} });
    await setDoc(doc(db, 'notificationCounters/alice'), { total: 1 });
    await setDoc(doc(db, 'users/alice/private/discovery'), { interests: ['healing'], optOut: false, updatedAt: new Date() });
  });
};

const activity = (uid = 'alice', extra = {}) => ({ uid, type: 'view', contentType: 'testimony', contentId: 't1', ts: serverTimestamp(), source: 'home', ...extra });
const discovery = (extra = {}) => ({ interests: ['healing', 'worship'], optOut: false, updatedAt: serverTimestamp(), ...extra });

let passed = 0;
const test = async (name, fn) => {
  await reset();
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

// ---------------- notification queue ----------------
await test('an admin can approve a pending entry', async () => {
  await assertSucceeds(updateDoc(doc(admin, 'notification_queue/testimony:t1:all:push'), { status: 'approved', decidedBy: 'admin1', decidedAt: serverTimestamp() }));
});

await test('an admin can cancel a pending or approved entry', async () => {
  await assertSucceeds(updateDoc(doc(admin, 'notification_queue/testimony:t1:all:push'), { status: 'cancelled', decidedBy: 'admin1', decidedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(admin, 'notification_queue/live:s1:all:push'), { status: 'cancelled', decidedBy: 'admin1', decidedAt: serverTimestamp() }));
});

await test('an admin cannot change the message, audience or recipient of an entry', async () => {
  await assertFails(updateDoc(doc(admin, 'notification_queue/testimony:t1:all:push'), { status: 'approved', decidedBy: 'admin1', decidedAt: serverTimestamp(), body: 'Changed copy' }));
});

await test('approval must be recorded as the deciding admin, at server time', async () => {
  await assertFails(updateDoc(doc(admin, 'notification_queue/testimony:t1:all:push'), { status: 'approved', decidedBy: 'someone', decidedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(admin, 'notification_queue/testimony:t1:all:push'), { status: 'approved', decidedBy: 'admin1', decidedAt: new Date() }));
});

await test('an approved entry cannot go back to pending or be re-approved', async () => {
  await assertFails(updateDoc(doc(admin, 'notification_queue/live:s1:all:push'), { status: 'pending', decidedBy: 'admin1', decidedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(admin, 'notification_queue/live:s1:all:push'), { status: 'approved', decidedBy: 'admin1', decidedAt: serverTimestamp() }));
});

await test('clients cannot create or delete queue entries, and non-admins cannot read them', async () => {
  await assertFails(setDoc(doc(admin, 'notification_queue/forged'), { status: 'approved', title: 'x' }));
  await assertFails(deleteDoc(doc(admin, 'notification_queue/testimony:t1:all:push')));
  await assertFails(getDoc(doc(alice, 'notification_queue/testimony:t1:all:push')));
  await assertFails(updateDoc(doc(alice, 'notification_queue/testimony:t1:all:push'), { status: 'approved', decidedBy: 'alice', decidedAt: serverTimestamp() }));
});

// ---------------- settings and state ----------------
await test('an admin can flip the kill switch with a bool and server time', async () => {
  await assertSucceeds(setDoc(doc(admin, 'settings/notifications'), { enabled: true, updatedAt: serverTimestamp() }));
});

await test('the kill switch must be a boolean and carry server time', async () => {
  await assertFails(setDoc(doc(admin, 'settings/notifications'), { enabled: 'true', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(admin, 'settings/notifications'), { enabled: true, updatedAt: new Date() }));
  await assertFails(setDoc(doc(admin, 'settings/notifications'), { enabled: true, updatedAt: serverTimestamp(), surveillance: 'on' }));
});

await test('only admins read the kill switch; nobody else can change it', async () => {
  await assertFails(getDoc(doc(alice, 'settings/notifications')));
  await assertSucceeds(getDoc(doc(admin, 'settings/notifications')));
  await assertFails(setDoc(doc(alice, 'settings/notifications'), { enabled: true, updatedAt: serverTimestamp() }));
});

await test('engine cursors are server-only, even for admins', async () => {
  await assertSucceeds(getDoc(doc(admin, 'settings/notificationEngine')));
  await assertFails(setDoc(doc(admin, 'settings/notificationEngine'), { cursor: { x: 1 } }));
});

await test('history and AI logs are readable by admins only and never written by clients', async () => {
  await assertSucceeds(getDocs(collection(admin, 'notification_history')));
  await assertFails(getDocs(collection(alice, 'notification_history')));
  await assertFails(setDoc(doc(admin, 'notification_history/h2'), { sent: 999 }));
  await assertFails(setDoc(doc(admin, 'ai_requests/r1'), { purpose: 'copy' }));
});

await test('delivery records are readable by admins only and never written by clients', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'notification_deliveries/q__alice'), { queueKey: 'q', uid: 'alice', status: 'sent' });
  });
  await assertSucceeds(getDocs(collection(admin, 'notification_deliveries')));
  await assertFails(getDocs(collection(alice, 'notification_deliveries')));
  await assertFails(setDoc(doc(admin, 'notification_deliveries/forged'), { status: 'sent' }));
});

await test('the engine run lock is invisible to clients', async () => {
  await assertFails(getDoc(doc(admin, 'notificationLocks/engine')));
  await assertFails(setDoc(doc(admin, 'notificationLocks/engine'), { expiresAt: new Date() }));
});

await test('frequency counters are never readable or writable by clients', async () => {
  await assertFails(getDoc(doc(alice, 'notificationCounters/alice')));
  await assertFails(getDoc(doc(admin, 'notificationCounters/alice')));
  await assertFails(setDoc(doc(alice, 'notificationCounters/alice'), { total: 0 }));
});

// ---------------- user activity ----------------
await test('a signed-in user records their own activity with allowed fields', async () => {
  await assertSucceeds(setDoc(doc(collection(alice, 'user_activity')), activity()));
});

await test('activity cannot be recorded for another person', async () => {
  await assertFails(setDoc(doc(collection(alice, 'user_activity')), activity('bob')));
});

await test('activity types and content types are fixed lists', async () => {
  await assertFails(setDoc(doc(collection(alice, 'user_activity')), activity('alice', { type: 'purchase' })));
  await assertFails(setDoc(doc(collection(alice, 'user_activity')), activity('alice', { contentType: 'user' })));
});

await test('activity carries no extra fields (no free text, no device data)', async () => {
  await assertFails(setDoc(doc(collection(alice, 'user_activity')), activity('alice', { email: 'a@b.com' })));
});

await test('activity time must be server time', async () => {
  await assertFails(setDoc(doc(collection(alice, 'user_activity')), activity('alice', { ts: new Date() })));
});

await test('users read and delete only their own activity; no edits', async () => {
  const id = 'act1';
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), `user_activity/${id}`), { uid: 'alice', type: 'view', contentType: 'testimony', contentId: 't1', ts: new Date(), source: 'home' }));
  await assertSucceeds(getDoc(doc(alice, `user_activity/${id}`)));
  await assertFails(getDoc(doc(bob, `user_activity/${id}`)));
  await assertFails(updateDoc(doc(alice, `user_activity/${id}`), { type: 'save' }));
  await assertSucceeds(deleteDoc(doc(alice, `user_activity/${id}`)));
});

await test('anonymous users cannot record activity', async () => {
  await assertFails(setDoc(doc(collection(anon, 'user_activity')), activity(null)));
});

// ---------------- personal discovery settings ----------------
await test('the owner saves interests and an opt-out', async () => {
  await assertSucceeds(setDoc(doc(alice, 'users/alice/private/discovery'), discovery()));
});

await test('nobody else can read or write another person’s interests', async () => {
  await assertFails(getDoc(doc(bob, 'users/alice/private/discovery')));
  await assertFails(setDoc(doc(bob, 'users/alice/private/discovery'), discovery()));
});

await test('discovery documents carry only the allowed fields and types', async () => {
  await assertFails(setDoc(doc(alice, 'users/alice/private/discovery'), discovery({ bio: 'free text' })));
  await assertFails(setDoc(doc(alice, 'users/alice/private/discovery'), discovery({ interests: 'healing' })));
  await assertFails(setDoc(doc(alice, 'users/alice/private/discovery'), discovery({ optOut: 'yes' })));
  await assertFails(setDoc(doc(alice, 'users/alice/private/discovery'), discovery({ updatedAt: new Date() })));
  await assertFails(setDoc(doc(alice, 'users/alice/private/discovery'), discovery({ interests: Array.from({ length: 21 }, (_, i) => `t${i}`) })));
});

await test('the owner can reset (delete) their discovery data', async () => {
  await assertSucceeds(deleteDoc(doc(alice, 'users/alice/private/discovery')));
});

await env.cleanup();
console.log(`engine rules: ${passed} tests passed`);
