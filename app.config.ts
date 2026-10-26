import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Testimonies of Praise',
  slug: 'testimonies-of-praise',
  version: '1.0.4',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  // Deep-link and OAuth callback schemes:
  // 1. 'testimoniesofpraise': Canonical app deep-linking scheme.
  // 2. 'com.testimoniesofpraise.app': Default Android OAuth callback scheme for expo-auth-session.
  // 3. 'com.googleusercontent.apps.754997860722-fjfanme5itf82ue8sbch2m8rjkuvqnpq': Reversed iOS client ID for Google OAuth.
  scheme: [
    'testimoniesofpraise',
    'com.testimoniesofpraise.app',
    'com.googleusercontent.apps.754997860722-fjfanme5itf82ue8sbch2m8rjkuvqnpq',
  ],
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0a0a',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.testimoniesofpraise.app',
    buildNumber: '6',
    googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST || './GoogleService-Info.plist',
    infoPlist: {
      // Scoped ATS: Allows HTTP for live media streams and web views without blanket exemption
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoadsInWebContent: true,
        NSAllowsArbitraryLoadsForMedia: true,
      },
      // Lets the ADOTOPOC "Resource Center" button check for Chrome before falling back to Safari.
      LSApplicationQueriesSchemes: ['googlechromes', 'googlechrome'],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0a0a',
    },
    package: 'com.testimoniesofpraise.app',
    versionCode: 6,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    // Required for expo-notifications foreground banners on Android 13+
    permissions: ['android.permission.POST_NOTIFICATIONS', 'android.permission.VIBRATE'],
  },
  plugins: [
    // Background audio for TOP Radio / audio testimonies: adds UIBackgroundModes=audio (iOS) and the
    // media-playback foreground service + permissions (Android) that expo-video needs to keep
    // playing with the screen locked and to show notification / lock-screen controls.
    ['expo-video', { supportsBackgroundPlayback: true, supportsPictureInPicture: true }],
    // Native Google account picker (Android + iOS). iosUrlScheme = reversed iOS OAuth client ID.
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: 'com.googleusercontent.apps.754997860722-fjfanme5itf82ue8sbch2m8rjkuvqnpq' },
    ],
    // Smaller Android release builds: R8 code shrinking/obfuscation + removal of unused resources.
    [
      'expo-build-properties',
      { android: { enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true } },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#4B006E',
        sounds: [],
      },
    ],
  ],
  extra: {
    eas: {
      projectId: '8db79173-c7a8-4330-908b-df0bb54235dc',
    },
  },
});
