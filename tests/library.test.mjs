// Unit tests for My T.O.P. rules: keys, limits, collections, resume position, progress write rate.
// Run: node --experimental-strip-types tests/library.test.mjs   (npm run test:library)
import assert from 'node:assert/strict';

const L = await import('../src/library/rules.ts');
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`  ✔ ${name}`); };

ok('canonical keys are "<kind>_<id>" and reject unsafe ids and unknown kinds', () => {
  assert.equal(L.libraryKey('testimony', 'abc-1'), 'testimony_abc-1');
  assert.equal(L.libraryKey('lyrical', 'l9'), 'lyrical_l9');
  assert.equal(L.libraryKey('testimony', 'a/b'), null);
  assert.equal(L.libraryKey('user', 'x'), null);
  assert.equal(L.libraryKey('testimony', ''), null);
});

ok('a key parses back to its kind and id', () => {
  assert.deepEqual(L.parseLibraryKey('lyrical_l9'), { kind: 'lyrical', id: 'l9' });
  assert.equal(L.parseLibraryKey('nothing'), null);
  assert.equal(L.parseLibraryKey('video_x'), null);
});

ok('collection names are trimmed and limited to 60 characters', () => {
  assert.equal(L.validCollectionName('  Evenings  '), 'Evenings');
  assert.equal(L.validCollectionName('   '), null);
  assert.equal(L.validCollectionName('x'.repeat(61)), null);
  assert.equal(L.validCollectionName('x'.repeat(60)), 'x'.repeat(60));
});

ok('adding to a collection avoids duplicates and stops at the limit', () => {
  assert.deepEqual(L.addToCollection(['testimony_a'], 'testimony_b'), { itemIds: ['testimony_a', 'testimony_b'], result: 'added' });
  assert.equal(L.addToCollection(['testimony_a'], 'testimony_a').result, 'present');
  const full = Array.from({ length: 200 }, (_, i) => `testimony_${i}`);
  assert.equal(L.addToCollection(full, 'testimony_new').result, 'full');
});

ok('removing an item leaves the others in order', () => {
  assert.deepEqual(L.removeFromCollection(['a', 'b', 'c'], 'b'), ['a', 'c']);
});

ok('an item is finished within 10 seconds of its end', () => {
  assert.equal(L.isFinished(595, 600), true);
  assert.equal(L.isFinished(580, 600), false);
  assert.equal(L.isFinished(100, 0), false, 'unknown duration is never finished');
});

ok('resume uses the furthest of this device and the saved position', () => {
  assert.equal(L.resumeFrom({ localSec: 120, remoteSec: 300, durationSec: 900 }), 300, 'phone then website');
  assert.equal(L.resumeFrom({ localSec: 400, remoteSec: 200, durationSec: 900 }), 400);
  assert.equal(L.resumeFrom({ localSec: null, remoteSec: 250, durationSec: 900 }), 250, 'signed out or offline: device only, or remote only');
});

ok('very early positions are not resumed, and finished items start at the beginning', () => {
  assert.equal(L.resumeFrom({ localSec: 4, remoteSec: 3, durationSec: 900 }), 0);
  assert.equal(L.resumeFrom({ localSec: 895, durationSec: 900 }), 0, 'near the end counts as finished');
  assert.equal(L.resumeFrom({ remoteSec: 300, remoteCompleted: true, durationSec: 900 }), 0, 'completed on another device');
});

ok('garbage positions are ignored', () => {
  assert.equal(L.resumeFrom({ localSec: Number.NaN, remoteSec: -5, durationSec: 900 }), 0);
});

ok('progress is written at most every 15 seconds, or sooner after a 30-second move', () => {
  const base = { lastWrittenMs: 0, lastPositionSec: 100 };
  assert.equal(L.shouldWriteProgress({ ...base, nowMs: 5000, positionSec: 105 }), false);
  assert.equal(L.shouldWriteProgress({ ...base, nowMs: 15000, positionSec: 105 }), true);
  assert.equal(L.shouldWriteProgress({ ...base, nowMs: 5000, positionSec: 140 }), true, 'a 40 s jump is written');
  assert.equal(L.shouldWriteProgress({ ...base, nowMs: 1000, positionSec: 101, force: true }), true, 'pausing always writes');
  assert.equal(L.shouldWriteProgress({ lastWrittenMs: null, lastPositionSec: null, nowMs: 1, positionSec: 0 }), true, 'first write');
});

ok('newest first sorting does not mutate its input', () => {
  const items = [{ t: 1 }, { t: 3 }, { t: 2 }];
  assert.deepEqual(L.sortNewestFirst(items, (i) => i.t).map((i) => i.t), [3, 2, 1]);
  assert.deepEqual(items.map((i) => i.t), [1, 3, 2]);
});

ok('history beyond the cap is pruned oldest first', () => {
  const entries = Array.from({ length: 203 }, (_, i) => ({ id: i, updatedMs: i }));
  const removed = L.historyOverflow(entries, 200);
  assert.equal(removed.length, 3);
  assert.deepEqual(removed.map((e) => e.id), [0, 1, 2]);
  assert.deepEqual(L.historyOverflow(entries.slice(0, 200)), []);
});

console.log(`library rules: ${n} tests passed`);
