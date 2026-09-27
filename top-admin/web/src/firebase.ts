import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

export const configured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID);

// When .env is missing we still initialise with placeholders, because getAuth() throws on an empty
// apiKey and would blank the whole page. App.tsx then shows a clear "Firebase isn't configured" message.
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'not-configured',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'not-configured.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'not-configured',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID || 'not-configured',
});

export const auth = getAuth(app);
export const db = getFirestore(app);
