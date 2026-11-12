/**
 * Firestore security-rules tests for "Feedback & Suggestions" (appFeedback + feedbackRate), run against
 * the emulator with the production rules file.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const rules = readFileSync(new URL('../top-admin/firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-top-feedback', firestore: { rules } });

const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const kingschat = env.authenticatedContext('kc_12345').firestore(); // KingsChat accounts have no email
const admin = env.authenticatedContext('admin1').firestore();
const anon = env.unauthenticatedContext().firestore();

const reset = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'appFeedback/fb1'), { ...valid('alice'), createdAt: new Date() });
  });
};

function valid(uid, extra = {}) {
  return {
    userId: uid,
    feedbackType: 'suggestion',
    subject: 'Dark mode',
    message: 'Please add offline radio.',
    rating: 4,
    platform: 'android',
    appVersion: '1.0.9',
    status: 'new',
    createdAt: serverTimestamp(),
    ...extra,
  };
}
const without = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

/** The way the apps send feedback: the document plus the rate-limit stamp, in one batch. */
function send(db, uid, data, id = `n${Math.random().toString(36).slice(2)}`) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'appFeedback', id), data);
  batch.set(doc(db, 'feedbackRate', uid), { lastAt: serverTimestamp() });
  return batch.commit();
}

let passed = 0;
const test = async (name, fn) => {
  await reset();
  await fn();
  passed++;
  console.log(`  ✔ ${name}`);
};

// ---- Creating ----
await test('a signed-in user can send feedback under their own uid', async () => {
  await assertSucceeds(send(alice, 'alice', valid('alice')));
});
await test('a KingsChat account (no email) can send feedback', async () => {
  await assertSucceeds(send(kingschat, 'kc_12345', valid('kc_12345', { platform: 'web' })));
});
await test('subject and rating are optional', async () => {
  await assertSucceeds(send(alice, 'alice', without(without(valid('alice'), 'subject'), 'rating')));
});
await test('signed-out visitors cannot send feedback', async () => {
  await assertFails(send(anon, 'alice', valid('alice')));
});
await test('feedback cannot be filed under someone else’s uid', async () => {
  await assertFails(send(alice, 'alice', valid('bob')));
});
await test('feedback must start as "new"', async () => {
  await assertFails(send(alice, 'alice', valid('alice', { status: 'resolved' })));
});
await test('only the five known categories are accepted', async () => {
  await assertFails(send(alice, 'alice', valid('alice', { feedbackType: 'spam' })));
});
await test('the message is required and capped at 2000 characters', async () => {
  await assertFails(send(alice, 'alice', valid('alice', { message: '' })));
  await assertFails(send(alice, 'alice', valid('alice', { message: '   ' })));
  await assertFails(send(alice, 'alice', valid('alice', { message: 'x'.repeat(2001) })));
  await assertFails(send(alice, 'alice', without(valid('alice'), 'message')));
  await assertSucceeds(send(alice, 'alice', valid('alice', { message: 'x'.repeat(2000) })));
});
await test('the subject is capped at 120 characters', async () => {
  await assertFails(send(alice, 'alice', valid('alice', { subject: 'x'.repeat(121) })));
});
await test('the rating must be a whole number from 1 to 5', async () => {
  for (const rating of [0, 6, 2.5, '5']) await assertFails(send(alice, 'alice', valid('alice', { rating })));
});
await test('the platform must be android, ios or web', async () => {
  await assertFails(send(alice, 'alice', valid('alice', { platform: 'windows' })));
});
await test('the timestamp must come from the server', async () => {
  await assertFails(send(alice, 'alice', valid('alice', { createdAt: new Date(2020, 0, 1) })));
});
await test('feedback cannot carry extra fields', async () => {
  await assertFails(send(alice, 'alice', valid('alice', { userEmail: 'a@example.com' })));
  await assertFails(send(alice, 'alice', valid('alice', { reviewedBy: 'alice' })));
});

// ---- Abuse limit ----
await test('feedback without the rate-limit stamp is refused', async () => {
  await assertFails(addDoc(collection(alice, 'appFeedback'), valid('alice')));
});
await test('a second feedback within 15 seconds is refused', async () => {
  await assertSucceeds(send(alice, 'alice', valid('alice')));
  await assertFails(send(alice, 'alice', valid('alice', { message: 'Again' })));
});
await test('one person’s limit does not block another person', async () => {
  await assertSucceeds(send(alice, 'alice', valid('alice')));
  await assertSucceeds(send(bob, 'bob', valid('bob')));
});
await test('feedback is allowed again once 15 seconds have passed', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'feedbackRate/alice'), { lastAt: new Date(Date.now() - 16000) }));
  await assertSucceeds(send(alice, 'alice', valid('alice')));
});
await test('nobody can stamp another person’s rate limit, back-date it or read it', async () => {
  await assertFails(setDoc(doc(alice, 'feedbackRate/bob'), { lastAt: serverTimestamp() }));
  await assertFails(setDoc(doc(alice, 'feedbackRate/alice'), { lastAt: new Date(2020, 0, 1) }));
  await assertFails(getDoc(doc(alice, 'feedbackRate/alice')));
});

// ---- Reading, changing, deleting ----
await test('feedback is private: users cannot read it, even their own', async () => {
  await assertFails(getDoc(doc(alice, 'appFeedback/fb1')));
  await assertFails(getDoc(doc(bob, 'appFeedback/fb1')));
  await assertFails(getDocs(collection(bob, 'appFeedback')));
  await assertFails(getDocs(query(collection(alice, 'appFeedback'), where('userId', '==', 'alice'))));
  await assertFails(getDoc(doc(anon, 'appFeedback/fb1')));
});
await test('users cannot edit or delete feedback, even their own', async () => {
  await assertFails(updateDoc(doc(alice, 'appFeedback/fb1'), { message: 'Changed' }));
  await assertFails(updateDoc(doc(alice, 'appFeedback/fb1'), { status: 'resolved', reviewedAt: serverTimestamp(), reviewedBy: 'alice' }));
  await assertFails(deleteDoc(doc(alice, 'appFeedback/fb1')));
});
await test('admins can read all feedback', async () => {
  await assertSucceeds(getDoc(doc(admin, 'appFeedback/fb1')));
  await assertSucceeds(getDocs(collection(admin, 'appFeedback')));
});
await test('admins can mark feedback reviewed or resolved', async () => {
  await assertSucceeds(updateDoc(doc(admin, 'appFeedback/fb1'), { status: 'reviewed', reviewedAt: serverTimestamp(), reviewedBy: 'admin1' }));
  await assertSucceeds(updateDoc(doc(admin, 'appFeedback/fb1'), { status: 'resolved', reviewedAt: serverTimestamp(), reviewedBy: 'admin1' }));
});
await test('admins cannot set an unknown status or change what the user wrote', async () => {
  await assertFails(updateDoc(doc(admin, 'appFeedback/fb1'), { status: 'deleted', reviewedAt: serverTimestamp(), reviewedBy: 'admin1' }));
  await assertFails(updateDoc(doc(admin, 'appFeedback/fb1'), { message: 'Changed', reviewedAt: serverTimestamp(), reviewedBy: 'admin1' }));
});
await test('feedback is kept: nobody can delete it', async () => {
  await assertFails(deleteDoc(doc(admin, 'appFeedback/fb1')));
});

await env.cleanup();
console.log(`feedback rules: ${passed} tests passed`);
