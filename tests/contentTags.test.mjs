// The interest tag list exists in five places: the Worker, the admin portal, the app, the website and the Firestore
// rules. They must be identical (same tags, same order), or tags saved in one place are refused or
// ignored in another. Run: node --experimental-strip-types tests/contentTags.test.mjs (npm run test:content-tags)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const listFrom = (src, re, where) => {
  const m = src.match(re);
  assert.ok(m, `tag list not found in ${where}`);
  return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
};

const worker = listFrom(read('top-admin/worker/src/tags.js'), /export const CONTENT_TAGS = \[([^\]]*)\]/, 'worker/src/tags.js');
const admin = listFrom(read('top-admin/web/src/tags.ts'), /export const CONTENT_TAGS = \[([^\]]*)\]/, 'web/src/tags.ts');
const web = listFrom(read('web/src/api/personalHome.ts'), /export const INTEREST_TAGS = \[([^\]]*)\]/, 'web/src/api/personalHome.ts');
const app = listFrom(read('src/discovery/rules.ts'), /export const INTEREST_TAGS = \[([^\]]*)\]/, 'src/discovery/rules.ts');
const rules = listFrom(read('top-admin/firestore.rules'), /function validContentTags\(\) \{[\s\S]*?hasOnly\(\[([^\]]*)\]\)/, 'firestore.rules');

assert.equal(worker.length, 12);
assert.equal(new Set(worker).size, worker.length, 'no duplicates');
assert.deepEqual(admin, worker, 'admin portal list matches the Worker');
assert.deepEqual(app, worker, 'app interest list matches the Worker');
assert.deepEqual(web, worker, 'website interest list matches the Worker');
assert.deepEqual(rules, worker, 'Firestore rules list matches the Worker');

// The app's own helper accepts exactly these tags.
const { sanitizeInterests } = await import('../src/discovery/rules.ts');
assert.deepEqual(sanitizeInterests([...worker, 'politics']), worker);

console.log('content tag lists: 7 checks passed');
