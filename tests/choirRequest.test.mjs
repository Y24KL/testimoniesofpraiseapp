// Unit tests for "Feature your choir/group on T.O.P" request validation.
// Run: node --experimental-strip-types tests/choirRequest.test.mjs
import assert from 'node:assert/strict';

const { validateChoirRequest, isSupportedMinistrationUrl, CHOIR_LIMITS } = await import('../src/utils/choirRequest.ts');

let n = 0;
const good = {
  groupName: '  Grace Voices  ',
  churchZone: 'Lagos Zone 1',
  ministrationUrl: 'https://www.youtube.com/watch?v=abc123',
  songTitle: 'Amazing Grace',
};

// A complete request has no errors.
assert.deepEqual(validateChoirRequest(good), {});
n++;

// Every required field is reported when blank.
const blank = validateChoirRequest({ groupName: '  ', churchZone: '', ministrationUrl: ' ', songTitle: '' });
assert.equal(Object.keys(blank).length, 4);
assert.equal(blank.groupName, 'Enter your group or choir name.');
assert.equal(blank.churchZone, 'Enter your church zone.');
assert.equal(blank.ministrationUrl, 'Paste the link to your ministration video.');
assert.equal(blank.songTitle, 'Enter the song title.');
n++;

// Supported video hosts over https.
for (const url of [
  'https://youtu.be/abc123',
  'https://m.youtube.com/watch?v=abc123',
  'https://www.facebook.com/somepage/videos/1234',
  'https://fb.watch/xyz/',
  'https://vimeo.com/123456',
]) {
  assert.equal(isSupportedMinistrationUrl(url), true, url);
}
n++;

// Anything else is rejected, with a clear message.
for (const url of [
  'http://www.youtube.com/watch?v=abc123', // not https
  'https://example.com/video.mp4', // unsupported host
  'https://youtube.com.evil.example/watch', // lookalike host
  'youtube.com/watch?v=abc123', // no scheme
  'not a url',
]) {
  assert.equal(isSupportedMinistrationUrl(url), false, url);
  assert.equal(validateChoirRequest({ ...good, ministrationUrl: url }).ministrationUrl, 'Use a secure link from YouTube, Facebook or Vimeo.');
}
n++;

// Length limits.
const long = 'x'.repeat(CHOIR_LIMITS.groupName + 1);
assert.equal(validateChoirRequest({ ...good, groupName: long }).groupName, 'This name is too long.');
assert.equal(validateChoirRequest({ ...good, songTitle: 'x'.repeat(CHOIR_LIMITS.songTitle + 1) }).songTitle, 'This title is too long.');
n++;

console.log(`choirRequest tests passed (${n} groups)`);
