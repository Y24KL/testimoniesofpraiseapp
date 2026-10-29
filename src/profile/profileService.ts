import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { CONFIG } from '@/constants/config';
import type { ValidProfile } from './validation';

/**
 * One document per account: users/{uid}. Written by the account's owner only (see the users rules).
 *   profileStatus 'pending'  -> account created, the registration form still has to be completed
 *   profileStatus 'complete' -> title/fullName/zone/church saved; the form is never shown again
 * Accounts that predate this feature have no document and are treated as complete (no form).
 */
export type ProfileStatus = 'none' | 'pending' | 'complete';

const userRef = (uid: string) => doc(db, 'users', uid);

/** Whether the profile gate applies (it needs Firestore; the REST backend has no user documents). */
export const profileGateEnabled = CONFIG.backendMode === 'firestore';

export async function readProfileStatus(uid: string): Promise<ProfileStatus> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return 'none';
  return snap.get('profileStatus') === 'complete' ? 'complete' : 'pending';
}

/** Records a brand-new account that still has to complete the form (e.g. first Google sign-in). */
export async function createPendingProfile(uid: string): Promise<void> {
  try {
    await setDoc(userRef(uid), { profileStatus: 'pending', createdAt: serverTimestamp() });
  } catch (e) {
    // Already exists (retry or second device) or offline: the local pending flag still covers it.
    if ((e as { code?: string })?.code !== 'permission-denied') throw e;
  }
}

/** Saves the validated profile and marks it complete. Safe to retry: writing it twice is harmless. */
export async function saveCompleteProfile(uid: string, profile: ValidProfile): Promise<void> {
  const data = { ...profile, profileStatus: 'complete' as const, updatedAt: serverTimestamp(), profileCompletedAt: serverTimestamp() };
  const snap = await getDoc(userRef(uid));
  if (snap.get('profileStatus') === 'complete') return; // already saved (double tap or second device)
  if (snap.exists()) await updateDoc(userRef(uid), data);
  else await setDoc(userRef(uid), { ...data, createdAt: serverTimestamp() });
}
