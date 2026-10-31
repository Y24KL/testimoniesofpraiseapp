/**
 * VOICEOVER MANIFEST: the one place that maps every narration to its approved script, voice and audio.
 *
 * How a script becomes audio (full steps in docs/VOICEOVERS.md):
 * 1. Paste the approved script into `script` below and set `status: 'approved'`. Bump `version`
 *whenever the approved wording changes, so old audio is never replayed by mistake.
 *   2. Run `npm run voiceovers:generate` (ElevenLabs key read from .env.local, never printed).
 *      Drafts are written to voiceover-drafts/ (git-ignored) for listening.
 *   3. After approval, upload the mp3 to the CDN and set `asset.url` and `status: 'generated'`.
 *
 * Until a script is approved, `status` stays 'awaiting-script' and the app shows captions/text only.
 * No placeholder text or audio is ever played as if it were final narration.
 */
export type VoiceoverId =
  | 'app.open'
  | 'tutorial.intro'
  | 'tutorial.home'
  | 'tutorial.testimonies'
  | 'tutorial.read'
  | 'tutorial.ai'
  | 'tutorial.live'
  | 'tutorial.resources'
  | 'tutorial.ending'
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
  /** True when the approved audio is bundled into the app (see bundled.ts) instead of a CDN URL. */
  bundled?: boolean;
}

export const VOICEOVER_CONFIG = {
  /** Brian: "Deep, Resonant and Comforting" (male, American). Chosen from the ElevenLabs library; change freely. */
  voiceId: 'nPczCjzI2devNBz1zQrb',
  /** Current multilingual TTS model (listed by ElevenLabs /v1/models). */
  modelId: 'eleven_multilingual_v2',
  outputFormat: 'mp3_44100_128',
  voiceSettings: { stability: 0.55, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
} as const;

/** Approved wording supplied by the project owner. Audio is generated separately (see docs/VOICEOVERS.md). */
const scripted = (id: VoiceoverId, script: string): VoiceoverEntry => ({
  id,
  version: 1,
  status: 'generated',
  script,
  captions: null,
  asset: null,
  bundled: true,
});

const entry = (id: VoiceoverId): VoiceoverEntry => ({
  id,
  version: 1,
  status: 'awaiting-script',
  script: null,
  captions: null,
  asset: null,
});

export const VOICEOVERS: Record<VoiceoverId, VoiceoverEntry> = {
  // Played once each time the app opens. The owner approved this exact wording.
  'app.open': {
    id: 'app.open',
    version: 1,
    status: 'generated',
    script: 'Welcome to Testimonies of Praise.',
    captions: 'Welcome to Testimonies of Praise',
    asset: null,
    bundled: true,
  },
  'tutorial.intro': { ...scripted('tutorial.intro', `Testimonies of Praise is an LMM TV production in collaboration with Loveworld XP, dedicated to showcasing the life-changing impact of the songs by the Loveworld Singers.

Through powerful, real-life testimonies, the programme reveals how these inspired songs have brought healing, hope, restoration, miracles, and transformation to countless lives around the world. In the past year alone, more than 500 life-changing testimonies have been shared, demonstrating the undeniable power of God's Word expressed through music.

Beyond inspiring testimonies, Testimonies of Praise also serves as a platform for promoting the Ministry of Music's products, services, and initiatives, while providing updates on major events and programmes across the Loveworld Nation.`), version: 2 },
  'tutorial.home': scripted('tutorial.home', `Welcome to your Home dashboard!

This is your starting point whenever you open Testimonies of Praise.

From here, you can discover featured content, explore the latest testimonies, find important announcements and access the major sections of the application.

Take a moment to familiarize yourself with the dashboard and the navigation menu.

Everything is designed to help you stay connected and discover more of what Testimonies of Praise has to offer.

Now, let's explore the testimonies!`),
  'tutorial.testimonies': { ...scripted('tutorial.testimonies', `Discover inspiring testimonies that share stories of faith, answered prayers, transformation, and God's goodness by listening to the Loveworld Singers.`), version: 2 },
  'tutorial.live': scripted('tutorial.live', `Welcome to the Live section!

This is where you can connect with Testimonies of Praise during live broadcasts.

Whenever a broadcast is available, you can access it directly from this section and enjoy the experience in real time.

You can also use the available playback controls to manage your viewing experience.

When there is no active broadcast, you can check back later or enable notifications to stay informed about upcoming live sessions.

Now, let's discover the Resource Center!`),
  'tutorial.resources': scripted('tutorial.resources', `Welcome to the Resource Center!

This section gives you access to additional materials available through Testimonies of Praise.

Explore the available resources, discover helpful content and open materials that interest you.

Whether you are looking for videos, audio or other ministry resources, this is where you can explore more.

Take some time to discover what is available.

Next, let's look at the Downloads section!`),
  'tutorial.read': { ...scripted('tutorial.read', `Read Testimonies lets you read written testimonies in full. Open any story that catches your attention, and when you are ready, leave a comment to share how it encouraged you.`) },
  'tutorial.ai': { ...scripted('tutorial.ai', `Our T.O.P AI Assistant can help you in a few ways. It can find testimonies by what they are about. It can find a moment inside a video, such as the part where someone prays, and open it for you. It can show you around the app, and answer general questions with sources from the web. Find it in the Assistant tab.`) },
  'tutorial.ending': entry('tutorial.ending'), // silent: the closing step shows its caption only
  'feature.live': entry('feature.live'),
  'feature.radio': entry('feature.radio'),
  'feature.adotopoc': entry('feature.adotopoc'),
  'feature.readTestimonies': entry('feature.readTestimonies'),
  'feature.watchTestimonies': entry('feature.watchTestimonies'),
  'feature.sponsor': entry('feature.sponsor'),
  'assistant.response': scripted(
    'assistant.response',
    "Hello, I'm the T.O.P AI Assistant. I can help you find a testimony by what it is about, point you to a moment inside a video, show you around the app, and answer your general questions. Just ask, and I'll do my best to help.",
  ),
};
