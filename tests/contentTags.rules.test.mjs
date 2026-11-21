/**
 * Firestore rules tests for content interest tags on the five taggable content types, run against the
 * emulator with the production rules file.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const rules = readFileSync(new URL('../top-admin/firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-top-tags', firestore: { rules } });

const admin = env.authenticatedContext('admin1').firestore();
const alice = env.authenticatedContext('alice').firestore();

const DOCS = {
  'testimonies/t1': { title: 'Healed', isPublished: true },
  'writtenTestimonies/w1': { title: 'Saved', body: 'My story', isPublished: true },
  'articles/a1': { title: 'Faith', body: 'Text', isPublished: true },
  'lyricalAnalyses/l1': { title: 'Song', songTitle: 'Song', videoUrl: 'https://v.example/x.mp4', status: 'published', displayOrder: 1, createdBy: 'admin1' },
  'loveworldSingersVideos/v1': { title: 'Ministration', videoUrl: 'https://v.example/y.mp4', isPublished: true },
};

const reset = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin1'), { role: 'admin' });
    for (const [path, data] of Object.entries(DOCS)) await setDoc(doc(db, path), data);
  });
};

let passed = 0;
const test = async (name, fn) => {
  await reset();
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

await test('an admin can tag every content type with allowed tags', async () => {
  for (const path of Object.keys(DOCS)) await assertSucceeds(updateDoc(doc(admin, path), { tags: ['healing', 'faith'] }));
});

await test('unknown tags are refused on every content type', async () => {
  for (const path of Object.keys(DOCS)) await assertFails(updateDoc(doc(admin, path), { tags: ['healing', 'politics'] }));
});

await test('more than five tags, or tags that are not a list, are refused', async () => {
  const six = ['healing', 'salvation', 'deliverance', 'miracles', 'finances', 'family'];
  for (const path of Object.keys(DOCS)) {
    await assertFails(updateDoc(doc(admin, path), { tags: six }));
    await assertFails(updateDoc(doc(admin, path), { tags: 'healing' }));
  }
});

await test('an empty tag list and untagged content stay valid', async () => {
  for (const path of Object.keys(DOCS)) await assertSucceeds(updateDoc(doc(admin, path), { tags: [] }));
  await assertSucceeds(setDoc(doc(admin, 'testimonies/t2'), { title: 'No tags', isPublished: false }));
  await assertSucceeds(setDoc(doc(admin, 'articles/a2'), { title: 'No tags', body: 'x', isPublished: false }));
});

await test('admins can still delete testimonies and articles', async () => {
  await assertSucceeds(deleteDoc(doc(admin, 'testimonies/t1')));
  await assertSucceeds(deleteDoc(doc(admin, 'articles/a1')));
});

await test('users cannot tag content, and can read the tags of published content', async () => {
  for (const path of Object.keys(DOCS)) await assertFails(updateDoc(doc(alice, path), { tags: ['healing'] }));
  await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), 'testimonies/t1'), { tags: ['healing'] }));
  const snap = await assertSucceeds(getDoc(doc(alice, 'testimonies/t1')));
  if (JSON.stringify(snap.data().tags) !== '["healing"]') throw new Error('tags not readable');
});

await env.cleanup();
console.log(`content tag rules: ${passed} tests passed`);
