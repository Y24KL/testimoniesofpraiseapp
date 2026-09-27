import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Testimonies: undefined;
  Live: undefined;
  Downloads: undefined;
};

export type RootStackParamList = {
  // Auth
  Welcome: undefined;
  EmailAuth: { mode?: 'signin' | 'signup' } | undefined;
  ForgotPassword: undefined;
  // Onboarding
  NotificationPrimer: undefined;
  FirstTimeWelcome: undefined;
  // Main
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  TestimonyDetails: { id: string };
  ShareTestimony: undefined;
  Sponsor: undefined;
  Notifications: undefined;
  Profile: undefined;
  NotificationSettings: undefined;
  Search: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
