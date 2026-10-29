// Tests for the voiceover rules (no device or network needed).
// Run: node --experimental-strip-types --no-warnings tests/voiceover.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { VOICEOVERS, VOICEOVER_CONFIG } = await import('../src/voiceover/manifest.ts');
const { playableUrl, captionFor, cacheKey, decidePlay } = await import('../src/voiceover/logic.ts');
const { TUTORIAL_STEPS } = await import('../src/voiceover/tutorial.ts');

let n = 0;
const entry = (over = {}) => ({ id: 'feature.sponsor', version: 1, status: 'generated', script: 'Approved text.', captions: null, asset: { url: 'https://cdn.example.com/voiceovers/feature.sponsor.v1.mp3' }, ...over });
const idle = { enabled: true, currentlyPlaying: null, tutorialActive: false, mainAudioBusy: false };

// Manifest: every id is defined once, and nothing is marked as final before its script exists.
for (const [id, e] of Object.entries(VOICEOVERS)) {
  assert.equal(e.id, id);
  if (e.status === 'awaiting-script') assert.equal(e.asset, null, `${id} must not have audio before its script`);
  n++;
}
assert.ok(VOICEOVER_CONFIG.voiceId && VOICEOVER_CONFIG.modelId, 'voice and model must be configured');
n++;

// Tutorial steps only reference ids that exist in the manifest and cover the six destinations.
assert.equal(TUTORIAL_STEPS.length, 7);
for (const s of TUTORIAL_STEPS) assert.ok(VOICEOVERS[s.voice], `unknown voice id ${s.voice}`);
n += 2;

// Playable only when generated, with an https audio URL.
assert.equal(playableUrl(entry()), 'https://cdn.example.com/voiceovers/feature.sponsor.v1.mp3');
assert.equal(playableUrl(entry({ status: 'approved' })), null, 'approved but not generated is not playable');
assert.equal(playableUrl(entry({ status: 'awaiting-script', asset: null })), null);
assert.equal(playableUrl(entry({ asset: { url: 'http://insecure.example.com/a.mp3' } })), null, 'http is refused');
assert.equal(playableUrl(entry({ asset: { url: 'https://cdn.example.com/a.exe' } })), null, 'non-audio file is refused');
n += 5;

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
assert.deepEqual(decidePlay(entry(), idle), { action: 'play', url: entry().asset.url });
assert.deepEqual(decidePlay(entry(), { ...idle, enabled: false }), { action: 'skip', reason: 'disabled' });
assert.deepEqual(decidePlay(entry(), { ...idle, currentlyPlaying: 'feature.sponsor' }), { action: 'skip', reason: 'duplicate' });
assert.deepEqual(decidePlay(entry(), { ...idle, tutorialActive: true }), { action: 'skip', reason: 'tutorial-active' });
assert.deepEqual(decidePlay(entry(), { ...idle, mainAudioBusy: true }), { action: 'skip', reason: 'main-audio-busy' });
assert.deepEqual(decidePlay(entry({ status: 'awaiting-script', asset: null }), idle), { action: 'skip', reason: 'no-audio' });
n += 6;

// The tutorial may speak over itself, but never over the radio or a testimony.
assert.deepEqual(decidePlay(entry({ id: 'tutorial.live' }), { ...idle, tutorialActive: true }).action, 'play');
assert.equal(decidePlay(entry({ id: 'tutorial.live' }), { ...idle, tutorialActive: true, mainAudioBusy: true }).reason, 'main-audio-busy');
n += 2;

console.log(`voiceover rules: ${n} assertions passed`);
