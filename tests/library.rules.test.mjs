/**
 * Firestore security-rules tests for My T.O.P. (saved items, collections, listening history), run against the
 * emulator with the production rules file.   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const rules = readFileSync(new URL('../top-admin/firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-top-library', firestore: { rules } });
const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const anon = env.unauthenticatedContext().firestore();

const reset = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice/saved/testimony_t1'), { contentType: 'testimony', contentId: 't1', title: 'Healing', savedAt: new Date() });
    await setDoc(doc(db, 'users/alice/collections/c1'), { name: 'Morning', itemIds: [], createdAt: new Date(), updatedAt: new Date() });
    await setDoc(doc(db, 'users/alice/history/testimony_t1'), { contentType: 'testimony', contentId: 't1', title: 'Healing', positionSec: 40, durationSec: 600, completed: false, updatedAt: new Date() });
  });
};

const saved = (extra = {}) => ({ contentType: 'testimony', contentId: 't2', title: 'Peace', savedAt: serverTimestamp(), ...extra });
const collectionDoc = (extra = {}) => ({ name: 'Evening', itemIds: ['testimony_t1'], createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
const history = (extra = {}) => ({ contentType: 'lyrical', contentId: 'l1', title: 'Song', positionSec: 120, durationSec: 300, completed: false, updatedAt: serverTimestamp(), ...extra });

let passed = 0;
const test = async (name, fn) => {
  await reset();
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

// ---------------- saved items ----------------
await test('the owner saves an item under its canonical id', async () => {
  await assertSucceeds(setDoc(doc(alice, 'users/alice/saved/testimony_t2'), saved()));
  await assertSucceeds(setDoc(doc(alice, 'users/alice/saved/lyrical_l9'), saved({ contentType: 'lyrical', contentId: 'l9' })));
});

await test('a saved item must use its canonical id', async () => {
  await assertFails(setDoc(doc(alice, 'users/alice/saved/whatever'), saved()));
  await assertFails(setDoc(doc(alice, 'users/alice/saved/lyrical_t2'), saved()));
});

await test('saved items accept only the fixed fields and types', async () => {
  await assertFails(setDoc(doc(alice, 'users/alice/saved/testimony_t2'), saved({ note: 'my note' })));
  await assertFails(setDoc(doc(alice, 'users/alice/saved/testimony_t2'), saved({ contentType: 'user' })));
  await assertFails(setDoc(doc(alice, 'users/alice/saved/testimony_t2'), saved({ contentId: 'bad/id' })));
  await assertFails(setDoc(doc(alice, 'users/alice/saved/testimony_t2'), saved({ title: 'x'.repeat(201) })));
  await assertFails(setDoc(doc(alice, 'users/alice/saved/testimony_t2'), saved({ savedAt: new Date() })));
});

await test('saved items cannot be edited, only removed; others cannot see them', async () => {
  await assertFails(updateDoc(doc(alice, 'users/alice/saved/testimony_t1'), { title: 'Changed' }));
  await assertSucceeds(deleteDoc(doc(alice, 'users/alice/saved/testimony_t1')));
  await assertFails(getDoc(doc(bob, 'users/alice/saved/testimony_t1')));
  await assertSucceeds(setDoc(doc(bob, 'users/bob/saved/testimony_t1'), saved({ contentId: 't1' })));
});

await test('no one can save into another person’s library', async () => {
  await assertFails(setDoc(doc(bob, 'users/alice/saved/testimony_t3'), saved({ contentId: 't3' })));
  await assertFails(setDoc(doc(anon, 'users/alice/saved/testimony_t3'), saved({ contentId: 't3' })));
});

// ---------------- collections ----------------
await test('the owner creates, renames and deletes a collection', async () => {
  await assertSucceeds(setDoc(doc(alice, 'users/alice/collections/c2'), collectionDoc()));
  await assertSucceeds(updateDoc(doc(alice, 'users/alice/collections/c2'), { name: 'Evenings', updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(doc(alice, 'users/alice/collections/c2')));
});

await test('collection names are 1 to 60 characters and items are capped', async () => {
  await assertFails(setDoc(doc(alice, 'users/alice/collections/c3'), collectionDoc({ name: '' })));
  await assertFails(setDoc(doc(alice, 'users/alice/collections/c3'), collectionDoc({ name: 'x'.repeat(61) })));
  await assertFails(setDoc(doc(alice, 'users/alice/collections/c3'), collectionDoc({ itemIds: Array.from({ length: 201 }, (_, i) => `testimony_${i}`) })));
});

await test('a collection keeps its creation time on update', async () => {
  await assertFails(updateDoc(doc(alice, 'users/alice/collections/c1'), { name: 'Renamed', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(alice, 'users/alice/collections/c1'), { name: 'Renamed', updatedAt: serverTimestamp() }));
});

await test('collections are private to the owner', async () => {
  await assertFails(getDocs(collection(bob, 'users/alice/collections')));
  await assertFails(setDoc(doc(bob, 'users/alice/collections/c9'), collectionDoc()));
});

// ---------------- listening history ----------------
await test('the owner records a position with the canonical id', async () => {
  await assertSucceeds(setDoc(doc(alice, 'users/alice/history/lyrical_l1'), history()));
  await assertSucceeds(updateDoc(doc(alice, 'users/alice/history/testimony_t1'), { positionSec: 90, updatedAt: serverTimestamp() }));
});

await test('history must use the canonical id and bounded numbers', async () => {
  await assertFails(setDoc(doc(alice, 'users/alice/history/testimony_l1'), history({ contentType: 'lyrical' })));
  await assertFails(setDoc(doc(alice, 'users/alice/history/lyrical_l1'), history({ positionSec: -1 })));
  await assertFails(setDoc(doc(alice, 'users/alice/history/lyrical_l1'), history({ positionSec: 90000 })));
  await assertFails(setDoc(doc(alice, 'users/alice/history/lyrical_l1'), history({ positionSec: '120' })));
  await assertFails(setDoc(doc(alice, 'users/alice/history/lyrical_l1'), history({ completed: 'yes' })));
  await assertFails(setDoc(doc(alice, 'users/alice/history/lyrical_l1'), history({ updatedAt: new Date() })));
});

await test('history carries only the fixed fields', async () => {
  await assertFails(setDoc(doc(alice, 'users/alice/history/lyrical_l1'), history({ device: 'phone' })));
});

await test('history is readable and deletable by the owner only', async () => {
  await assertSucceeds(getDocs(collection(alice, 'users/alice/history')));
  await assertFails(getDocs(collection(bob, 'users/alice/history')));
  await assertFails(setDoc(doc(bob, 'users/alice/history/testimony_t1'), history({ contentType: 'testimony', contentId: 't1' })));
  await assertSucceeds(deleteDoc(doc(alice, 'users/alice/history/testimony_t1')));
});

await env.cleanup();
console.log(`library rules: ${passed} tests passed`);
