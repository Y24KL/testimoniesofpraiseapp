import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '@/api/firebase';

interface AuthValue {
  user: User | null;
  /** true until Firebase has restored (or failed to restore) the persisted session */
  initializing: boolean;
  signInWithEmail(email: string, password: string): Promise<void>;
  register(fullName: string, email: string, password: string): Promise<void>;
  signInWithGoogleIdToken(idToken: string, accessToken?: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setInitializing(false);
      }),
    [],
  );

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    // Firebase hashes and stores credentials server-side; the app never stores passwords.
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: fullName.trim() });
    setUser({ ...cred.user } as User);
  }, []);

  const signInWithGoogleIdToken = useCallback(async (idToken: string, accessToken?: string) => {
    // Creates the account if new, signs in if existing.
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken));
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (auth.currentUser) await deleteUser(auth.currentUser);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, signInWithEmail, register, signInWithGoogleIdToken, resetPassword, signOut, deleteAccount }),
    [user, initializing, signInWithEmail, register, signInWithGoogleIdToken, resetPassword, signOut, deleteAccount],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
