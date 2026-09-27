import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '@/api/firebase';
import { markNewAccount } from '@/onboarding/welcome';

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
  /** True once this uid's welcome flow has been consumed; see src/onboarding/welcome.ts. */
  isNewAccount: boolean;
  clearNewAccount(): void;
  /** Re-reads emailVerified from Firebase (e.g. after the user taps the link) and re-renders. */
  refreshEmailVerified(): Promise<void>;
  resendVerificationEmail(): Promise<void>;
  needsEmailVerification: boolean;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isNewAccount, setIsNewAccount] = useState(false);

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
    await sendEmailVerification(cred.user).catch(() => undefined); // account still works if this fails; they can resend
    void markNewAccount(cred.user.uid);
    setIsNewAccount(true);
    setUser({ ...cred.user } as User);
  }, []);

  const signInWithGoogleIdToken = useCallback(async (idToken: string, accessToken?: string) => {
    // Creates the account if new, signs in if existing.
    const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken));
    if (getAdditionalUserInfo(cred)?.isNewUser) {
      void markNewAccount(cred.user.uid);
      setIsNewAccount(true);
    }
  }, []);

  const clearNewAccount = useCallback(() => setIsNewAccount(false), []);

  const refreshEmailVerified = useCallback(async () => {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    setUser({ ...auth.currentUser } as User);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
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

  // Only password accounts need this: federated sign-in (Google) already verifies the email.
  const needsEmailVerification = !!user && !user.emailVerified && user.providerData.some((p) => p.providerId === 'password');

  const value = useMemo(
    () => ({
      user,
      initializing,
      signInWithEmail,
      register,
      signInWithGoogleIdToken,
      resetPassword,
      signOut,
      deleteAccount,
      isNewAccount,
      clearNewAccount,
      refreshEmailVerified,
      resendVerificationEmail,
      needsEmailVerification,
    }),
    [user, initializing, signInWithEmail, register, signInWithGoogleIdToken, resetPassword, signOut, deleteAccount, isNewAccount, clearNewAccount, refreshEmailVerified, resendVerificationEmail, needsEmailVerification],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
