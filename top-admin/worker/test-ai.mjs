import assert from 'node:assert/strict';
import { createEmbeddings, normalizeSearchSources, validateSearchQuery, enforceAiRateLimit, semanticSearch } from './src/ai.js';

assert.equal(validateSearchQuery('  healing testimonies  '), 'healing testimonies');
assert.throws(() => validateSearchQuery('   '), /Enter a search question/);
assert.throws(() => validateSearchQuery('x'.repeat(1001)), /1,000 characters/);

const clean = normalizeSearchSources([
  { title: 'Valid', url: 'https://example.com/a', snippet: 'snippet' },
  { title: 'Invalid scheme', url: 'javascript:alert(1)' },
  { title: 'Credential URL', url: 'https://user:pass@example.com' },
  { title: 'No URL' },
]);
assert.equal(clean.length, 1);
assert.equal(clean[0].url, 'https://example.com/a');

const kv = new Map();
const fakeKv = {
  async get(key) { return kv.get(key) ?? null; },
  async put(key, value) { kv.set(key, value); },
};
await enforceAiRateLimit({ OTP_KV: fakeKv }, 'uid1', 'search', 2);
await enforceAiRateLimit({ OTP_KV: fakeKv }, 'uid1', 'search', 2);
await assert.rejects(() => enforceAiRateLimit({ OTP_KV: fakeKv }, 'uid1', 'search', 2), (e) => e.status === 429);

const embedding = Array(1024).fill(0.1);
const embedded = await createEmbeddings({ AI: { async run(model, { text }) {
  assert.equal(model, '@cf/baai/bge-m3');
  return { shape: [text.length, 1024], data: text.map(() => embedding) };
} } }, ['one', 'two']);
assert.equal(embedded.embeddings.length, 2);
assert.equal(embedded.dimensions, 1024);
await assert.rejects(() => createEmbeddings({ AI: { async run() { return { data: [Array(20).fill(0.1)] }; } } }, ['one']), (e) => e.code === 'embedding_model_changed');

// Verify the Standard Firestore REST findNearest query uses the caller token and a 1024-d vector.
{
  const previousFetch = globalThis.fetch;
  let requestedQuery;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /firestore\.googleapis\.com\/v1\/projects\/testimoniesofpraiseapp\/databases\/\(default\)\/documents:runQuery$/);
    assert.equal(init.headers.Authorization, 'Bearer FirebaseTestToken');
    requestedQuery = JSON.parse(init.body).structuredQuery;
    return new Response(JSON.stringify([{
      document: {
        name: 'projects/testimoniesofpraiseapp/databases/(default)/documents/testimonies/testimony-1',
        fields: {
          title: { stringValue: 'A testimony of healing' },
          description: { stringValue: 'A public story about recovery after prayer.' },
          isPublished: { booleanValue: true },
          keywords: { arrayValue: { values: [{ stringValue: 'healing' }, { stringValue: 'prayer' }] } },
        },
      },
    }]), { status: 200 });
  };
  try {
    const semantic = await semanticSearch({
      FIREBASE_PROJECT_ID: 'testimoniesofpraiseapp',
      AI: { async run(_model, { text }) { return { shape: [text.length, 1024], data: text.map(() => Array(1024).fill(0.1)) }; } },
    }, 'Bearer FirebaseTestToken', 'find testimonies about healing');
    assert.equal(requestedQuery.findNearest.vectorField.fieldPath, 'aiEmbedding');
    assert.equal(requestedQuery.findNearest.queryVector.mapValue.fields.__type__.stringValue, '__vector__');
    assert.equal(requestedQuery.findNearest.queryVector.mapValue.fields.value.arrayValue.values.length, 1024);
    assert.equal(requestedQuery.where.fieldFilter.value.booleanValue, true);
    assert.equal(semantic.results.length, 1);
    assert.equal(semantic.results[0].id, 'testimony-1');
    assert.equal(semantic.results[0].title, 'A testimony of healing');
    assert.equal(semantic.results[0].isPublished, true);
    assert.deepEqual(semantic.results[0].keywords, ['healing', 'prayer']);
  } finally {
    globalThis.fetch = previousFetch;
  }
}

console.log('AI module unit tests passed.');
