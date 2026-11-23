import { ExpoConfig, ConfigContext } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Testimonies of Praise',
  slug: 'testimonies-of-praise',
  version: '2.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  // Deep-link and OAuth callback schemes:
  // 1. 'testimoniesofpraise': Canonical app deep-linking scheme.
  // 2. 'com.testimoniesofpraise.app': Default Android OAuth callback scheme for expo-auth-session.
  scheme: ['testimoniesofpraise', 'com.testimoniesofpraise.app'],
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0a0a',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.testimoniesofpraise.app',
    buildNumber: '11',
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
    versionCode: 201,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    // Required for expo-notifications foreground banners on Android 13+
    permissions: ['android.permission.POST_NOTIFICATIONS', 'android.permission.VIBRATE'],
  },
  plugins: [
    './plugins/withArm64Only.js',
    // Background audio for TOP Radio / audio testimonies: adds UIBackgroundModes=audio (iOS) and the
    // media-playback foreground service + permissions (Android) that expo-video needs to keep
    // playing with the screen locked and to show notification / lock-screen controls.
    ['expo-video', { supportsBackgroundPlayback: true, supportsPictureInPicture: true }],
    // Smaller Android release builds: R8 code shrinking/obfuscation + removal of unused resources.
    [
      'expo-build-properties',
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          // 64-bit ARM only: every phone sold since about 2019 has it. This removes the 32-bit ARM, x86 and
          // x86_64 native libraries, which is the largest part of the size. 32-bit-only phones cannot install.
          buildArchs: ['arm64-v8a'],
        },
      },
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
