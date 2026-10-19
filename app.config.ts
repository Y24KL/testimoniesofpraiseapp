import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Testimonies of Praise',
  slug: 'testimonies-of-praise',
  version: '1.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#000000',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    buildNumber: '1.0.1',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    package: 'com.testimoniesofpraise.app', // Replace with your exact Android package name
    versionCode: 3, // <--- BUMPED FROM 2 TO 3 TO FIX THE APK UPLOAD ERROR
  },
  web: {
    favicon: './assets/favicon.png',
  },
});