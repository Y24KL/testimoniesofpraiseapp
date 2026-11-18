/**
 * Firestore security-rules tests for community reports and the editorial configuration (T.O.P. 2.0, Phase 4).
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const rules = readFileSync(new URL('../top-admin/firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-top-community', firestore: { rules } });
const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const admin = env.authenticatedContext('admin1').firestore();
const anon = env.unauthenticatedContext().firestore();

const reset = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'settings/editorial'), { inspirations: [], updatedAt: new Date() });
    await setDoc(doc(db, 'contentReports/alice_choir_c1'), { reporterUid: 'alice', contentType: 'choir', contentId: 'c1', reason: 'spam', status: 'open', createdAt: new Date() });
  });
};

const report = (uid = 'alice', extra = {}) => ({ reporterUid: uid, contentType: 'choir', contentId: 'c2', reason: 'inappropriate', status: 'open', createdAt: serverTimestamp(), ...extra });
const editorial = (extra = {}) => ({ inspirations: [{ text: 'Be encouraged.' }], radioSchedule: [], featuredIds: { testimony: 't1' }, highlightChoirIds: ['c1'], updatedAt: serverTimestamp(), ...extra });

let passed = 0;
const test = async (name, fn) => {
  await reset();
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

// ---------------- reports ----------------
await test('a signed-in person reports an item once, under the canonical id', async () => {
  await assertSucceeds(setDoc(doc(alice, 'contentReports/alice_choir_c2'), report()));
});

await test('the same person cannot report the same item twice, nor under another id', async () => {
  await assertFails(setDoc(doc(alice, 'contentReports/alice_choir_c1'), report('alice', { contentId: 'c1' })));
  await assertFails(setDoc(doc(alice, 'contentReports/anything'), report()));
});

await test('a report is always filed under the reporter’s own uid, and starts open', async () => {
  await assertFails(setDoc(doc(alice, 'contentReports/bob_choir_c2'), report('bob')));
  await assertFails(setDoc(doc(alice, 'contentReports/alice_choir_c2'), report('alice', { status: 'actioned' })));
});

await test('reports have a fixed type, reason and bounded note', async () => {
  await assertFails(setDoc(doc(alice, 'contentReports/alice_user_c2'), report('alice', { contentType: 'user' })));
  await assertFails(setDoc(doc(alice, 'contentReports/alice_choir_c2'), report('alice', { reason: 'boring' })));
  await assertFails(setDoc(doc(alice, 'contentReports/alice_choir_c2'), report('alice', { note: 'x'.repeat(301) })));
  await assertFails(setDoc(doc(alice, 'contentReports/alice_choir_c2'), report('alice', { email: 'a@b.com' })));
});

await test('report ids must be safe characters only', async () => {
  await assertFails(setDoc(doc(alice, 'contentReports/alice_choir_c2'), report('alice', { contentId: 'a/b' })));
});

await test('reporters read their own reports, and no one else reads them', async () => {
  await assertSucceeds(getDoc(doc(alice, 'contentReports/alice_choir_c1')));
  await assertFails(getDoc(doc(bob, 'contentReports/alice_choir_c1')));
  await assertFails(getDocs(collection(alice, 'contentReports')));
  await assertSucceeds(getDocs(collection(admin, 'contentReports')));
});

await test('an admin can review a report and record who did it, and nothing else', async () => {
  await assertSucceeds(updateDoc(doc(admin, 'contentReports/alice_choir_c1'), { status: 'actioned', reviewedBy: 'admin1', reviewedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(admin, 'contentReports/alice_choir_c1'), { status: 'dismissed', reviewedBy: 'someone', reviewedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(admin, 'contentReports/alice_choir_c1'), { reason: 'hateful', reviewedBy: 'admin1', reviewedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(admin, 'contentReports/alice_choir_c1'), { status: 'deleted', reviewedBy: 'admin1', reviewedAt: serverTimestamp() }));
});

await test('reports cannot be deleted or changed by the reporter', async () => {
  await assertFails(deleteDoc(doc(alice, 'contentReports/alice_choir_c1')));
  await assertFails(deleteDoc(doc(admin, 'contentReports/alice_choir_c1')));
  await assertFails(updateDoc(doc(alice, 'contentReports/alice_choir_c1'), { status: 'dismissed' }));
});

// ---------------- editorial ----------------
await test('signed-in people read the editorial configuration; anonymous visitors do not', async () => {
  await assertSucceeds(getDoc(doc(alice, 'settings/editorial')));
  await assertFails(getDoc(doc(anon, 'settings/editorial')));
});

await test('only admins write the editorial configuration, with allowed fields and server time', async () => {
  await assertSucceeds(setDoc(doc(admin, 'settings/editorial'), editorial()));
  await assertFails(setDoc(doc(alice, 'settings/editorial'), editorial()));
  await assertFails(setDoc(doc(admin, 'settings/editorial'), editorial({ updatedAt: new Date() })));
  await assertFails(setDoc(doc(admin, 'settings/editorial'), editorial({ banner: 'x' })));
  await assertFails(setDoc(doc(admin, 'settings/editorial'), editorial({ featuredIds: { user: 'u1' } })));
  await assertFails(setDoc(doc(admin, 'settings/editorial'), editorial({ highlightChoirIds: Array.from({ length: 7 }, (_, i) => `c${i}`) })));
});

await env.cleanup();
console.log(`community rules: ${passed} tests passed`);
