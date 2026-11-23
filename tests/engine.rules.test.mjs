/**
 * Firestore security-rules tests for the notification engine collections (worker src/notify) and personal
 * discovery data, run against the emulator with the production rules file.
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
    await setDoc(doc(db, 'settings/notificationEngine'), { enabled: true });
    await setDoc(doc(db, 'notificationCampaigns/ev_testimony_t1'), { status: 'scheduled', title: 'T', body: 'B', category: 'testimonies', dueAt: 1 });
    await setDoc(doc(db, 'notificationCampaigns/ev_live_done'), { status: 'finished', title: 'L', body: 'B', category: 'live' });
    await setDoc(doc(db, 'notificationCampaigns/ev_draft'), { status: 'awaiting_approval', title: 'NEW TESTIMONY', body: 'Template', template: { title: 'NEW TESTIMONY', body: 'Template' }, draft: { title: 'AI title', body: 'AI body' }, category: 'testimonies', copySource: 'template' });
    await setDoc(doc(db, 'notificationQueue/q1'), { uid: 'alice', status: 'scheduled', dueAt: 1 });
    await setDoc(doc(db, 'notificationStats/2026-11-21'), { events: { notification_sent: 3 } });
    await setDoc(doc(db, 'notificationLedger/alice'), { entries: {} });
    await setDoc(doc(db, 'users/alice/private/discovery'), { interests: ['healing'], optOut: false, updatedAt: new Date() });
  });
};

const activity = (uid = 'alice', extra = {}) => ({ uid, type: 'view', contentType: 'testimony', contentId: 't1', ts: serverTimestamp(), source: 'home', ...extra });
const discovery = (extra = {}) => ({ interests: ['healing', 'worship'], optOut: false, updatedAt: serverTimestamp(), ...extra });
const engineCfg = (extra = {}) => ({ enabled: false, updatedAt: serverTimestamp(), updatedBy: 'admin1', ...extra });

let passed = 0;
const test = async (name, fn) => {
  await reset();
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

// ---------------- engine config ----------------
await test('an admin can switch the engine off and change windows and timezone', async () => {
  await assertSucceeds(setDoc(doc(admin, 'settings/notificationEngine'), engineCfg()));
  await assertSucceeds(setDoc(doc(admin, 'settings/notificationEngine'), engineCfg({ enabled: true, windows: [{ time: '08:00', categories: ['dailyPraise'] }], defaultTimezone: 'Africa/Lagos' })));
});

await test('engine config is validated: types, fields, server time and the acting admin', async () => {
  await assertFails(setDoc(doc(admin, 'settings/notificationEngine'), engineCfg({ enabled: 'no' })));
  await assertFails(setDoc(doc(admin, 'settings/notificationEngine'), engineCfg({ cursor: {} })));
  await assertFails(setDoc(doc(admin, 'settings/notificationEngine'), engineCfg({ updatedAt: new Date() })));
  await assertFails(setDoc(doc(admin, 'settings/notificationEngine'), engineCfg({ updatedBy: 'someone' })));
  await assertFails(setDoc(doc(admin, 'settings/notificationEngine'), engineCfg({ windows: Array.from({ length: 13 }, () => ({})) })));
});

await test('non-admins cannot read or change the engine config', async () => {
  await assertFails(getDoc(doc(alice, 'settings/notificationEngine')));
  await assertFails(setDoc(doc(alice, 'settings/notificationEngine'), engineCfg({ updatedBy: 'alice' })));
  await assertFails(getDoc(doc(anon, 'settings/notificationEngine')));
});

// ---------------- campaigns ----------------
await test('an admin can cancel a campaign that has not finished', async () => {
  await assertSucceeds(updateDoc(doc(admin, 'notificationCampaigns/ev_testimony_t1'), { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: 'admin1' }));
});

await test('a finished campaign cannot be cancelled, and nothing else can be edited', async () => {
  await assertFails(updateDoc(doc(admin, 'notificationCampaigns/ev_live_done'), { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: 'admin1' }));
  await assertFails(updateDoc(doc(admin, 'notificationCampaigns/ev_testimony_t1'), { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: 'admin1', title: 'Changed' }));
  await assertFails(updateDoc(doc(admin, 'notificationCampaigns/ev_testimony_t1'), { status: 'scheduled', cancelledAt: serverTimestamp(), cancelledBy: 'admin1' }));
  await assertFails(updateDoc(doc(admin, 'notificationCampaigns/ev_testimony_t1'), { status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'admin1' }));
});

await test('clients cannot create or delete campaigns; users cannot read them', async () => {
  await assertFails(setDoc(doc(admin, 'notificationCampaigns/forged'), { status: 'scheduled', title: 'x' }));
  await assertFails(deleteDoc(doc(admin, 'notificationCampaigns/ev_testimony_t1')));
  await assertSucceeds(getDocs(collection(admin, 'notificationCampaigns')));
  await assertFails(getDocs(collection(alice, 'notificationCampaigns')));
  await assertFails(updateDoc(doc(alice, 'notificationCampaigns/ev_testimony_t1'), { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: 'alice' }));
});

// ---------------- Praxiom drafts: approval and settings ----------------
const approval = (extra = {}) => ({ status: 'scheduled', dueAt: 0, title: 'AI title', body: 'AI body', copySource: 'ai', approvedBy: 'admin1', approvedAt: serverTimestamp(), ...extra });

await test('an admin can approve a draft with the AI text, an edited text or the template', async () => {
  await assertSucceeds(updateDoc(doc(admin, 'notificationCampaigns/ev_draft'), approval()));
  await reset();
  await assertSucceeds(updateDoc(doc(admin, 'notificationCampaigns/ev_draft'), approval({ title: 'Edited', body: 'Edited body', copySource: 'edited' })));
  await reset();
  await assertSucceeds(updateDoc(doc(admin, 'notificationCampaigns/ev_draft'), approval({ title: 'NEW TESTIMONY', body: 'Template', copySource: 'template' })));
});

await test('approval cannot change anything else, schedule for later, or skip its checks', async () => {
  const ref = doc(admin, 'notificationCampaigns/ev_draft');
  await assertFails(updateDoc(ref, approval({ category: 'live' })));
  await assertFails(updateDoc(ref, approval({ dueAt: 99999999999999 })));
  await assertFails(updateDoc(ref, approval({ title: '' })));
  await assertFails(updateDoc(ref, approval({ body: 'x'.repeat(301) })));
  await assertFails(updateDoc(ref, approval({ copySource: 'praxiom' })));
  await assertFails(updateDoc(ref, approval({ approvedBy: 'someone' })));
  await assertFails(updateDoc(ref, approval({ approvedAt: new Date() })));
});

await test('only drafts awaiting approval can be approved; users cannot approve', async () => {
  await assertFails(updateDoc(doc(admin, 'notificationCampaigns/ev_testimony_t1'), approval()));
  await assertFails(updateDoc(doc(alice, 'notificationCampaigns/ev_draft'), approval({ approvedBy: 'alice' })));
});

await test('a draft awaiting approval can be cancelled', async () => {
  await assertSucceeds(updateDoc(doc(admin, 'notificationCampaigns/ev_draft'), { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: 'admin1' }));
});

await test('admins set copy mode, the Praxiom switch and targeting, with allowed values only', async () => {
  await assertSucceeds(setDoc(doc(admin, 'settings/notificationEngine'), engineCfg({ copyMode: 'automatic', aiCopy: false, targeting: 'interested_only' })));
  await assertFails(setDoc(doc(admin, 'settings/notificationEngine'), engineCfg({ copyMode: 'yolo' })));
  await assertFails(setDoc(doc(admin, 'settings/notificationEngine'), engineCfg({ aiCopy: 'on' })));
  await assertFails(setDoc(doc(admin, 'settings/notificationEngine'), engineCfg({ targeting: 'friends' })));
});

// ---------------- queue, stats, ledger ----------------
await test('admins read the queue and stats; nobody writes them', async () => {
  await assertSucceeds(getDocs(collection(admin, 'notificationQueue')));
  await assertSucceeds(getDoc(doc(admin, 'notificationStats/2026-11-21')));
  await assertFails(updateDoc(doc(admin, 'notificationQueue/q1'), { status: 'sent' }));
  await assertFails(setDoc(doc(admin, 'notificationStats/2026-11-21'), { forged: 1 }));
});

await test('users cannot read the queue (it names other people) or the stats', async () => {
  await assertFails(getDoc(doc(alice, 'notificationQueue/q1')));
  await assertFails(getDocs(collection(alice, 'notificationQueue')));
  await assertFails(getDoc(doc(alice, 'notificationStats/2026-11-21')));
});

await test('the send ledger is server only, even for admins and its owner', async () => {
  await assertFails(getDoc(doc(admin, 'notificationLedger/alice')));
  await assertFails(getDoc(doc(alice, 'notificationLedger/alice')));
  await assertFails(setDoc(doc(alice, 'notificationLedger/alice'), { entries: {} }));
});

await test('the retired engine collections are closed', async () => {
  await assertFails(getDocs(collection(admin, 'notification_queue')));
  await assertFails(getDoc(doc(admin, 'settings/notifications')));
  await assertFails(setDoc(doc(admin, 'settings/notifications'), { enabled: true, updatedAt: serverTimestamp() }));
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
