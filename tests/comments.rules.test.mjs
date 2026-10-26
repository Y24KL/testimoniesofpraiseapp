/**
 * Real Firestore security-rules tests for testimony comments, run against the Firestore emulator
 * with the production rules file (top-admin/firestore.rules).
 *
 *   npm run test:rules
 * (= firebase emulators:exec --only firestore --project demo-top "node tests/comments.rules.test.mjs")
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const rules = readFileSync(new URL('../top-admin/firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-top', firestore: { rules } });

const alice = env.authenticatedContext('alice', { name: 'Alice' }).firestore();
const bob = env.authenticatedContext('bob', { name: 'Bob' }).firestore();
const admin = env.authenticatedContext('admin1').firestore();
const anon = env.unauthenticatedContext().firestore();

const reset = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'testimonies/v1'), { title: 'Video one', isPublished: true });
    await setDoc(doc(db, 'testimonies/v2'), { title: 'Video two', isPublished: true });
    await setDoc(doc(db, 'testimonies/draft'), { title: 'Draft', isPublished: false });
    await setDoc(doc(db, 'audioTestimonies/a1'), { title: 'Audio one', isPublished: true });
    await setDoc(doc(db, 'testimonies/legacy'), { title: 'Old field name', published: true });
    await setDoc(doc(db, 'audioTestimonies/a2'), { title: 'Status field', status: 'published' });
  });
};
// Lets the next write pass the 15-second rate limit without waiting.
const allowNextWrite = (uid) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `commentRate/${uid}`), { lastAt: Timestamp.fromMillis(Date.now() - 60_000) }));

const colFor = (type) => (type === 'video' ? 'testimonies' : 'audioTestimonies');
const newComment = (uid, type, id, extra = {}) => ({
  uid, displayName: uid === 'alice' ? 'Alice' : 'Bob', text: 'Praise God!', mediaType: type, mediaId: id, mediaTitle: 'T',
  status: 'visible', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
});
const writeWithRate = (db, uid, path, data, mode = 'set') => {
  const b = writeBatch(db);
  if (mode === 'set') b.set(doc(db, path), data);
  else b.update(doc(db, path), data);
  b.set(doc(db, `commentRate/${uid}`), { lastAt: serverTimestamp() });
  return b.commit();
};
const create = (db, uid, type, id, extra, docId = uid) => writeWithRate(db, uid, `${colFor(type)}/${id}/comments/${docId}`, newComment(uid, type, id, extra));

let passed = 0;
const test = async (name, fn) => {
  await reset();
  await fn();
  passed++;
  console.log(`  ✔ ${name}`);
};

await test('signed-in user comments on a video testimony', async () => {
  await assertSucceeds(create(alice, 'alice', 'video', 'v1'));
});
await test('signed-in user comments on an audio testimony', async () => {
  await assertSucceeds(create(alice, 'alice', 'audio', 'a1'));
});
await test('media published via the older `published` / `status` fields also accept comments', async () => {
  await assertSucceeds(create(alice, 'alice', 'video', 'legacy'));
  await allowNextWrite('alice');
  await assertSucceeds(create(alice, 'alice', 'audio', 'a2'));
});
await test('same account cannot add a second comment to the same item (only edit it)', async () => {
  await create(alice, 'alice', 'video', 'v1');
  await allowNextWrite('alice');
  await assertFails(create(alice, 'alice', 'video', 'v1', { text: 'again' }));
  await allowNextWrite('alice');
  await assertSucceeds(writeWithRate(alice, 'alice', 'testimonies/v1/comments/alice', { text: 'Edited', updatedAt: serverTimestamp() }, 'update'));
});
await test('same account can comment on different items', async () => {
  await create(alice, 'alice', 'video', 'v1');
  await allowNextWrite('alice');
  await assertSucceeds(create(alice, 'alice', 'video', 'v2'));
  await allowNextWrite('alice');
  await assertSucceeds(create(alice, 'alice', 'audio', 'a1'));
});
await test('cannot impersonate another user', async () => {
  await assertFails(create(bob, 'bob', 'video', 'v1', {}, 'alice'));
  await assertFails(writeWithRate(bob, 'bob', 'testimonies/v1/comments/bob', newComment('alice', 'video', 'v1')));
});
await test("cannot edit, hide or delete someone else's comment", async () => {
  await create(alice, 'alice', 'video', 'v1');
  await assertFails(writeWithRate(bob, 'bob', 'testimonies/v1/comments/alice', { text: 'hacked', updatedAt: serverTimestamp() }, 'update'));
  await assertFails(updateDoc(doc(bob, 'testimonies/v1/comments/alice'), { status: 'hidden', moderatedBy: 'bob', moderatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(bob, 'testimonies/v1/comments/alice')));
  await assertSucceeds(deleteDoc(doc(alice, 'testimonies/v1/comments/alice')));
});
await test('owner cannot change status, media link or ownership fields', async () => {
  await create(alice, 'alice', 'video', 'v1');
  for (const change of [{ status: 'hidden' }, { mediaId: 'v2' }, { mediaType: 'audio' }, { uid: 'bob' }, { createdAt: serverTimestamp() }]) {
    await allowNextWrite('alice');
    await assertFails(writeWithRate(alice, 'alice', 'testimonies/v1/comments/alice', { ...change, updatedAt: serverTimestamp() }, 'update'));
  }
});
await test('validation: empty, whitespace, too long, extra fields, wrong type/id, hidden on create', async () => {
  for (const extra of [{ text: '' }, { text: '   ' }, { text: 'x'.repeat(1001) }, { email: 'a@b.c' }, { status: 'hidden' }, { mediaType: 'audio' }, { mediaId: 'v2' }, { displayName: '' }]) {
    await allowNextWrite('alice');
    await assertFails(create(alice, 'alice', 'video', 'v1', extra));
  }
  await allowNextWrite('alice');
  await assertSucceeds(create(alice, 'alice', 'video', 'v1', { text: 'x'.repeat(1000) }));
});
await test('client-supplied timestamps are rejected (server time only)', async () => {
  await assertFails(create(alice, 'alice', 'video', 'v1', { createdAt: Timestamp.fromMillis(0) }));
});
await test('cannot comment on unpublished or missing media', async () => {
  await assertFails(create(alice, 'alice', 'video', 'draft'));
  await assertFails(create(alice, 'alice', 'video', 'nope'));
});
await test('signed-out users cannot read or write comments', async () => {
  await create(alice, 'alice', 'video', 'v1');
  await assertFails(getDoc(doc(anon, 'testimonies/v1/comments/alice')));
  await assertFails(setDoc(doc(anon, 'testimonies/v1/comments/x'), newComment('x', 'video', 'v1')));
});
await test('rate limit: a second write within 15 s is rejected', async () => {
  await create(alice, 'alice', 'video', 'v1');
  await assertFails(create(alice, 'alice', 'video', 'v2'));
  await assertFails(setDoc(doc(alice, 'testimonies/v2/comments/alice'), newComment('alice', 'video', 'v2'))); // skipping the stamp
});
await test('admin moderation: hide and restore; hidden comments disappear for others', async () => {
  await create(alice, 'alice', 'video', 'v1');
  await assertSucceeds(updateDoc(doc(admin, 'testimonies/v1/comments/alice'), { status: 'hidden', moderatedBy: 'admin1', moderatedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(bob, 'testimonies/v1/comments/alice')));
  await assertSucceeds(getDoc(doc(alice, 'testimonies/v1/comments/alice'))); // the author still sees it
  const visible = await assertSucceeds(getDocs(query(collection(bob, 'testimonies/v1/comments'), where('status', '==', 'visible'), orderBy('createdAt', 'desc'))));
  assert.equal(visible.size, 0);
  await assertFails(getDocs(collection(bob, 'testimonies/v1/comments'))); // unfiltered list can't prove visibility
  await assertFails(updateDoc(doc(admin, 'testimonies/v1/comments/alice'), { text: 'admin rewrites', moderatedBy: 'admin1', moderatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(admin, 'testimonies/v1/comments/alice'), { status: 'visible', moderatedBy: 'admin1', moderatedAt: serverTimestamp() }));
  const again = await getDocs(query(collection(bob, 'testimonies/v1/comments'), where('status', '==', 'visible')));
  assert.equal(again.size, 1);
});
await test('admin can delete any comment', async () => {
  await create(alice, 'alice', 'audio', 'a1');
  await assertSucceeds(deleteDoc(doc(admin, 'audioTestimonies/a1/comments/alice')));
});
await test('admin reads every comment across video and audio (collection group); users cannot', async () => {
  await create(alice, 'alice', 'video', 'v1');
  await create(bob, 'bob', 'audio', 'a1');
  const all = await assertSucceeds(getDocs(query(collectionGroup(admin, 'comments'), orderBy('createdAt', 'desc'))));
  assert.equal(all.size, 2);
  const audioOnly = await assertSucceeds(getDocs(query(collectionGroup(admin, 'comments'), where('mediaType', '==', 'audio'))));
  assert.equal(audioOnly.size, 1);
  await assertFails(getDocs(query(collectionGroup(bob, 'comments'), where('status', '==', 'visible'))));
});
await test('comment count = real stored visible comments', async () => {
  await create(alice, 'alice', 'video', 'v1');
  await create(bob, 'bob', 'video', 'v1');
  const n = await assertSucceeds(getCountFromServer(query(collection(bob, 'testimonies/v1/comments'), where('status', '==', 'visible'))));
  assert.equal(n.data().count, 2);
});
await test('existing rules unaffected: users still cannot write testimonies or read push tokens', async () => {
  await assertFails(setDoc(doc(alice, 'testimonies/v1'), { title: 'x', isPublished: true }));
  await assertFails(getDocs(collection(alice, 'pushTokens')));
  await assertSucceeds(getDoc(doc(alice, 'testimonies/v1')));
});

await env.cleanup();
console.log(`\ncomment rules: ${passed} tests passed`);
