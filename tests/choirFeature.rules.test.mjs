/**
 * Firestore security-rules tests for the LoveWorld Singers library, the featured choirs showcase and
 * "Feature your choir/group" requests, run against the emulator with the production rules file.
 *
 *   npm run test:rules
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

const rules = readFileSync(new URL('../top-admin/firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-top-choir', firestore: { rules } });

const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const admin = env.authenticatedContext('admin1').firestore();
const anon = env.unauthenticatedContext().firestore();

const reset = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'loveworldSingersVideos/pub'), singerVideo({ isPublished: true }));
    await setDoc(doc(db, 'loveworldSingersVideos/draft'), singerVideo({ isPublished: false }));
    await setDoc(doc(db, 'featuredChoirs/live'), choir({ isPublished: true }));
    await setDoc(doc(db, 'featuredChoirs/hidden'), choir({ isPublished: false }));
    await setDoc(doc(db, 'choirFeatureRequests/req1'), { ...validRequest('alice'), submittedAt: new Date(), status: 'pending' });
  });
};

function singerVideo(extra = {}) {
  return { title: 'Song', description: '', videoUrl: 'https://cdn.example.com/a.mp4', order: 0, isFeatured: false, isDownloadable: true, ...extra };
}
function choir(extra = {}) {
  return { groupName: 'Grace Voices', songTitle: 'Song', videoUrl: 'https://www.youtube.com/watch?v=abc', order: 0, ...extra };
}
function validRequest(uid) {
  return {
    groupName: 'Grace Voices',
    churchZone: 'Lagos Zone 1',
    ministrationUrl: 'https://www.youtube.com/watch?v=abc123',
    songTitle: 'Amazing Grace',
    submittedBy: uid,
    submittedAt: serverTimestamp(),
    status: 'pending',
  };
}

let passed = 0;
const test = async (name, fn) => {
  await reset();
  await fn();
  passed++;
  console.log(`  ✔ ${name}`);
};

// ---- LoveWorld Singers library ----
await test('signed-in users can read published singers videos', async () => {
  await assertSucceeds(getDoc(doc(alice, 'loveworldSingersVideos/pub')));
});
await test('unpublished singers videos are hidden from ordinary users', async () => {
  await assertFails(getDoc(doc(alice, 'loveworldSingersVideos/draft')));
});
await test('signed-out visitors cannot read the singers library', async () => {
  await assertFails(getDoc(doc(anon, 'loveworldSingersVideos/pub')));
});
await test('the library list only returns published videos to users', async () => {
  await assertSucceeds(getDocs(query(collection(alice, 'loveworldSingersVideos'), where('isPublished', '==', true))));
  await assertFails(getDocs(collection(alice, 'loveworldSingersVideos')));
});
await test('admins can read unpublished singers videos', async () => {
  await assertSucceeds(getDoc(doc(admin, 'loveworldSingersVideos/draft')));
});
await test('ordinary users cannot write singers videos', async () => {
  await assertFails(setDoc(doc(alice, 'loveworldSingersVideos/new'), singerVideo({ isPublished: true })));
});
await test('admins can publish a singers video with valid fields', async () => {
  await assertSucceeds(setDoc(doc(admin, 'loveworldSingersVideos/new'), singerVideo({ isPublished: true })));
});
await test('admins cannot save a singers video without a title', async () => {
  await assertFails(setDoc(doc(admin, 'loveworldSingersVideos/new'), singerVideo({ title: '', isPublished: true })));
});

// ---- Featured choirs showcase ----
await test('signed-in users see published featured choirs only', async () => {
  await assertSucceeds(getDoc(doc(alice, 'featuredChoirs/live')));
  await assertFails(getDoc(doc(alice, 'featuredChoirs/hidden')));
});
await test('ordinary users cannot add featured choirs', async () => {
  await assertFails(setDoc(doc(alice, 'featuredChoirs/new'), choir({ isPublished: true })));
});
await test('admins can add a featured choir', async () => {
  await assertSucceeds(setDoc(doc(admin, 'featuredChoirs/new'), choir({ isPublished: true })));
});

// ---- Choir/group requests ----
await test('a signed-in user can send a pending request under their own uid', async () => {
  await assertSucceeds(addDoc(collection(alice, 'choirFeatureRequests'), validRequest('alice')));
});
await test('a request cannot be filed under someone else’s uid', async () => {
  await assertFails(addDoc(collection(alice, 'choirFeatureRequests'), validRequest('bob')));
});
await test('a request cannot be created already approved', async () => {
  await assertFails(addDoc(collection(alice, 'choirFeatureRequests'), { ...validRequest('alice'), status: 'approved' }));
});
await test('a request needs a supported https video link', async () => {
  await assertFails(addDoc(collection(alice, 'choirFeatureRequests'), { ...validRequest('alice'), ministrationUrl: 'https://example.com/video.mp4' }));
  await assertFails(addDoc(collection(alice, 'choirFeatureRequests'), { ...validRequest('alice'), ministrationUrl: 'http://www.youtube.com/watch?v=abc' }));
  await assertSucceeds(addDoc(collection(alice, 'choirFeatureRequests'), { ...validRequest('alice'), ministrationUrl: 'https://vimeo.com/123' }));
});
await test('a request cannot carry extra fields', async () => {
  await assertFails(addDoc(collection(alice, 'choirFeatureRequests'), { ...validRequest('alice'), isFeatured: true }));
});
await test('signed-out visitors cannot send a request', async () => {
  await assertFails(addDoc(collection(anon, 'choirFeatureRequests'), validRequest('alice')));
});
await test('requests are never public: users cannot read them, even their own', async () => {
  await assertFails(getDoc(doc(alice, 'choirFeatureRequests/req1')));
  await assertFails(getDocs(collection(bob, 'choirFeatureRequests')));
});
await test('admins can read and review requests (status and review fields only)', async () => {
  await assertSucceeds(getDoc(doc(admin, 'choirFeatureRequests/req1')));
  await assertSucceeds(
    updateDoc(doc(admin, 'choirFeatureRequests/req1'), { status: 'approved', reviewedAt: serverTimestamp(), reviewedBy: 'admin1' }),
  );
});
await test('admins cannot edit the submitted content of a request', async () => {
  await assertFails(
    updateDoc(doc(admin, 'choirFeatureRequests/req1'), { groupName: 'Changed', reviewedAt: serverTimestamp(), reviewedBy: 'admin1' }),
  );
});
await test('requests are kept: nobody can delete them', async () => {
  await assertFails(deleteDoc(doc(admin, 'choirFeatureRequests/req1')));
});

await env.cleanup();
console.log(`choirFeature rules: ${passed} tests passed`);
