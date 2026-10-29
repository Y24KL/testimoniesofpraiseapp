import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  getRedirectResult,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../api/firebase';
import { createPendingProfile, profileGateEnabled, readProfileStatus, saveCompleteProfile, type ProfileStatus } from '../profile/profileService';
import { validateProfile, type ProfileInput, type ValidProfile } from '../profile/validation';

interface AuthValue {
  user: User | null;
  initializing: boolean;
  signInWithEmail(email: string, password: string): Promise<void>;
  /** `profile` comes from the sign-up form; without it the account waits for the profile form. */
  register(fullName: string, email: string, password: string, profile?: ValidProfile): Promise<void>;
  signInWithGoogle(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  isNewAccount: boolean;
  clearNewAccount(): void;
  refreshEmailVerified(): Promise<void>;
  resendVerificationEmail(): Promise<void>;
  needsEmailVerification: boolean;
  updatePhoto(photoURL: string | null): Promise<void>;
  /** False until the signed-in user's profile status is known. */
  profileChecked: boolean;
  /** True while a newly registered account still has to complete the profile form. */
  needsProfile: boolean;
  completeProfile(input: ProfileInput): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isNewAccount, setIsNewAccount] = useState(false);
  // Remote profile status for the current user (null = not read yet). Sequence-numbered so an older,
  // slower read can't overwrite a newer one (the auth listener vs. sign-up or the profile form).
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | 'unknown' | null>(null);
  const profileSeq = useRef(0);

  const applyProfileStatus = useCallback(async (uid: string) => {
    const seq = ++profileSeq.current;
    let status: ProfileStatus | 'unknown' = 'complete';
    if (profileGateEnabled) {
      try {
        status = await readProfileStatus(uid);
      } catch {
        status = 'unknown';
      }
    }
    if (seq === profileSeq.current) setProfileStatus(status);
  }, []);

  // Completes a Google sign-in that fell back to the redirect flow (popup blocked) and keeps the
  // "new account" flag that the popup path sets. Errors are only logged: the Welcome page offers email.
  useEffect(() => {
    getRedirectResult(auth)
      .then((cred) => {
        if (cred && getAdditionalUserInfo(cred)?.isNewUser) {
          localStorage.setItem(`top:new-account:${cred.user.uid}`, 'true');
          setIsNewAccount(true);
          if (profileGateEnabled) void createPendingProfile(cred.user.uid).catch(() => undefined);
        }
      })
      .catch((e) => console.warn('[auth] redirect sign-in failed', e?.code ?? e));
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const isNew = localStorage.getItem(`top:new-account:${u.uid}`) === 'true';
        setIsNewAccount(isNew);
        await applyProfileStatus(u.uid);
      } else {
        setIsNewAccount(false);
        setProfileStatus(null);
      }
      setInitializing(false);
    });
  }, [applyProfileStatus]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string, profile?: ValidProfile) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: fullName.trim() });
    await sendEmailVerification(cred.user).catch(() => {});
    localStorage.setItem(`top:new-account:${cred.user.uid}`, 'true');
    setIsNewAccount(true);
    setUser({ ...cred.user } as User);
    // Save the profile collected on the sign-up form, or leave it pending. A failed write keeps the
    // local new-account flag, so the profile form still appears.
    if (profileGateEnabled) {
      try {
        if (profile) await saveCompleteProfile(cred.user.uid, profile);
        else await createPendingProfile(cred.user.uid);
      } catch {
        /* covered by the local flag */
      }
      await applyProfileStatus(cred.user.uid);
    }
  }, [applyProfileStatus]);

  const completeProfile = useCallback(async (input: ProfileInput) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Your session has ended. Sign in again to continue.');
    const checked = validateProfile(input);
    if (!checked.ok) throw new Error(Object.values(checked.errors)[0] ?? 'Check your details and try again.');
    await saveCompleteProfile(uid, checked.value);
    await applyProfileStatus(uid);
  }, [applyProfileStatus]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const cred = await signInWithPopup(auth, provider);
      if (getAdditionalUserInfo(cred)?.isNewUser) {
        localStorage.setItem(`top:new-account:${cred.user.uid}`, 'true');
        setIsNewAccount(true);
        // New Google account: the profile form must be completed first. Stored remotely so it survives
        // a reload, another browser, or an interrupted sign-up.
        if (profileGateEnabled) await createPendingProfile(cred.user.uid).catch(() => undefined);
      }
    } catch (err: any) {
      // In standalone iOS PWA or restrictive popup blockers, fall back to redirect
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        await signInWithRedirect(auth, provider);
      } else {
        throw err;
      }
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const signOut = useCallback(async () => {
    setProfileStatus(null);
    await fbSignOut(auth);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (auth.currentUser) {
      await deleteUser(auth.currentUser);
    }
  }, []);

  const clearNewAccount = useCallback(() => {
    if (auth.currentUser) {
      localStorage.removeItem(`top:new-account:${auth.currentUser.uid}`);
    }
    setIsNewAccount(false);
  }, []);

  const refreshEmailVerified = useCallback(async () => {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    setUser({ ...auth.currentUser } as User);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  }, []);

  const updatePhoto = useCallback(async (photoURL: string | null) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { photoURL });
    setUser({ ...auth.currentUser } as User);
  }, []);

  // Existing accounts never see the form: only a remote 'pending' profile, or a new-account flag on this
  // browser while the remote status is missing or unreachable, requires it.
  const profileChecked = !user || profileStatus !== null;
  const needsProfile =
    profileGateEnabled &&
    !!user &&
    (profileStatus === 'pending' || ((profileStatus === 'none' || profileStatus === 'unknown') && isNewAccount));

  const needsEmailVerification = Boolean(
    user &&
    !user.emailVerified &&
    user.providerData.some((p) => p.providerId === 'password')
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
        signInWithEmail,
        register,
        signInWithGoogle,
        resetPassword,
        signOut,
        deleteAccount,
        isNewAccount,
        clearNewAccount,
        refreshEmailVerified,
        resendVerificationEmail,
        needsEmailVerification,
        updatePhoto,
        profileChecked,
        needsProfile,
        completeProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
