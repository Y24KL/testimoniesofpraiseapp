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
    backgroundColor: '#0a0a0a',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.testimoniesofpraise.app',
    buildNumber: '1.0.1',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0a0a',
    },
    package: 'com.testimoniesofpraise.app',
    versionCode: 3,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    eas: {
      projectId: "8db79173-c7a8-4330-908b-df0bb54235dc"
    }
  }
});