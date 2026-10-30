import type { VoiceoverId } from './manifest';

/**
 * Guided app tour. Each step opens the real screen it describes (see RootNavigator / TabNavigator) and
 * shows a short on-screen caption. The narration for `voice` comes from its script in manifest.ts; no
 * audio plays until that narration has been generated and published.
 */
export type TutorialRoute =
  | { kind: 'home' }
  | { kind: 'tab'; screen: 'Testimonies' | 'Live' | 'Downloads' }
  | { kind: 'stack'; screen: 'Adotopoc' | 'Search' | 'Notifications' | 'Profile' };

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
    voice: 'tutorial.testimonies',
    title: 'Testimonies',
    caption: 'Browse, search, watch, listen to and read testimonies. You can share them too.',
    route: { kind: 'tab', screen: 'Testimonies' },
  },
  {
    voice: 'tutorial.live',
    title: 'Live',
    caption: 'Watch our live broadcasts here. You can turn on notifications for them.',
    route: { kind: 'tab', screen: 'Live' },
  },
  {
    voice: 'tutorial.resources',
    title: 'Resource Center',
    caption: 'Materials for hosting outreaches and crusades, from the ADOTOPOC Resource Center.',
    route: { kind: 'stack', screen: 'Adotopoc' },
  },
  {
    voice: 'tutorial.downloads',
    title: 'Downloads',
    caption: 'Testimonies you saved for offline viewing are kept here.',
    route: { kind: 'tab', screen: 'Downloads' },
  },
  {
    voice: 'tutorial.search',
    title: 'Search',
    caption: 'Search for testimonies and other content, then open any result.',
    route: { kind: 'stack', screen: 'Search' },
  },
  {
    voice: 'tutorial.notifications',
    title: 'Notifications',
    caption: 'Updates on new testimonies, announcements and live broadcasts appear here.',
    route: { kind: 'stack', screen: 'Notifications' },
  },
  {
    voice: 'tutorial.account',
    title: 'Your account',
    caption: 'Your profile and account options. Keep your sign-in details to yourself.',
    route: { kind: 'stack', screen: 'Profile' },
  },
  {
    voice: 'tutorial.ending',
    title: 'Home',
    caption: 'That is the tour. Enjoy the experience. You can replay it from the menu.',
    route: { kind: 'home' },
  },
];
