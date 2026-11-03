/**
 * Firestore security-rules tests for Lyrical Analysis (lyricalAnalyses), run against the emulator with
 * the production rules file (top-admin/firestore.rules).
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

const rules = readFileSync(new URL('../top-admin/firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-top-lyrical', firestore: { rules } });

const alice = env.authenticatedContext('alice').firestore();
const admin = env.authenticatedContext('admin1').firestore();
const anon = env.unauthenticatedContext().firestore();

const analysis = (extra = {}) => ({
  title: 'Grace in the Storm',
  songTitle: 'Grace Abounds',
  artistName: 'LoveWorld Singers',
  description: 'What the song teaches about trust.',
  videoUrl: 'https://cdn.example.com/analysis.mp4',
  status: 'published',
  displayOrder: 0,
  publicationDate: serverTimestamp(),
  createdBy: 'admin1',
  ...extra,
});

const reset = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'lyricalAnalyses/pub'), analysis({ status: 'published' }));
    await setDoc(doc(db, 'lyricalAnalyses/draft'), analysis({ status: 'draft', displayOrder: 1 }));
    await setDoc(doc(db, 'lyricalAnalyses/unpub'), analysis({ status: 'unpublished', displayOrder: 2 }));
  });
};

let passed = 0;
const test = async (name, fn) => {
  await reset();
  await fn();
  passed++;
  console.log(`  ✔ ${name}`);
};

await test('signed-in users can read published analyses', async () => {
  await assertSucceeds(getDoc(doc(alice, 'lyricalAnalyses/pub')));
});
await test('drafts and unpublished analyses are hidden from ordinary users', async () => {
  await assertFails(getDoc(doc(alice, 'lyricalAnalyses/draft')));
  await assertFails(getDoc(doc(alice, 'lyricalAnalyses/unpub')));
});
await test('the library query only returns published analyses to users', async () => {
  await assertSucceeds(getDocs(query(collection(alice, 'lyricalAnalyses'), where('status', '==', 'published'))));
  await assertFails(getDocs(collection(alice, 'lyricalAnalyses')));
});
await test('signed-out visitors cannot read analyses', async () => {
  await assertFails(getDoc(doc(anon, 'lyricalAnalyses/pub')));
});
await test('admins can read drafts and unpublished analyses', async () => {
  await assertSucceeds(getDoc(doc(admin, 'lyricalAnalyses/draft')));
  await assertSucceeds(getDoc(doc(admin, 'lyricalAnalyses/unpub')));
});
await test('ordinary users cannot create or change analyses', async () => {
  await assertFails(addDoc(collection(alice, 'lyricalAnalyses'), analysis()));
  await assertFails(updateDoc(doc(alice, 'lyricalAnalyses/pub'), { title: 'Changed' }));
});
await test('ordinary users cannot delete analyses', async () => {
  await assertFails(deleteDoc(doc(alice, 'lyricalAnalyses/pub')));
});
await test('admins can save a draft (with a title and no video yet)', async () => {
  await assertSucceeds(addDoc(collection(admin, 'lyricalAnalyses'), analysis({ status: 'draft', videoUrl: '' })));
});
await test('admins cannot publish without a video', async () => {
  await assertFails(addDoc(collection(admin, 'lyricalAnalyses'), analysis({ status: 'published', videoUrl: '' })));
  await assertFails(updateDoc(doc(admin, 'lyricalAnalyses/draft'), { status: 'published', videoUrl: '' }));
});
await test('admins can publish, unpublish and reorder with a valid record', async () => {
  await assertSucceeds(updateDoc(doc(admin, 'lyricalAnalyses/draft'), { status: 'published', videoUrl: 'https://cdn.example.com/b.mp4' }));
  await assertSucceeds(updateDoc(doc(admin, 'lyricalAnalyses/pub'), { status: 'unpublished' }));
  await assertSucceeds(updateDoc(doc(admin, 'lyricalAnalyses/pub'), { displayOrder: 5 }));
});
await test('status must be one of the allowed values', async () => {
  await assertFails(updateDoc(doc(admin, 'lyricalAnalyses/pub'), { status: 'public' }));
});
await test('a new analysis must record its creator as the signed-in admin', async () => {
  await assertFails(addDoc(collection(admin, 'lyricalAnalyses'), analysis({ createdBy: 'someone-else' })));
});
await test('admins can delete an analysis', async () => {
  await assertSucceeds(deleteDoc(doc(admin, 'lyricalAnalyses/unpub')));
});

await env.cleanup();
console.log(`lyricalAnalysis rules: ${passed} tests passed`);
