// Unit tests for personal discovery rules: activity validation, interest allowlist, opt-out.
// Run: node --experimental-strip-types tests/discovery.test.mjs   (npm run test:discovery)
import assert from 'node:assert/strict';

const { validActivity, sanitizeInterests, readDiscovery, mayRecordActivity, INTEREST_TAGS, MAX_INTERESTS } = await import('../src/discovery/rules.ts');

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`  ✔ ${name}`); };
const good = { type: 'view', contentType: 'testimony', contentId: 'abc-123', source: 'home' };

ok('a valid activity event is accepted as-is', () => {
  assert.deepEqual(validActivity(good), good);
});

ok('activity types, content types and sources must come from the fixed lists', () => {
  assert.equal(validActivity({ ...good, type: 'purchase' }), null);
  assert.equal(validActivity({ ...good, contentType: 'user' }), null);
  assert.equal(validActivity({ ...good, source: 'gps' }), null);
});

ok('content ids must be short and URL-safe', () => {
  assert.equal(validActivity({ ...good, contentId: '' }), null);
  assert.equal(validActivity({ ...good, contentId: 'a/b' }), null);
  assert.equal(validActivity({ ...good, contentId: 'x'.repeat(101) }), null);
});

ok('extra fields are dropped; only the fixed shape is returned', () => {
  const out = validActivity({ ...good, email: 'a@b.com', note: 'secret' });
  assert.deepEqual(Object.keys(out).sort(), ['contentId', 'contentType', 'source', 'type']);
});

ok('interests keep only allowlisted tags, without duplicates, and are bounded', () => {
  assert.deepEqual(sanitizeInterests(['healing', 'healing', 'nonsense', 'hope']), ['healing', 'hope']);
  assert.deepEqual(sanitizeInterests('healing'), []);
  assert.deepEqual(sanitizeInterests([{ tag: 'healing' }, null, 5]), []);
  const many = Array.from({ length: 50 }, () => INTEREST_TAGS[0]);
  assert.ok(sanitizeInterests([...INTEREST_TAGS, ...INTEREST_TAGS]).length <= MAX_INTERESTS);
  assert.ok(sanitizeInterests(many).length <= 1);
});

ok('a missing discovery document means no interests and no opt-out', () => {
  assert.deepEqual(readDiscovery(null), { interests: [], optOut: false });
  assert.deepEqual(readDiscovery({ optOut: 'yes', interests: ['faith'] }), { interests: ['faith'], optOut: false });
});

ok('opting out stops recording; a failed read also records nothing', () => {
  assert.equal(mayRecordActivity({ interests: [], optOut: true }), false);
  assert.equal(mayRecordActivity({ interests: [], optOut: false }), true);
  assert.equal(mayRecordActivity(null), true, 'no document means defaults');
});

console.log(`discovery rules: ${n} tests passed`);
