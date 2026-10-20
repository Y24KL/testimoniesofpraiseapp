import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Testimonies of Praise',
  slug: 'testimonies-of-praise',
  version: '1.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  // Deep-link scheme — MUST match what is listed in AndroidManifest and Info.plist.
  // Also required for expo-auth-session (Google OAuth) redirects to work on device.
  scheme: 'testimoniesofpraise',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0a0a',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.testimoniesofpraise.app',
    buildNumber: '3',
    googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST || './GoogleService-Info.plist',
    infoPlist: {
      // Allows HLS streams and WebView traffic over HTTP (needed for some stream providers).
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0a0a',
    },
    package: 'com.testimoniesofpraise.app',
    versionCode: 3,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    // Required for expo-notifications foreground banners on Android 13+
    permissions: ['android.permission.POST_NOTIFICATIONS', 'android.permission.VIBRATE'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
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