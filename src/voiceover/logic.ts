/**
 * Pure voiceover rules, with no React or native imports, so tests can run them directly
 * (tests/voiceover.test.mjs). The playback provider uses these to decide what to do.
 */
import type { VoiceoverEntry, VoiceoverId } from './manifest';

/** Where the audio for an entry comes from, or null when there is no approved audio yet. */
export function playableUrl(entry: VoiceoverEntry): string | null {
  if (entry.status !== 'generated' || !entry.asset) return null;
  const url = entry.asset.url.trim();
  return /^https:\/\/\S+\.(mp3|m4a|aac|wav)(\?\S*)?$/i.test(url) ? url : null;
}

/** Caption text to show: the entry's own captions, else the approved script, else nothing. */
export function captionFor(entry: VoiceoverEntry): string | null {
  return entry.captions?.trim() || entry.script?.trim() || null;
}

/** Cache key: changes when the approved version changes, so old audio is never replayed. */
export const cacheKey = (entry: VoiceoverEntry) => `${entry.id}@v${entry.version}`;

export type PlayDecision =
  | { action: 'play'; url: string }
  | { action: 'skip'; reason: 'disabled' | 'duplicate' | 'tutorial-active' | 'main-audio-busy' | 'no-audio' };

/**
 * Whether a narration may start now.
 *  - disabled:         the user switched voice guidance off
 *  - duplicate:        this same narration is already playing (re-render / refocus)
 *  - tutorial-active:  a feature narration never talks over the tutorial
 *  - main-audio-busy:  TOP Radio or a testimony is playing; never interrupt it
 *  - no-audio:         no approved, published audio for this entry (text is shown instead)
 */
export function decidePlay(
  entry: VoiceoverEntry,
  state: { enabled: boolean; currentlyPlaying: VoiceoverId | null; tutorialActive: boolean; mainAudioBusy: boolean },
): PlayDecision {
  if (!state.enabled) return { action: 'skip', reason: 'disabled' };
  if (state.currentlyPlaying === entry.id) return { action: 'skip', reason: 'duplicate' };
  if (state.tutorialActive && !entry.id.startsWith('tutorial.')) return { action: 'skip', reason: 'tutorial-active' };
  if (state.mainAudioBusy) return { action: 'skip', reason: 'main-audio-busy' };
  const url = playableUrl(entry);
  if (!url) return { action: 'skip', reason: 'no-audio' };
  return { action: 'play', url };
}

