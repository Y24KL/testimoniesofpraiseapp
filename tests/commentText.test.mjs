// Unit tests for the comment text rules (mobile + website copies must behave the same).
// Run: node --experimental-strip-types tests/commentText.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = await import('../src/utils/commentText.ts');
const web = await import('../web/src/utils/commentText.ts');
const body = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').split('\n').slice(1).join('\n');
assert.equal(body('../src/utils/commentText.ts'), body('../web/src/utils/commentText.ts'), 'mobile and web commentText.ts drifted apart');

let n = 0;
for (const m of [mobile, web]) {
  assert.equal(m.MAX_COMMENT_LENGTH, 1000);
  assert.equal(m.normalizeCommentText('  hi\r\nthere  '), 'hi\nthere');
  assert.match(m.commentTextError(''), /Write something/);
  assert.match(m.commentTextError('   \n\t '), /Write something/);
  assert.equal(m.commentTextError('Praise God!'), null);
  assert.equal(m.commentTextError('a'.repeat(1000)), null);
  assert.equal(m.commentTextError(`  ${'a'.repeat(1000)}  `), null, 'surrounding whitespace is trimmed before counting');
  assert.match(m.commentTextError('a'.repeat(1001)), /up to 1000/);
  assert.equal(m.commenterName('  Grace   Ade '), 'Grace Ade');
  assert.equal(m.commenterName(''), 'Member');
  assert.equal(m.commenterName(null), 'Member');
  assert.equal(m.commenterName('someone@example.com'), 'Member', 'emails are never shown');
  assert.equal(m.commenterName('x'.repeat(80)).length, 60);
  n += 13;
}
console.log(`commentText: ${n} assertions passed`);
