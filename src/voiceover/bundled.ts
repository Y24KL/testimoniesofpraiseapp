import type { VoiceoverId } from './manifest';

/**
 * Approved narration bundled into the app (small clips only). An entry uses this when its manifest
 * entry sets `bundled: true`. Larger or updated clips should go to the CDN instead (see docs/VOICEOVERS.md).
 */
export const BUNDLED_AUDIO: Partial<Record<VoiceoverId, number>> = {
  'app.open': require('../../assets/voiceovers/app.open.v1.mp3'),
  'tutorial.intro': require('../../assets/voiceovers/tutorial.intro.v2.mp3'),
  'tutorial.home': require('../../assets/voiceovers/tutorial.home.v1.mp3'),
  'tutorial.testimonies': require('../../assets/voiceovers/tutorial.testimonies.v2.mp3'),
  'tutorial.read': require('../../assets/voiceovers/tutorial.read.v1.mp3'),
  'tutorial.ai': require('../../assets/voiceovers/tutorial.ai.v1.mp3'),
  'tutorial.live': require('../../assets/voiceovers/tutorial.live.v1.mp3'),
  'tutorial.resources': require('../../assets/voiceovers/tutorial.resources.v1.mp3'),
  'assistant.response': require('../../assets/voiceovers/assistant.response.v1.mp3'),
};
