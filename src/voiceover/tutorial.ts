import type { VoiceoverId } from './manifest';

/**
 * Welcome tour steps. Each step names the real destination it opens (see RootNavigator / TabNavigator /
 * linking.ts) and the on-screen text shown as a caption. The narration itself comes from the approved
 * script for `voice` (see manifest.ts); until that exists, the caption text is all the user sees.
 */
export type TutorialRoute =
  | { kind: 'home' }
  | { kind: 'tab'; screen: 'Live' | 'Listen' | 'Testimonies' }
  | { kind: 'stack'; screen: 'Adotopoc' | 'WrittenTestimonies' | 'Sponsor' };

export interface TutorialStep {
  voice: VoiceoverId;
  /** Label of the destination, exactly as shown in the app menu. */
  title: string;
  /** What the on-screen control does, as shown in the app (not narration). */
  caption: string;
  route: TutorialRoute;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    voice: 'tutorial.welcome',
    title: 'Home',
    caption: 'Home brings together live broadcasts, testimonies, audio and resources in one place.',
    route: { kind: 'home' },
  },
  {
    voice: 'tutorial.live',
    title: 'Click to watch Live',
    caption: 'Watch Live opens our broadcasts. When we are on air, the stream appears there with live chat.',
    route: { kind: 'tab', screen: 'Live' },
  },
  {
    voice: 'tutorial.radio',
    title: 'T.O.P on Loveworld Radio',
    caption: 'T.O.P on Loveworld Radio plays our 24/7 audio stream from the Listen tab.',
    route: { kind: 'tab', screen: 'Listen' },
  },
  {
    voice: 'tutorial.adotopoc',
    title: 'ADOTOPOC Resource Center',
    caption: 'The ADOTOPOC Resource Center has resources for hosting outreaches and crusades.',
    route: { kind: 'stack', screen: 'Adotopoc' },
  },
  {
    voice: 'tutorial.readTestimonies',
    title: 'Read Testimonies',
    caption: 'Read Testimonies opens written testimonies you can read in full and comment on.',
    route: { kind: 'stack', screen: 'WrittenTestimonies' },
  },
  {
    voice: 'tutorial.watchTestimonies',
    title: 'Watch powerful Testimonies',
    caption: 'Watch powerful Testimonies opens the video testimonies archive from the Testimonies tab.',
    route: { kind: 'tab', screen: 'Testimonies' },
  },
  {
    voice: 'tutorial.sponsor',
    title: 'Sponsor Testimonies of Praise show',
    caption: 'Sponsor the show opens the sponsorship information for Testimonies of Praise.',
    route: { kind: 'stack', screen: 'Sponsor' },
  },
];
