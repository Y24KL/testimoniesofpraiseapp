// Tests for the voiceover rules (no device or network needed).
// Run: node --experimental-strip-types --no-warnings tests/voiceover.test.mjs
import assert from 'node:assert/strict';

const { VOICEOVERS, VOICEOVER_CONFIG } = await import('../src/voiceover/manifest.ts');
const { audioSource, captionFor, cacheKey, decidePlay, musicTarget, TUTORIAL_MUSIC } = await import('../src/voiceover/logic.ts');
const { TUTORIAL_STEPS } = await import('../src/voiceover/tutorial.ts');

let n = 0;
const URL_OK = 'https://cdn.example.com/voiceovers/feature.sponsor.v1.mp3';
const entry = (over = {}) => ({
  id: 'feature.sponsor',
  version: 1,
  status: 'generated',
  script: 'Approved text.',
  captions: null,
  asset: { url: URL_OK },
  ...over,
});
const idle = { enabled: true, currentlyPlaying: null, tutorialActive: false, mainAudioBusy: false };

// Manifest: every id is defined once; nothing counts as final before its audio exists.
for (const [id, e] of Object.entries(VOICEOVERS)) {
  assert.equal(e.id, id);
  if (e.status === 'awaiting-script') assert.equal(e.asset, null, `${id} must not have audio before its script`);
  n++;
}
assert.ok(VOICEOVER_CONFIG.voiceId && VOICEOVER_CONFIG.modelId, 'voice and model must be configured');
n++;

// The welcome line is approved and bundled with the app.
assert.equal(VOICEOVERS['app.open'].script, 'Welcome to Testimonies of Praise.');
assert.equal(VOICEOVERS['app.open'].status, 'generated');
assert.equal(VOICEOVERS['app.open'].bundled, true);
n += 3;

// Tutorial steps only reference ids that exist, and cover the seven welcome-tour stops.
assert.equal(TUTORIAL_STEPS.length, 8);
for (const s of TUTORIAL_STEPS) assert.ok(VOICEOVERS[s.voice], `unknown voice id ${s.voice}`);
n += 2;

// Audio source: bundled, or a secure audio URL, and only once generated.
assert.deepEqual(audioSource(entry()), { kind: 'url', url: URL_OK });
assert.deepEqual(audioSource(entry({ asset: null, bundled: true })), { kind: 'bundled' });
assert.equal(audioSource(entry({ status: 'approved' })), null, 'approved but not generated is not playable');
assert.equal(audioSource(entry({ status: 'awaiting-script', asset: null })), null);
assert.equal(audioSource(entry({ asset: { url: 'http://insecure.example.com/a.mp3' } })), null, 'http is refused');
assert.equal(audioSource(entry({ asset: { url: 'https://cdn.example.com/a.exe' } })), null, 'non-audio file is refused');
n += 6;

// Captions: explicit captions first, then the approved script, else nothing.
assert.equal(captionFor(entry({ captions: 'Caption' })), 'Caption');
assert.equal(captionFor(entry({ captions: null, script: 'Script' })), 'Script');
assert.equal(captionFor(entry({ captions: null, script: null })), null);
n += 3;

// Cache key changes with the approved version, so updated scripts never reuse old audio.
assert.notEqual(cacheKey(entry({ version: 1 })), cacheKey(entry({ version: 2 })));
assert.equal(cacheKey(entry({ version: 3 })), 'feature.sponsor@v3');
n += 2;

// Playback decisions.
assert.deepEqual(decidePlay(entry(), idle), { action: 'play', source: { kind: 'url', url: URL_OK } });
assert.deepEqual(decidePlay(entry(), { ...idle, enabled: false }), { action: 'skip', reason: 'disabled' });
assert.deepEqual(decidePlay(entry(), { ...idle, currentlyPlaying: 'feature.sponsor' }), { action: 'skip', reason: 'duplicate' });
assert.deepEqual(decidePlay(entry(), { ...idle, tutorialActive: true }), { action: 'skip', reason: 'tutorial-active' });
assert.deepEqual(decidePlay(entry(), { ...idle, mainAudioBusy: true }), { action: 'skip', reason: 'main-audio-busy' });
assert.deepEqual(decidePlay(entry({ status: 'awaiting-script', asset: null }), idle), { action: 'skip', reason: 'no-audio' });
n += 6;

// The tour may speak over itself, but never over the radio or a testimony. The welcome line can play bundled audio.
assert.deepEqual(decidePlay(entry({ id: 'tutorial.live' }), { ...idle, tutorialActive: true }).action, 'play');
assert.equal(decidePlay(entry({ id: 'tutorial.live' }), { ...idle, tutorialActive: true, mainAudioBusy: true }).reason, 'main-audio-busy');
assert.deepEqual(decidePlay(VOICEOVERS['app.open'], idle), { action: 'play', source: { kind: 'bundled' } });
n += 3;

// Background music: only under an active, unmuted tour, quieter while narration speaks, never over radio.
const tour = { tourActive: true, enabled: true, narrating: false, mainAudioBusy: false };
assert.equal(musicTarget(tour), TUTORIAL_MUSIC.idle);
assert.equal(musicTarget({ ...tour, narrating: true }), TUTORIAL_MUSIC.ducked);
assert.ok(TUTORIAL_MUSIC.ducked < TUTORIAL_MUSIC.idle, 'music must duck under narration');
assert.equal(musicTarget({ ...tour, tourActive: false }), 0, 'silent when the tour is closed');
assert.equal(musicTarget({ ...tour, enabled: false }), 0, 'muted when voice guidance is off');
assert.equal(musicTarget({ ...tour, mainAudioBusy: true }), 0, 'never over TOP Radio or a testimony');
n += 6;

console.log(`voiceover rules: ${n} assertions passed`);
