import type { VoiceoverId } from './manifest';

/**
 * Approved narration bundled into the app (small clips only). An entry uses this when its manifest
 * entry sets `bundled: true`. Larger or updated clips should go to the CDN instead (see docs/VOICEOVERS.md).
 */
export const BUNDLED_AUDIO: Partial<Record<VoiceoverId, number>> = {
  'app.open': require('../../assets/voiceovers/app.open.v1.mp3'),
};
