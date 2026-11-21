/**
 * Tests for personal home sections (src/recommend.js): ranking, reasons, evidence thresholds, diversity,
 * exploration, exposure, opt-out, continue-watching checks, and that every read uses the caller's token.
 *
 *   node test-recommend.mjs
 */
import assert from 'node:assert/strict';
import { buildProfile, featuredUnseen, forYou, homeSections, newInInterests, poolItem, readExposure, scoreItem } from './src/recommend.js';

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 21, 12);
const item = (type, id, tags, ageDays = 3, extra = {}) => ({ ...poolItem(type, id, { title: id, tags, publishedAt: new Date(NOW - ageDays * DAY) }), ...extra });
const person = (over = {}) => ({ interests: [], optOut: false, history: [], activity: [], ...over });
const opts = { now: NOW };

// ---------------- profile ----------------
await test('one interaction is not evidence; three on two different days is', () => {
  const pool = [item('testimony', 'h1', ['healing']), item('testimony', 'h2', ['healing'])];
  const once = buildProfile(person({ activity: [{ event: 'view', type: 'testimony', id: 'h1', atMs: NOW }] }), pool);
  assert.deepEqual(once.affinity, {});
  const many = buildProfile(person({ activity: [
    { event: 'view', type: 'testimony', id: 'h1', atMs: NOW },
    { event: 'view', type: 'testimony', id: 'h2', atMs: NOW - DAY },
    { event: 'view', type: 'testimony', id: 'h1', atMs: NOW - DAY },
  ] }), pool);
  assert.ok(many.affinity.healing > 0);
});

await test('three interactions on the same day are still not enough', () => {
  const pool = [item('testimony', 'h1', ['healing'])];
  const p = buildProfile(person({ activity: [1, 2, 3].map((n) => ({ event: 'view', type: 'testimony', id: 'h1', atMs: NOW - n * 60000 })) }), pool);
  assert.deepEqual(p.affinity, {});
});

// ---------------- ranking ----------------
await test('an explicit interest ranks first and says why', () => {
  const pool = [item('testimony', 'fin', ['finances'], 1), item('testimony', 'heal', ['healing'], 10)];
  const list = forYou(pool, buildProfile(person({ interests: ['healing'] }), pool), opts);
  assert.equal(list[0].id, 'heal');
  assert.equal(list[0].reason, 'interest');
  assert.equal(list[0].reasonText, 'Because you enjoy healing content');
  assert.equal('embedding' in list[0], false, 'embeddings are never sent to the app');
});

await test('finished content is not recommended again', () => {
  const pool = [item('testimony', 'done', ['healing']), item('testimony', 'new', ['healing'])];
  const p = buildProfile(person({ interests: ['healing'], history: [{ type: 'testimony', id: 'done', completed: true, positionSec: 300, durationSec: 300, atMs: NOW }] }), pool);
  assert.deepEqual(forYou(pool, p, opts).map((x) => x.id), ['new']);
});

await test('items shown before without being opened drop down the list', () => {
  const pool = [item('testimony', 'a', ['healing'], 1), item('testimony', 'b', ['healing'], 1)];
  const p = buildProfile(person({ interests: ['healing'] }), pool);
  assert.equal(forYou(pool, p, opts)[0].id, 'a');
  assert.equal(forYou(pool, p, { now: NOW, exposure: { 'testimony:a': 3 } })[0].id, 'b');
});

await test('similar testimonies are found through their embeddings', () => {
  const v = (x) => Array.from({ length: 16 }, (_, i) => (i === x ? 1 : 0.01));
  const pool = [item('testimony', 'watched', [], 30, { embedding: v(0) }), item('testimony', 'close', [], 30, { embedding: v(0) }), item('testimony', 'far', [], 30, { embedding: v(9) })];
  const p = buildProfile(person({ history: [{ type: 'testimony', id: 'watched', completed: true, positionSec: 1, durationSec: 1, atMs: NOW }] }), pool);
  const list = forYou(pool, p, opts);
  assert.equal(list[0].id, 'close');
  assert.equal(list[0].reason, 'similar');
});

await test('the list is varied: at most 2 per topic and 3 per content type', () => {
  const pool = Array.from({ length: 12 }, (_, i) => item('testimony', `h${i}`, ['healing'], i)).concat(
    Array.from({ length: 6 }, (_, i) => item('article', `a${i}`, ['faith'], i)),
    Array.from({ length: 6 }, (_, i) => item('written', `w${i}`, ['family'], i)),
    Array.from({ length: 6 }, (_, i) => item('lyrical', `l${i}`, ['worship'], i)),
  );
  const p = buildProfile(person({ interests: ['healing'] }), pool);
  const first = forYou(pool, p, opts).slice(0, 4);
  assert.ok(first.filter((x) => x.tags.includes('healing')).length <= 2);
  assert.ok(first.filter((x) => x.type === 'testimony').length <= 3);
});

await test('slot 5 is something outside the usual interests', () => {
  const types = ['testimony', 'article', 'written', 'lyrical'];
  const pool = Array.from({ length: 8 }, (_, i) => item(types[i % 4], `x${i}`, [i % 2 ? 'faith' : 'healing'], i)).concat([item('article', 'out', ['missions'], 50)]);
  const list = forYou(pool, buildProfile(person({ interests: ['healing', 'faith'] }), pool), opts);
  assert.ok(list.slice(0, 4).every((x) => x.reason === 'interest'));
  assert.equal(list[4].id, 'out');
  assert.equal(list[4].reason, 'explore');
  assert.equal(list[4].reasonText, 'Something different for you');
});

await test('with too few interest matches, other topics fill in before the exploration slot', () => {
  const pool = Array.from({ length: 6 }, (_, i) => item('testimony', `h${i}`, ['healing'], i)).concat([item('article', 'out', ['missions'], 50)]);
  const list = forYou(pool, buildProfile(person({ interests: ['healing'] }), pool), opts);
  assert.equal(list[2].id, 'out', 'the 2-per-topic cap makes room for a different topic');
  assert.equal(list.length, 7);
});

await test('new in your interests: recent, matching, not yet opened', () => {
  const pool = [item('testimony', 'new', ['healing'], 2), item('testimony', 'old', ['healing'], 60), item('testimony', 'other', ['youth'], 2), item('testimony', 'opened', ['healing'], 2)];
  const p = buildProfile(person({ interests: ['healing'], activity: [{ event: 'view', type: 'testimony', id: 'opened', atMs: NOW }] }), pool);
  assert.deepEqual(newInInterests(pool, p, opts).map((x) => [x.id, x.reasonText]), [['new', 'New in healing']]);
});

await test('featured you have not seen excludes what you opened', () => {
  const pool = [item('testimony', 'f1', [], 1, { featured: true }), item('testimony', 'f2', [], 1, { featured: true }), item('testimony', 'n', [])];
  const p = buildProfile(person({ activity: [{ event: 'view', type: 'testimony', id: 'f1', atMs: NOW }] }), pool);
  assert.deepEqual(featuredUnseen(pool, p).map((x) => x.id), ['f2']);
});

await test('with no interests and no history, fresh content leads (cold start)', () => {
  const pool = [item('testimony', 'old', [], 90), item('testimony', 'new', [], 1)];
  const list = forYou(pool, buildProfile(person(), pool), opts);
  assert.equal(list[0].id, 'new');
  assert.equal(list[0].reason, 'fresh');
});

await test('exposure from the app is validated and bounded', () => {
  assert.deepEqual(readExposure({ 'testimony:a': 2, 'user:b': 4, 'testimony:../x': 1, 'article:c': 99, 'lyrical:d': -1 }), { 'testimony:a': 2, 'article:c': 5 });
  assert.deepEqual(readExposure('x'), {});
  assert.equal(scoreItem(item('testimony', 'a', []), buildProfile(person(), []), { now: NOW, exposure: { 'testimony:a': 5 } }).score < 0.2, true);
});

// ---------------- the endpoint's data access ----------------
function fakeFirestore({ discovery = null, history = [], activity = [], content = {} } = {}) {
  const calls = [];
  const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : Array.isArray(v) ? { arrayValue: { values: v.map((s) => ({ stringValue: s })) } } : v instanceof Date ? { timestampValue: v.toISOString() } : { stringValue: v }]));
  const doc = (path, data) => ({ document: { name: `projects/p/databases/(default)/documents/${path}`, fields: fields(data) } });
  const fetchFn = async (url, init = {}) => {
    calls.push({ url: String(url), auth: init.headers?.Authorization });
    const u = String(url);
    if (u.endsWith('/private/discovery')) return discovery ? new Response(JSON.stringify({ fields: fields(discovery) })) : new Response('{}', { status: 404 });
    if (u.includes(':runQuery')) {
      const q = JSON.parse(init.body).structuredQuery;
      const col = q.from[0].collectionId;
      if (col === 'history') return new Response(JSON.stringify(history.map((h) => doc(`users/u1/history/${h.contentType}_${h.contentId}`, h))));
      if (col === 'user_activity') return new Response(JSON.stringify(activity.map((a, i) => doc(`user_activity/x${i}`, a))));
      return new Response(JSON.stringify((content[col] ?? []).map(([id, d]) => doc(`${col}/${id}`, d))));
    }
    const m = u.match(/documents\/(testimonies|lyricalAnalyses)\/([^/?]+)$/);
    if (m) {
      const found = (content[m[1]] ?? []).find(([id]) => id === m[2]);
      return found && (found[1].isPublished === true || found[1].status === 'published') ? new Response(JSON.stringify({ fields: fields(found[1]) })) : new Response('{}', { status: 403 });
    }
    return new Response('[]');
  };
  return { fetchFn, calls };
}
const env = { FIREBASE_PROJECT_ID: 'p' };
const pub = (title, tags = [], extra = {}) => ({ title, tags, isPublished: true, createdAt: new Date(NOW - DAY), ...extra });

await test('every read uses the caller’s own token; nothing is written', async () => {
  const fs = fakeFirestore({ discovery: { interests: ['healing'] }, content: { testimonies: [['t1', pub('Healed', ['healing'])]] } });
  const out = await homeSections(env, 'Bearer USER', 'u1', {}, { fetchFn: fs.fetchFn, cache: null, now: NOW });
  assert.ok(fs.calls.length > 0);
  assert.ok(fs.calls.every((c) => c.auth === 'Bearer USER'));
  assert.equal(out.personalized, true);
  assert.equal(out.forYou[0].id, 't1');
});

await test('continue keeps unfinished items that are still published and drops the rest', async () => {
  const history = [
    { contentType: 'testimony', contentId: 'ok', title: 'A', positionSec: 120, durationSec: 600, completed: false, updatedAt: new Date(NOW) },
    { contentType: 'testimony', contentId: 'gone', title: 'B', positionSec: 120, durationSec: 600, completed: false, updatedAt: new Date(NOW) },
    { contentType: 'testimony', contentId: 'barely', title: 'C', positionSec: 3, durationSec: 600, completed: false, updatedAt: new Date(NOW) },
  ];
  const fs = fakeFirestore({ history, content: { testimonies: [['ok', pub('A')], ['gone', { title: 'B', isPublished: false }], ['barely', pub('C')]] } });
  const out = await homeSections(env, 'Bearer USER', 'u1', {}, { fetchFn: fs.fetchFn, cache: null, now: NOW });
  assert.deepEqual(out.continue.map((c) => [c.id, c.positionSec]), [['ok', 120]]);
});

await test('opting out returns editorial sections only and ignores activity', async () => {
  const fs = fakeFirestore({
    discovery: { interests: ['healing'], optOut: true },
    activity: [{ uid: 'u1', type: 'view', contentType: 'testimony', contentId: 'f', ts: new Date(NOW) }],
    content: { testimonies: [['f', pub('F', [], { isFeatured: true })]] },
  });
  const out = await homeSections(env, 'Bearer USER', 'u1', {}, { fetchFn: fs.fetchFn, cache: null, now: NOW });
  assert.equal(out.personalized, false);
  assert.deepEqual(out.forYou, []);
  assert.deepEqual(out.interests, []);
  assert.deepEqual(out.featured.map((x) => x.id), ['f'], 'activity is not used, so it still shows as unseen');
});

await test('a failing content type does not break the home screen', async () => {
  const fs = fakeFirestore({ content: { testimonies: [['t1', pub('T')]] } });
  const failing = async (url, init) => (String(init?.body || '').includes('"articles"') ? new Response('{}', { status: 500 }) : fs.fetchFn(url, init));
  const out = await homeSections(env, 'Bearer USER', 'u1', {}, { fetchFn: failing, cache: null, now: NOW });
  assert.equal(out.forYou[0].id, 't1');
});

console.log(`\npersonal home sections: ${passed} tests passed`);
