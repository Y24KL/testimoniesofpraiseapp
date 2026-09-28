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
  signInWithCustomToken, // Add this import
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '@/api/firebase';
import { markNewAccount } from '@/onboarding/welcome';

interface AuthValue {
  user: User | null;
  initializing: boolean;
  signInWithEmail(email: string, password: string): Promise<void>;
  register(fullName: string, email: string, password: string): Promise<void>;
  signInWithGoogleIdToken(idToken: string, accessToken?: string): Promise<void>;
  // Add KingsChat sign-in method
  signInWithKingsChat(customToken: string, profile: { displayName: string; photoURL: string }): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  isNewAccount: boolean;
  clearNewAccount(): void;
  refreshEmailVerified(): Promise<void>;
  resendVerificationEmail(): Promise<void>;
  needsEmailVerification: boolean;
  updatePhoto(photoURL: string | null): Promise<void>;
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
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: fullName.trim() });
    await sendEmailVerification(cred.user).catch(() => undefined); 
    void markNewAccount(cred.user.uid);
    setIsNewAccount(true);
    setUser({ ...cred.user } as User);
  }, []);

  const signInWithGoogleIdToken = useCallback(async (idToken: string, accessToken?: string) => {
    const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken));
    if (getAdditionalUserInfo(cred)?.isNewUser) {
      void markNewAccount(cred.user.uid);
      setIsNewAccount(true);
    }
  }, []);

  // NEW: KingsChat Authentication Method
  const signInWithKingsChat = useCallback(async (customToken: string, profile: { displayName: string; photoURL: string }) => {
    // 1. Sign in to Firebase using the Custom Token from your Express backend
    const cred = await signInWithCustomToken(auth, customToken);
    
    // 2. Update their Firebase Profile with their KingsChat name and picture
    await updateProfile(cred.user, { 
      displayName: profile.displayName,
      photoURL: profile.photoURL 
    });

    // 3. Mark as new user if it's their first time logging in
    if (getAdditionalUserInfo(cred)?.isNewUser) {
      void markNewAccount(cred.user.uid);
      setIsNewAccount(true);
    }
    
    // 4. Force a local state update to immediately reflect the new profile picture
    setUser({ ...cred.user, displayName: profile.displayName, photoURL: profile.photoURL } as User);
  }, []);

  const clearNewAccount = useCallback(() => setIsNewAccount(false), []);

  const refreshEmailVerified = useCallback(async () => {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    setUser({ ...auth.currentUser } as User);
  }, []);

  const updatePhoto = useCallback(async (photoURL: string | null) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { photoURL });
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

  const needsEmailVerification = !!user && !user.emailVerified && user.providerData.some((p) => p.providerId === 'password');

  const value = useMemo(
    () => ({
      user,
      initializing,
      signInWithEmail,
      register,
      signInWithGoogleIdToken,
      signInWithKingsChat, // Make available to your app
      resetPassword,
      signOut,
      deleteAccount,
      isNewAccount,
      clearNewAccount,
      refreshEmailVerified,
      resendVerificationEmail,
      needsEmailVerification,
      updatePhoto,
    }),
    [user, initializing, signInWithEmail, register, signInWithGoogleIdToken, signInWithKingsChat, resetPassword, signOut, deleteAccount, isNewAccount, clearNewAccount, refreshEmailVerified, resendVerificationEmail, needsEmailVerification, updatePhoto],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}