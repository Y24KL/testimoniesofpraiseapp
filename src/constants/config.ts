/** All environment-driven settings. Values come from .env (EXPO_PUBLIC_*), see .env.example. */
export const CONFIG = {
  backendMode: (process.env.EXPO_PUBLIC_BACKEND_MODE ?? 'firestore') as 'firestore' | 'rest',
  apiBaseUrl: (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, ''),
  websiteUrl: process.env.EXPO_PUBLIC_WEBSITE_URL ?? 'https://testimoniesofpraiseweb.onrender.com',
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  },
  google: {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  },
  kingsChat: {
    clientId: process.env.EXPO_PUBLIC_KINGSCHAT_CLIENT_ID ?? '5a194a59-c962-471a-8529-43b55fc5cead',
  },
  collections: {
    testimonies: process.env.EXPO_PUBLIC_COL_TESTIMONIES ?? 'testimonies',
    notifications: process.env.EXPO_PUBLIC_COL_NOTIFICATIONS ?? 'notifications',
    submissions: process.env.EXPO_PUBLIC_COL_SUBMISSIONS ?? 'testimonySubmissions',
    pushTokens: process.env.EXPO_PUBLIC_COL_PUSH_TOKENS ?? 'pushTokens',
    analytics: process.env.EXPO_PUBLIC_COL_ANALYTICS ?? 'analyticsEvents',
    liveDoc: process.env.EXPO_PUBLIC_DOC_LIVE ?? 'settings/live',
  },
  /** REST-mode endpoints, relative to apiBaseUrl. Adjust to the existing API. */
  rest: {
    testimonies: '/api/testimonies',
    notifications: '/api/notifications',
    live: '/api/live',
    submit: '/api/testimonies/submit',
    analytics: '/api/analytics',
    pushToken: '/api/push-tokens',
  },
  pageSize: 12,
  livePollMs: 15000,
  cloudinary: {
    cloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
    uploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '',
  },
  // TODO: replace with the real Parallex account details before launch.
  bank: {
    bankName: process.env.EXPO_PUBLIC_BANK_NAME ?? 'Parallex Bank',
    accountName: process.env.EXPO_PUBLIC_BANK_ACCOUNT_NAME ?? 'Testimonies of Praise',
    accountNumber: process.env.EXPO_PUBLIC_BANK_ACCOUNT_NUMBER ?? '0000000000',
  },
};

export const isCloudinaryConfigured = Boolean(CONFIG.cloudinary.cloudName && CONFIG.cloudinary.uploadPreset);

export const isFirebaseConfigured = Boolean(CONFIG.firebase.apiKey && CONFIG.firebase.projectId);
export const isGoogleConfigured = Boolean(
  CONFIG.google.webClientId || CONFIG.google.iosClientId || CONFIG.google.androidClientId,
);

export const STORAGE_KEYS = {
  downloads: 'top:downloads:v1',
  prefs: 'top:notification-prefs:v1',
  primerSeen: 'top:notification-primer-seen:v1',
  cachePrefix: 'top:cache:v1:',
  playbackPrefix: 'top:playback:v1:',
};
