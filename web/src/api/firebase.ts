import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import {
  getAnalytics,
  isSupported,
  type Analytics,
} from 'firebase/analytics';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: "AIzaSyAg_3WiDv4LL2BWceIxcyx-GqXuef8VlD4",
  authDomain: "testimoniesofpraiseapp.firebaseapp.com",
  projectId: "testimoniesofpraiseapp",
  storageBucket: "testimoniesofpraiseapp.firebasestorage.app",
  messagingSenderId: "754997860722",
  appId: "1:754997860722:web:acff003464bb7aec7265eb",
  measurementId: "G-DG98C00425"
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Guarantee persistence across Safari tabs, PWA sessions, and page reloads
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export const db = getFirestore(app);
