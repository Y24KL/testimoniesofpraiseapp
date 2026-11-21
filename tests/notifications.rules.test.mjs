/**
 * Firestore security-rules tests for the push-token and analytics collections (audit S2, S3), run against
 * the emulator with the production rules file.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

const rules = readFileSync(new URL('../top-admin/firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-top-notifications', firestore: { rules } });

const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const admin = env.authenticatedContext('admin1').firestore();
const anon = env.unauthenticatedContext().firestore();

const reset = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'pushTokens/existing'), { token: 'ExponentPushToken[existing1]', uid: 'alice', platform: 'android', prefs: { testimonies: true }, updatedAt: new Date() });
  });
};

const TOKEN = 'ExponentPushToken[abc123def456]';
function pushToken(uid = 'alice', extra = {}) {
  return {
    token: TOKEN,
    uid,
    platform: 'android',
    prefs: { testimonies: true, live: false, announcements: true, promotions: true, choirs: true, loveworld: true, articles: true },
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

function event(uid = 'alice', extra = {}) {
  return { event: 'app_open', params: { platform: 'android' }, uid, platform: 'android', ts: serverTimestamp(), ...extra };
}

let passed = 0;
const test = async (name, fn) => {
  await reset();
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

// ---------------- pushTokens ----------------
await test('owner can register a token with the allowed fields', async () => {
  await assertSucceeds(setDoc(doc(alice, 'pushTokens/tok1'), pushToken()));
});

await test('owner can save timezone, UTC offset and app version', async () => {
  await assertSucceeds(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { timeZone: 'Africa/Lagos', utcOffsetMinutes: 60, appVersion: '1.0.9' })));
});

await test('a token the engine marked with credential failures can still be refreshed by its owner', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'pushTokens/tok1'), { ...pushToken(), updatedAt: new Date(), credFailures: 2 }));
  await assertSucceeds(setDoc(doc(alice, 'pushTokens/tok1'), pushToken(), { merge: true }));
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { credFailures: 'many' })));
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { credFailures: 99 })));
});

await test('owner cannot register a token under another uid', async () => {
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('bob')));
});

await test('unknown fields are refused (no privilege smuggling)', async () => {
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { isAdmin: true })));
});

await test('a token that is not an Expo push token is refused', async () => {
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { token: 'https://evil.example/hook' })));
  await assertFails(setDoc(doc(alice, 'pushTokens/tok2'), pushToken('alice', { token: 'short' })));
});

await test('preferences must be booleans and only known categories', async () => {
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { prefs: { testimonies: 'yes' } })));
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { prefs: { testimonies: true, surveillance: true } })));
});

await test('platform is limited to android or ios', async () => {
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { platform: 'web' })));
});

await test('UTC offset must be a bounded integer', async () => {
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { utcOffsetMinutes: 2000 })));
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { utcOffsetMinutes: '60' })));
});

await test('timezone must be a short string', async () => {
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { timeZone: 42 })));
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { timeZone: 'x'.repeat(65) })));
});

await test('updatedAt must be the server time, not a client value', async () => {
  await assertFails(setDoc(doc(alice, 'pushTokens/tok1'), pushToken('alice', { updatedAt: new Date() })));
});

await test('anonymous users cannot register tokens', async () => {
  await assertFails(setDoc(doc(anon, 'pushTokens/tok1'), pushToken()));
});

await test('users cannot list or read tokens; admins can', async () => {
  await assertFails(getDocs(collection(alice, 'pushTokens')));
  await assertFails(getDoc(doc(bob, 'pushTokens/existing')));
  await assertSucceeds(getDocs(collection(admin, 'pushTokens')));
});

await test('owner can delete their own token; others cannot', async () => {
  await assertFails(deleteDoc(doc(bob, 'pushTokens/existing')));
  await assertSucceeds(deleteDoc(doc(alice, 'pushTokens/existing')));
});

// ---------------- analyticsEvents ----------------
await test('signed-in user can record their own event', async () => {
  await assertSucceeds(setDoc(doc(collection(alice, 'analyticsEvents')), event()));
});

await test('an event with no uid is allowed for a signed-in user (matches the app)', async () => {
  await assertSucceeds(setDoc(doc(collection(alice, 'analyticsEvents')), event(null)));
});

await test('an event cannot be recorded under another user', async () => {
  await assertFails(setDoc(doc(collection(alice, 'analyticsEvents')), event('bob')));
});

await test('event names must be short snake_case', async () => {
  await assertFails(setDoc(doc(collection(alice, 'analyticsEvents')), event('alice', { event: 'Bad Name!' })));
  await assertFails(setDoc(doc(collection(alice, 'analyticsEvents')), event('alice', { event: 'x'.repeat(60) })));
});

await test('params must be a bounded map', async () => {
  await assertFails(setDoc(doc(collection(alice, 'analyticsEvents')), event('alice', { params: 'free text' })));
  const tooMany = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, i]));
  await assertFails(setDoc(doc(collection(alice, 'analyticsEvents')), event('alice', { params: tooMany })));
});

await test('events accept only the allowed fields', async () => {
  await assertFails(setDoc(doc(collection(alice, 'analyticsEvents')), event('alice', { notes: 'anything' })));
});

await test('timestamps must be the server time', async () => {
  await assertFails(setDoc(doc(collection(alice, 'analyticsEvents')), event('alice', { ts: new Date() })));
});

await test('anonymous users cannot write events', async () => {
  await assertFails(setDoc(doc(collection(anon, 'analyticsEvents')), event(null)));
});

await test('users cannot read events; admins can', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'analyticsEvents/e1'), { event: 'app_open', params: {}, uid: 'alice', platform: 'android', ts: new Date() });
  });
  await assertFails(getDocs(collection(alice, 'analyticsEvents')));
  await assertSucceeds(getDocs(collection(admin, 'analyticsEvents')));
});

await env.cleanup();
console.log(`notifications rules: ${passed} tests passed`);
