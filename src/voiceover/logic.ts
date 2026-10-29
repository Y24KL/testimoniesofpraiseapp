/**
 * Pure voiceover rules, with no React or native imports, so tests can run them directly
 * (tests/voiceover.test.mjs). The playback provider uses these to decide what to do.
 */
import type { VoiceoverEntry, VoiceoverId } from './manifest';

export type AudioSource = { kind: 'bundled' } | { kind: 'url'; url: string };

/** Where the approved audio for an entry comes from, or null when there is none yet. */
export function audioSource(entry: VoiceoverEntry): AudioSource | null {
  if (entry.status !== 'generated') return null;
  if (entry.bundled) return { kind: 'bundled' };
  if (!entry.asset) return null;
  const url = entry.asset.url.trim();
  return /^https:\/\/\S+\.(mp3|m4a|aac|wav)(\?\S*)?$/i.test(url) ? { kind: 'url', url } : null;
}

/** Caption text to show: the entry's own captions, else the approved script, else nothing. */
export function captionFor(entry: VoiceoverEntry): string | null {
  return entry.captions?.trim() || entry.script?.trim() || null;
}

/** Cache key: changes when the approved version changes, so old audio is never replayed. */
export const cacheKey = (entry: VoiceoverEntry) => `${entry.id}@v${entry.version}`;

export type PlayDecision =
  | { action: 'play'; source: AudioSource }
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
  const source = audioSource(entry);
  if (!source) return { action: 'skip', reason: 'no-audio' };
  return { action: 'play', source };
}


/**
 * Background music under the welcome tour (the user's own recording, assets/audio/tutorial-bed.mp3).
 * Levels are 0..1 player volume. It is quieter while narration speaks, so the words stay clear.
 */
export const TUTORIAL_MUSIC = { idle: 0.3, ducked: 0.08 } as const;

/** The music level to aim for now. 0 means silent (tour closed, muted, or the radio/testimony is playing). */
export function musicTarget(state: { tourActive: boolean; enabled: boolean; narrating: boolean; mainAudioBusy: boolean }): number {
  if (!state.tourActive || !state.enabled || state.mainAudioBusy) return 0;
  return state.narrating ? TUTORIAL_MUSIC.ducked : TUTORIAL_MUSIC.idle;
}
