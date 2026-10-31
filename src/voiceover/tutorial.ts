import type { VoiceoverId } from './manifest';

/**
 * Guided app tour: the main features only. Each step opens the real screen it describes (see RootNavigator /
 * TabNavigator) and shows a short on-screen caption. The narration for `voice` comes from its script in
 * manifest.ts; the audio is bundled from the generated drafts.
 */
export type TutorialRoute =
  | { kind: 'home' }
  | { kind: 'tab'; screen: 'Testimonies' | 'Live' | 'Assistant' }
  | { kind: 'stack'; screen: 'Adotopoc' | 'WrittenTestimonies' };

export interface TutorialStep {
  voice: VoiceoverId;
  /** Label of the destination, as shown in the app. */
  title: string;
  /** What the screen is for, shown on the tour card (not narration). */
  caption: string;
  route: TutorialRoute;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    voice: 'tutorial.intro',
    title: 'Welcome',
    caption: 'Testimonies of Praise shares testimonies, live broadcasts and resources.',
    route: { kind: 'home' },
  },
  {
    voice: 'tutorial.home',
    title: 'Home',
    caption: 'Home shows featured content, the latest testimonies and announcements.',
    route: { kind: 'home' },
  },
  {
    voice: 'tutorial.live',
    title: 'Watch Live',
    caption: 'Watch our live broadcasts here, with live chat when we are on air.',
    route: { kind: 'tab', screen: 'Live' },
  },
  {
    voice: 'tutorial.testimonies',
    title: 'Watch Testimonies',
    caption: 'Browse and watch video testimonies from the Testimonies tab.',
    route: { kind: 'tab', screen: 'Testimonies' },
  },
  {
    voice: 'tutorial.read',
    title: 'Read Testimonies',
    caption: 'Read written testimonies in full and leave a comment.',
    route: { kind: 'stack', screen: 'WrittenTestimonies' },
  },
  {
    voice: 'tutorial.resources',
    title: 'ADOTOPOC Resource Center',
    caption: 'Materials for hosting outreaches and crusades.',
    route: { kind: 'stack', screen: 'Adotopoc' },
  },
  {
    voice: 'tutorial.ai',
    title: 'AI features',
    caption: 'The T.O.P AI Assistant finds testimonies and moments in videos, and answers your questions.',
    route: { kind: 'tab', screen: 'Assistant' },
  },
  {
    voice: 'tutorial.ending',
    title: 'Home',
    caption: 'That is the tour. You can replay it from the menu.',
    route: { kind: 'home' },
  },
];
