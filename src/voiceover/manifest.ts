/**
 * VOICEOVER MANIFEST: the one place that maps every narration to its approved script, voice and audio.
 *
 * How a script becomes audio (full steps in docs/VOICEOVERS.md):
 *   1. Paste the approved script into `script` below and set `status: 'approved'`. Bump `version`
 *      whenever the approved wording changes, so old audio is never replayed by mistake.
 *   2. Run `npm run voiceovers:generate` (ElevenLabs key read from .env.local, never printed).
 *      Drafts are written to voiceover-drafts/ (git-ignored) for listening.
 *   3. After approval, upload the mp3 to the CDN and set `asset.url` and `status: 'generated'`.
 *
 * Until a script is approved, `status` stays 'awaiting-script' and the app shows captions/text only.
 * No placeholder text or audio is ever played as if it were final narration.
 */
export type VoiceoverId =
  | 'tutorial.welcome'
  | 'tutorial.live'
  | 'tutorial.radio'
  | 'tutorial.adotopoc'
  | 'tutorial.readTestimonies'
  | 'tutorial.watchTestimonies'
  | 'tutorial.sponsor'
  | 'feature.live'
  | 'feature.radio'
  | 'feature.adotopoc'
  | 'feature.readTestimonies'
  | 'feature.watchTestimonies'
  | 'feature.sponsor'
  | 'assistant.response';

export type VoiceoverStatus = 'awaiting-script' | 'approved' | 'generated';

export interface VoiceoverEntry {
  id: VoiceoverId;
  /** Bump when the approved wording changes; the cache key includes it. */
  version: number;
  status: VoiceoverStatus;
  /** Approved narration text. null until supplied. */
  script: string | null;
  /** Text shown on screen as captions. Defaults to `script` when null. */
  captions: string | null;
  /** Optional per-entry voice override; otherwise VOICEOVER_CONFIG.voiceId is used. */
  voiceId?: string;
  /** Published audio location (CDN URL) once uploaded. */
  asset: { url: string } | null;
}

export const VOICEOVER_CONFIG = {
  /** Brian: "Deep, Resonant and Comforting" (male, American). Chosen from the ElevenLabs library; change freely. */
  voiceId: 'nPczCjzI2devNBz1zQrb',
  /** Current multilingual TTS model (listed by ElevenLabs /v1/models). */
  modelId: 'eleven_multilingual_v2',
  outputFormat: 'mp3_44100_128',
  voiceSettings: { stability: 0.55, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
} as const;

const entry = (id: VoiceoverId): VoiceoverEntry => ({
  id,
  version: 1,
  status: 'awaiting-script',
  script: null,
  captions: null,
  asset: null,
});

export const VOICEOVERS: Record<VoiceoverId, VoiceoverEntry> = {
  'tutorial.welcome': entry('tutorial.welcome'),
  'tutorial.live': entry('tutorial.live'),
  'tutorial.radio': entry('tutorial.radio'),
  'tutorial.adotopoc': entry('tutorial.adotopoc'),
  'tutorial.readTestimonies': entry('tutorial.readTestimonies'),
  'tutorial.watchTestimonies': entry('tutorial.watchTestimonies'),
  'tutorial.sponsor': entry('tutorial.sponsor'),
  'feature.live': entry('feature.live'),
  'feature.radio': entry('feature.radio'),
  'feature.adotopoc': entry('feature.adotopoc'),
  'feature.readTestimonies': entry('feature.readTestimonies'),
  'feature.watchTestimonies': entry('feature.watchTestimonies'),
  'feature.sponsor': entry('feature.sponsor'),
  'assistant.response': entry('assistant.response'),
};
