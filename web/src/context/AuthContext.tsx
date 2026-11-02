import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../api/firebase';
import { checkDeviceSessionTrust, requestEmailVerification, verifyEmailCode, AuthServiceError } from '../api/authService';
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
  updatePhoto(photoURL: string | null): Promise<void>;
  /** True once the browser has verified this account with the 6-digit code (or is already trusted). */
  sessionVerified: boolean;
  /** Masked address the 6-digit code was sent to, e.g. j***@gmail.com. */
  verificationEmail: string | null;
  /** Problem sending the code, shown on the code screen. */
  codeError: string | null;
  /** Checks the 6-digit code. Throws with a message the person can read. */
  verifyCode(code: string): Promise<void>;
  /** Emails a new 6-digit code to the account. */
  resendCode(): Promise<void>;
  /** False until the signed-in user's profile status and code check are known. */
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
  // null = not checked yet for the current user.
  const [sessionVerified, setSessionVerified] = useState<boolean | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
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

  // Sends the 6-digit code to the account's own email. Never throws: the code screen shows the error.
  const sendFirstCode = useCallback(async () => {
    try {
      const res = await requestEmailVerification();
      setVerificationEmail(res.maskedEmail);
      setCodeError(null);
    } catch (e) {
      setCodeError(e instanceof AuthServiceError ? e.message : 'We couldn’t send your code. Tap “Resend code”.');
    }
  }, []);

  // A browser that already verified this account skips the code. Otherwise a fresh code is sent.
  const checkSession = useCallback(async () => {
    const trust = await checkDeviceSessionTrust();
    const verified = trust.trusted && trust.emailVerified;
    setSessionVerified(verified);
    if (!verified) await sendFirstCode();
  }, [sendFirstCode]);

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
        await checkSession();
        await applyProfileStatus(u.uid);
      } else {
        setIsNewAccount(false);
        setProfileStatus(null);
        setSessionVerified(null);
        setVerificationEmail(null);
        setCodeError(null);
      }
      setInitializing(false);
    });
  }, [applyProfileStatus, checkSession]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string, profile?: ValidProfile) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: fullName.trim() });
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

  const verifyCode = useCallback(async (code: string) => {
    const result = await verifyEmailCode(code);
    if (!result.ok) throw new Error('That code did not work. Check it and try again.');
    setCodeError(null);
    setSessionVerified(true);
  }, []);

  const resendCode = useCallback(async () => {
    await sendFirstCode();
  }, [sendFirstCode]);

  const completeProfile = useCallback(async (input: ProfileInput) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Your session has ended. Sign in again to continue.');
    const checked = validateProfile(input);
    if (!checked.ok) throw new Error(Object.values(checked.errors)[0] ?? 'Check your details and try again.');
    await saveCompleteProfile(uid, checked.value);
    // Show the name the person typed everywhere (profile, comments, greeting), not the Google account name.
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: checked.value.fullName });
      // Refresh the signed-in user so screens show the new name straight away.
      setUser({ ...auth.currentUser } as User);
    }
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

  const updatePhoto = useCallback(async (photoURL: string | null) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { photoURL });
    setUser({ ...auth.currentUser } as User);
  }, []);

  // Existing accounts never see the form: only a remote 'pending' profile, or a new-account flag on this
  // browser while the remote status is missing or unreachable, requires it.
  const profileChecked = !user || (profileStatus !== null && sessionVerified !== null);
  const needsProfile =
    profileGateEnabled &&
    !!user &&
    (profileStatus === 'pending' || ((profileStatus === 'none' || profileStatus === 'unknown') && isNewAccount));

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
        updatePhoto,
        sessionVerified: sessionVerified === true,
        verificationEmail,
        codeError,
        verifyCode,
        resendCode,
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
