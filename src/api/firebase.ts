import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// getReactNativePersistence is exported from the React Native build of firebase/auth.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - not present in the default (web) type declarations
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '@/constants/config';

const app = getApps().length ? getApp() : initializeApp(CONFIG.firebase);

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  // Fast-refresh re-initialisation
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);
