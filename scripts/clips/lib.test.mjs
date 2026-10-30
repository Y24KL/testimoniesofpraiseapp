// Tests for the clip indexer helpers. Run: node lib.test.mjs
import assert from 'node:assert/strict';
import { cleanSegments, clipLabel, toSeconds } from './lib.mjs';

assert.equal(toSeconds('0:42'), 42);
assert.equal(toSeconds('12:05'), 725);
assert.equal(toSeconds('1:02:09'), 3729);
assert.equal(toSeconds('abc'), null);
assert.equal(toSeconds('12'), null);
assert.equal(toSeconds('-1:00'), null);

assert.equal(clipLabel(42), '0:42');
assert.equal(clipLabel(725), '12:05');
assert.equal(clipLabel(3729), '1:02:09');

const segments = [
  { start: '0:00', end: '0:20', description: 'A woman speaks in a church hall.' },
  { start: '0:20', end: '0:35', description: 'A cat walks across the floor.' },
  { start: '0:50', end: '0:40', description: 'Reversed times are dropped.' },
  { start: 'soon', end: '1:00', description: 'Bad start is dropped.' },
  { start: '0:30', end: '0:40', description: '' },
  { start: '5:00', end: '5:10', description: 'Past the end of the video.' },
  { start: '0:55', end: '1:30', description: 'Ends after the video, so it is clamped.' },
];
const clean = cleanSegments(segments, 60);
assert.deepEqual(clean.map((c) => [c.startSec, c.endSec]), [[0, 20], [20, 35], [55, 60]]);
assert.equal(clean[1].description, 'A cat walks across the floor.');
assert.deepEqual(cleanSegments('not an array', 60), []);
assert.ok(cleanSegments(Array.from({ length: 100 }, () => segments[0]), 0).length === 80, 'at most 80 clips per video');

console.log('clip indexer helpers: all assertions passed');
