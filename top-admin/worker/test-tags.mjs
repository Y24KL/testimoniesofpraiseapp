/**
 * Tests for content interest tags: the keyword matcher, Praxiom suggestions (with a fake chat) and the
 * fallbacks when Praxiom is missing, fails or answers outside the allowed list.
 *
 *   node test-tags.mjs
 */
import assert from 'node:assert/strict';
import { CONTENT_TAGS, sanitizeTags, suggestByKeywords, suggestTags, tagInput, MAX_ITEMS_PER_REQUEST } from './src/tags.js';

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

const env = { PRAXIOM_API_KEY: 'px_test' };
const chatReturning = (text) => async () => ({ text, toolCalls: [], finishReason: 'stop', usage: null });

await test('the tag list is fixed and sanitising keeps only known tags, once each', () => {
  assert.equal(CONTENT_TAGS.length, 12);
  assert.deepEqual(sanitizeTags(['Healing', 'healing', 'politics', 'worship', 42]), ['healing', 'worship']);
  assert.equal(sanitizeTags(CONTENT_TAGS).length, 5);
  assert.deepEqual(sanitizeTags('healing'), []);
});

await test('a healing testimony is tagged from its title', () => {
  assert.deepEqual(suggestByKeywords({ title: 'Healed of cancer after 3 years', description: '' }).slice(0, 1), ['healing']);
});

await test('one weak mention in the body is not enough; two different words are', () => {
  assert.deepEqual(suggestByKeywords({ title: 'My story', description: 'I went to the hospital once.' }), []);
  assert.ok(suggestByKeywords({ title: 'My story', description: 'The doctors gave up but I recovered fully.' }).includes('healing'));
});

await test('words are matched whole, not inside other words', () => {
  assert.equal(suggestByKeywords({ title: 'Sonship and identity' }).includes('family'), false); // "son" inside "Sonship"
});

await test('worship music is always tagged worship', () => {
  assert.equal(suggestByKeywords({ contentType: 'lyrical', title: 'Song analysis' })[0], 'worship');
  assert.equal(suggestByKeywords({ contentType: 'loveworld', title: 'Ministration' })[0], 'worship');
});

await test('inputs are clipped and unknown content types default to testimony', () => {
  const it = tagInput({ contentType: 'user', title: 'x'.repeat(500), keywords: ['a', 5, 'b'] });
  assert.equal(it.contentType, 'testimony');
  assert.equal(it.title.length, 200);
  assert.deepEqual(it.keywords, ['a', 'b']);
});

await test('a valid Praxiom answer is used, item by item', async () => {
  const out = await suggestTags(env, [{ title: 'A' }, { title: 'B' }], { chat: chatReturning('{"results":[{"i":0,"tags":["healing","faith"]},{"i":1,"tags":["marriage"]}]}') });
  assert.equal(out.ai, 'ok');
  assert.deepEqual(out.results, [{ tags: ['healing', 'faith'], source: 'praxiom' }, { tags: ['marriage'], source: 'praxiom' }]);
});

await test('a tag outside the list makes the answer invalid, and keywords are used instead', async () => {
  const out = await suggestTags(env, [{ title: 'Healed of fever' }], { chat: chatReturning('{"results":[{"i":0,"tags":["politics"]}]}') });
  assert.equal(out.ai, 'invalid');
  assert.deepEqual(out.results[0], { tags: ['healing'], source: 'keywords' });
});

await test('prose around the JSON is tolerated; extra fields are not', async () => {
  const ok = await suggestTags(env, [{ title: 'x' }], { chat: chatReturning('Here you go: {"results":[{"i":0,"tags":["hope"]}]}') });
  assert.deepEqual(ok.results[0].tags, ['hope']);
  const bad = await suggestTags(env, [{ title: 'x' }], { chat: chatReturning('{"results":[{"i":0,"tags":["hope"],"why":"because"}]}') });
  assert.equal(bad.ai, 'invalid');
});

await test('an empty Praxiom answer for an item falls back to keywords for that item only', async () => {
  const out = await suggestTags(env, [{ title: 'Delivered from addiction' }, { title: 'x' }], { chat: chatReturning('{"results":[{"i":0,"tags":[]},{"i":1,"tags":["youth"]}]}') });
  assert.deepEqual(out.results[0], { tags: ['deliverance'], source: 'keywords' });
  assert.deepEqual(out.results[1], { tags: ['youth'], source: 'praxiom' });
});

await test('a Praxiom failure or a missing key falls back to keywords without throwing', async () => {
  const failing = await suggestTags(env, [{ title: 'Promotion at work' }], { chat: async () => { throw Object.assign(new Error('busy'), { code: 'provider_rate_limit' }); } });
  assert.equal(failing.ai, 'error');
  assert.deepEqual(failing.results[0], { tags: ['finances'], source: 'keywords' });
  let called = false;
  const noKey = await suggestTags({}, [{ title: 'Promotion at work' }], { chat: async () => { called = true; return { text: '' }; } });
  assert.equal(called, false);
  assert.equal(noKey.ai, 'unavailable');
});

await test('Praxiom is sent only public content fields, and at most one request per batch', async () => {
  const seen = [];
  await suggestTags(env, Array.from({ length: 12 }, (_, i) => ({ title: `T${i}`, uid: 'secret-user', email: 'a@b.c' })), {
    chat: async (_env, req) => { seen.push(req); return { text: '{"results":[]}' }; },
  });
  assert.equal(seen.length, 1);
  const sent = JSON.stringify(seen[0].messages);
  assert.equal(sent.includes('secret-user'), false);
  assert.equal(sent.includes('a@b.c'), false);
  assert.equal(seen[0].messages[1].content.split('\n').length, MAX_ITEMS_PER_REQUEST);
});

console.log(`\ncontent tags: ${passed} tests passed`);
