import type { ExpoConfig, ConfigContext } from 'expo/config';

const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID ?? 'com.testimoniesofpraise.app';
const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE ?? 'com.testimoniesofpraise.app';

// Google OAuth redirect schemes:
//  - iOS uses the "reversed" iOS client id
//  - Android uses the application id as the scheme
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const reversedIosClientId = iosClientId
  ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`
  : undefined;

const schemes = ['testimoniesofpraise', ANDROID_PACKAGE, reversedIosClientId].filter(
  (s): s is string => Boolean(s),
);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Testimonies of Praise',
  slug: 'testimonies-of-praise',
  version: '1.0.0',
  orientation: 'portrait',
  platforms: ['ios', 'android'],
  icon: './assets/icon.png',
  scheme: schemes,
  userInterfaceStyle: 'dark',
  backgroundColor: '#12001C',
  newArchEnabled: true,
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#12001C',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: IOS_BUNDLE_ID,
    buildNumber: '1',
    googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['remote-notification'],
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    versionCode: 1,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#4B006E',
    },
    // Only what's needed. POST_NOTIFICATIONS is required on Android 13+.
    permissions: ['POST_NOTIFICATIONS'],
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  plugins: [
    'expo-web-browser',
    'expo-video',
    [
      'expo-notifications',
      { icon: './assets/notification-icon.png', color: '#4B006E' },
    ],
  ],
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
