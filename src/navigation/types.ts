import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Testimonies: undefined;
  Live: undefined;
  Listen: undefined;
  Downloads: undefined;
};

export type RootStackParamList = {
  // Auth
  Welcome: undefined;
  EmailAuth: { mode?: 'signin' | 'signup' } | undefined;
  ForgotPassword: undefined;
  VerifyEmail: { email?: string; isNewAccount?: boolean } | undefined;
  // Onboarding
  NotificationPrimer: undefined;
  FirstTimeWelcome: undefined;
  ProfileCompletion: undefined;
  // Main
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  TestimonyDetails: { id: string };
  ShareTestimony: undefined;
  Sponsor: undefined;
  Notifications: undefined;
  Profile: undefined;
  NotificationSettings: undefined;
  Search: undefined;
  // Upgrade Features
  Adotopoc: undefined;
  Promotions: undefined;
  Articles: undefined;
  ArticleDetails: { id: string };
  AudioTestimony: { id: string };
  WrittenTestimonies: undefined;
  WrittenTestimony: { id: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
