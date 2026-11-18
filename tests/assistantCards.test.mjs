// Unit tests for the assistant's verified cards: shape checks and routing. Run: npm run test:assistant-cards
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { parseCards, cardTarget, MAX_CARDS } = await import('../src/ai/cards.ts');
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`  ✔ ${name}`); };

const good = { kind: 'lyrical', id: 'l1', title: 'Healing Song', subtitle: 'Song A', deepLink: 'testimoniesofpraise://lyrical/l1', verified: true };

ok('well-formed verified cards are kept', () => {
  assert.deepEqual(parseCards([good]), [good]);
});

ok('cards that are not verified, not from the app, or malformed are dropped', () => {
  assert.equal(parseCards([{ ...good, verified: false }]).length, 0, 'unverified');
  assert.equal(parseCards([{ ...good, deepLink: 'https://evil.example/x' }]).length, 0, 'outside link');
  assert.equal(parseCards([{ ...good, kind: 'admin' }]).length, 0, 'unknown kind');
  assert.equal(parseCards([{ ...good, id: '' }]).length, 0, 'empty id');
  assert.equal(parseCards([{ ...good, title: undefined }]).length, 0, 'no title');
  assert.equal(parseCards([null, 'x', 3]).length, 0);
  assert.equal(parseCards('not a list').length, 0);
});

ok('a bad start time is ignored, and a good one is kept', () => {
  assert.equal(parseCards([{ ...good, kind: 'clip', startSec: -4 }])[0].startSec, undefined);
  assert.equal(parseCards([{ ...good, kind: 'clip', startSec: 73 }])[0].startSec, 73);
});

ok('long titles are shortened and the list is capped', () => {
  assert.equal(parseCards([{ ...good, title: 'x'.repeat(300) }])[0].title.length, 200);
  const many = Array.from({ length: 20 }, (_, i) => ({ ...good, id: `l${i}` }));
  assert.equal(parseCards(many).length, MAX_CARDS);
});

ok('each card opens its own screen, and a clip opens at its moment', () => {
  assert.deepEqual(cardTarget({ ...good, kind: 'lyrical' }), { screen: 'LyricalAnalysisVideo', params: { id: 'l1' } });
  assert.deepEqual(cardTarget({ ...good, kind: 'article', id: 'a1' }), { screen: 'ArticleDetails', params: { id: 'a1' } });
  assert.deepEqual(cardTarget({ ...good, kind: 'testimony', id: 't1' }), { screen: 'TestimonyDetails', params: { id: 't1' } });
  assert.deepEqual(cardTarget({ ...good, kind: 'clip', id: 't1', startSec: 90 }), { screen: 'TestimonyDetails', params: { id: 't1', startAt: 90 } });
  assert.deepEqual(cardTarget({ ...good, kind: 'live', id: 'live' }), { screen: 'Live' });
});

ok('every deep link the assistant uses is a route the app has', () => {
  const linking = readFileSync(new URL('../src/navigation/linking.ts', import.meta.url), 'utf8');
  for (const path of ['live', 'testimony/:id', 'lyrical/:id', 'article/:id']) {
    assert.ok(linking.includes(`'${path}'`), `route ${path} exists`);
  }
});

console.log(`assistant cards: ${n} tests passed`);
