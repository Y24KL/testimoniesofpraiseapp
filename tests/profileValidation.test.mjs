// Unit tests for the registration profile rules. Run: node --experimental-strip-types tests/profileValidation.test.mjs
import assert from 'node:assert/strict';

const { validateProfile, normalizeText, PROFILE_TITLES } = await import('../src/profile/validation.ts');

let n = 0;
const ok = (input) => {
  const r = validateProfile(input);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.value;
};
const errs = (input) => {
  const r = validateProfile(input);
  assert.equal(r.ok, false);
  return r.errors;
};

assert.deepEqual([...PROFILE_TITLES], ['Mr', 'Mrs', 'Ms', 'Bro', 'Sis', 'Deacon', 'Deaconess', 'Pastor', 'Evangelist']);
n++;
assert.equal(normalizeText('  Ada   Obi  '), 'Ada Obi');
assert.equal(normalizeText('   '), '');
assert.equal(normalizeText(undefined), '');
n += 3;

const good = { title: 'Pastor', fullName: '  Ada   Obi ', zone: ' Lagos Zone 1', church: 'Christ Embassy  Lagos ' };
assert.deepEqual(ok(good), { title: 'Pastor', fullName: 'Ada Obi', zone: 'Lagos Zone 1', church: 'Christ Embassy Lagos' });
n++;

for (const t of PROFILE_TITLES) {
  assert.equal(ok({ ...good, title: t }).title, t);
  n++;
}

// Required fields reject missing, empty and whitespace-only values.
assert.ok(errs({ ...good, title: '' }).title);
assert.ok(errs({ ...good, title: 'Chief' }).title);
assert.ok(errs({ ...good, fullName: '' }).fullName);
assert.ok(errs({ ...good, fullName: '     ' }).fullName);
assert.ok(errs({ ...good, zone: '\t\n' }).zone);
assert.ok(errs({ ...good, church: '' }).church);
n += 6;

assert.ok(errs({ ...good, fullName: 'A' }).fullName, 'one-letter names are rejected');
assert.ok(errs({ ...good, fullName: 'x'.repeat(121) }).fullName);
assert.ok(errs({ ...good, zone: 'z'.repeat(121) }).zone);
assert.ok(errs({ ...good, church: 'c'.repeat(161) }).church);
assert.equal(ok({ ...good, fullName: 'Ab' }).fullName, 'Ab', 'two letters is the minimum');
assert.equal(ok({ ...good, church: 'c'.repeat(160) }).church.length, 160);
n += 6;

// Several problems are all reported at once, so the form can show every message.
const many = errs({ title: '', fullName: '', zone: '', church: '' });
assert.deepEqual(Object.keys(many).sort(), ['church', 'fullName', 'title', 'zone']);
n++;

// The website keeps its own copy of the rules (no shared build). They must stay identical.
const { readFileSync } = await import('node:fs');
const body = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n').split('\n').slice(1).join('\n');
assert.equal(body('../src/profile/validation.ts'), body('../web/src/profile/validation.ts'), 'mobile and web profile validation drifted apart');
n++;

console.log(`profile validation: ${n} assertions passed`);
