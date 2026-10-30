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
  | 'app.open'
  | 'tutorial.intro'
  | 'tutorial.home'
  | 'tutorial.testimonies'
  | 'tutorial.live'
  | 'tutorial.resources'
  | 'tutorial.downloads'
  | 'tutorial.search'
  | 'tutorial.notifications'
  | 'tutorial.account'
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
  status: 'approved',
  script,
  captions: null,
  asset: null,
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
  'tutorial.intro': scripted('tutorial.intro', `Welcome to Testimonies of Praise!

We are delighted to have you here.

Testimonies of Praise is a platform created to share the goodness of God through powerful testimonies, inspiring experiences, praise, live broadcasts and valuable resources.

Whether you are here to watch testimonies, discover inspiring stories, enjoy live broadcasts or explore our resources, everything you need is right here.

Let us take you on a complete tour so you can discover everything the application has to offer.

Let's get started!`),
  'tutorial.home': scripted('tutorial.home', `Welcome to your Home dashboard!

This is your starting point whenever you open Testimonies of Praise.

From here, you can discover featured content, explore the latest testimonies, find important announcements and access the major sections of the application.

Take a moment to familiarize yourself with the dashboard and the navigation menu.

Everything is designed to help you stay connected and discover more of what Testimonies of Praise has to offer.

Now, let's explore the testimonies!`),
  'tutorial.testimonies': scripted('tutorial.testimonies', `Welcome to the Testimonies section!

This is where you can discover powerful experiences and stories of God's goodness shared by people.

Browse the available testimonies and open any story that catches your attention.

Depending on the content available, you can watch video testimonies, listen to audio testimonies or read written accounts.

You can also use the available sharing and interaction features to share testimonies with friends and family.

Every testimony is an opportunity to be encouraged and reminded of God's goodness.

Next, let's see how you can join our live broadcasts!`),
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
  'tutorial.downloads': scripted('tutorial.downloads', `Welcome to Downloads!

This section helps you access content you have downloaded through the application.

You can find your saved media here and enjoy supported content without needing to search for it again.

Whenever offline downloads are supported, downloading content allows you to access it later, even when you do not have an active internet connection.

Your downloaded content is organised to make it easier to find and enjoy.

Now, let's explore the other ways to discover content!`),
  'tutorial.search': scripted('tutorial.search', `Finding something specific is easy!

Use the available search functionality to look for testimonies, resources or other content within the application.

Enter what you are looking for and explore the results.

When you find something interesting, simply open it to enjoy the content.

Next, let's take a look at notifications!`),
  'tutorial.notifications': scripted('tutorial.notifications', `Stay connected with what's happening on Testimonies of Praise!

The Notifications section helps keep you informed about important updates, new testimonies, announcements and live broadcasts.

When notifications are enabled on your device, you can receive updates even when you are not actively using the application.

Simply open a notification to access the related content.

Finally, let's explore your account!`),
  'tutorial.account': scripted('tutorial.account', `This is your account and profile area.

Here, you can access the account options available to you, manage your profile and find relevant account settings.

Remember to keep your sign-in information secure.

Should you experience any account access problems, use the available account recovery options or contact the Testimonies of Praise support team.

You are now familiar with the main sections of the application!`),
  'tutorial.ending': scripted('tutorial.ending', `And that brings us to the end of your Testimonies of Praise application tour!

You have explored the Home dashboard, discovered testimonies, visited the Live section, explored the Resource Center, learned about Downloads and discovered the other important features available in the application.

We encourage you to explore, watch, listen, share and stay connected.

Thank you for being part of Testimonies of Praise.

Enjoy the experience, and remember: every testimony tells a story of God's goodness.

Welcome to Testimonies of Praise!`),
  'feature.live': entry('feature.live'),
  'feature.radio': entry('feature.radio'),
  'feature.adotopoc': entry('feature.adotopoc'),
  'feature.readTestimonies': entry('feature.readTestimonies'),
  'feature.watchTestimonies': entry('feature.watchTestimonies'),
  'feature.sponsor': entry('feature.sponsor'),
  'assistant.response': entry('assistant.response'),
};
