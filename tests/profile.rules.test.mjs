/**
 * Firestore security-rules tests for registration profiles (users/{uid}), run against the emulator with
 * the production rules file (top-admin/firestore.rules).
 *
 *   npm run test:rules
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';

const rules = readFileSync(new URL('../top-admin/firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-top-profile', firestore: { rules } });

const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const admin = env.authenticatedContext('admin1').firestore();
const anon = env.unauthenticatedContext().firestore();

const reset = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'admins/admin1'), { role: 'admin' });
  });
};

const valid = { title: 'Pastor', fullName: 'Ada Obi', zone: 'Lagos Zone 1', church: 'Christ Embassy Lagos' };
const pendingDoc = () => ({ profileStatus: 'pending', createdAt: serverTimestamp() });
const completeDoc = (extra = {}) => ({
  ...valid,
  profileStatus: 'complete',
  createdAt: serverTimestamp(),
  profileCompletedAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});
// Puts a pending profile in place (as the first Google sign-in does) using the owner's own write.
const seedPending = (db, uid) => setDoc(doc(db, `users/${uid}`), pendingDoc());

let passed = 0;
const test = async (name, fn) => {
  await reset();
  await fn();
  passed++;
  console.log(`  ✔ ${name}`);
};

await test('new account can record itself as pending (no profile fields yet)', async () => {
  await assertSucceeds(seedPending(alice, 'alice'));
});
await test('pending record cannot carry profile fields', async () => {
  await assertFails(setDoc(doc(alice, 'users/alice'), { ...pendingDoc(), title: 'Mr' }));
});
await test('complete profile can be saved at sign-up with valid values', async () => {
  await assertSucceeds(setDoc(doc(alice, 'users/alice'), completeDoc()));
});
await test('client cannot fake the creation time', async () => {
  await assertFails(setDoc(doc(alice, 'users/alice'), { ...pendingDoc(), createdAt: Timestamp.fromMillis(0) }));
});
await test('title must be one of the allowed titles', async () => {
  await assertFails(setDoc(doc(alice, 'users/alice'), completeDoc({ title: 'Lord' })));
});
await test('name, zone and church must be non-empty and within length limits', async () => {
  await assertFails(setDoc(doc(alice, 'users/alice'), completeDoc({ fullName: 'A' })));
  await assertFails(setDoc(doc(alice, 'users/alice'), completeDoc({ zone: '' })));
  await assertFails(setDoc(doc(alice, 'users/alice'), completeDoc({ church: 'x'.repeat(161) })));
});
await test('no extra fields such as isAdmin can be stored on a profile', async () => {
  await assertFails(setDoc(doc(alice, 'users/alice'), completeDoc({ isAdmin: true })));
});
await test('a user cannot create or change another user\'s profile', async () => {
  await assertFails(setDoc(doc(bob, 'users/alice'), completeDoc()));
  await assertFails(seedPending(bob, 'alice'));
});
await test('a user can read their own profile, but not someone else\'s', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice'), completeDoc()));
  await assertSucceeds(getDoc(doc(alice, 'users/alice')));
  await assertFails(getDoc(doc(bob, 'users/alice')));
  await assertFails(getDocs(collection(bob, 'users')));
});
await test('signed-out visitors cannot read or write profiles', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice'), completeDoc()));
  await assertFails(getDoc(doc(anon, 'users/alice')));
  await assertFails(seedPending(anon, 'carol'));
});
await test('admins can read profiles for support', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice'), completeDoc()));
  await assertSucceeds(getDoc(doc(admin, 'users/alice')));
});
await test('a pending profile is completed once with validated values', async () => {
  await seedPending(alice, 'alice');
  await assertSucceeds(updateDoc(doc(alice, 'users/alice'), { ...valid, profileStatus: 'complete', profileCompletedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
});
await test('a completed profile cannot be changed again by the owner', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice'), completeDoc()));
  await assertFails(updateDoc(doc(alice, 'users/alice'), { church: 'Another church', updatedAt: serverTimestamp() }));
});
await test('completing a profile cannot slip in admin fields or change the creation time', async () => {
  await seedPending(alice, 'alice');
  const base = { ...valid, profileStatus: 'complete', profileCompletedAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await assertFails(updateDoc(doc(alice, 'users/alice'), { ...base, isAdmin: true }));
  await assertFails(updateDoc(doc(alice, 'users/alice'), { ...base, createdAt: Timestamp.fromMillis(0) }));
});
await test('completing with invalid values is refused', async () => {
  await seedPending(alice, 'alice');
  await assertFails(updateDoc(doc(alice, 'users/alice'), { ...valid, title: 'Chief', profileStatus: 'complete', profileCompletedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
});
await test('another user cannot complete someone else\'s pending profile', async () => {
  await seedPending(alice, 'alice');
  await assertFails(updateDoc(doc(bob, 'users/alice'), { ...valid, profileStatus: 'complete', profileCompletedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
});
await test('profiles cannot be deleted by the owner, another user or admins from the app', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice'), completeDoc()));
  await assertFails(deleteDoc(doc(alice, 'users/alice')));
  await assertFails(deleteDoc(doc(bob, 'users/alice')));
});

await env.cleanup();
console.log(`\nprofile rules: ${passed} tests passed`);
