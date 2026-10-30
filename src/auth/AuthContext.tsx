import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  onAuthStateChanged,
  reload,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '@/api/firebase';
import { isNewAccountPending, markNewAccount } from '@/onboarding/welcome';
import { createPendingProfile, profileGateEnabled, readProfileStatus, saveCompleteProfile, type ProfileStatus } from '@/profile/profileService';
import { validateProfile, type ProfileInput, type ValidProfile } from '@/profile/validation';
import {
  checkDeviceSessionTrust,
  deleteAccountOnServer,
  requestEmailVerification,
  verifyEmailCode,
} from '@/api/authService';

interface AuthValue {
  user: User | null;
  /** true until Firebase has restored (or failed to restore) the persisted session */
  initializing: boolean;
  /** True when the current session/installation has been server-verified with 6-digit OTP */
  isSessionVerified: boolean;
  /** Masked email or target destination for OTP display */
  verificationEmail: string | null;
  /** Why the automatic first code could not be sent (shown on the verify screen), else null */
  codeSendError: string | null;
  signInWithEmail(email: string, password: string): Promise<void>;
  /** `profile` is collected before the account is created; without it the account waits for the profile form. */
  register(fullName: string, email: string, password: string, profile?: ValidProfile): Promise<void>;
  /** False until the signed-in user's profile status is known (the app waits before routing). */
  profileChecked: boolean;
  /** True while a newly registered account still has to complete the profile form. */
  needsProfile: boolean;
  completeProfile(input: ProfileInput): Promise<void>;
  signInWithGoogleIdToken(idToken: string, accessToken?: string): Promise<void>;
  verifyOtp(code: string): Promise<void>;
  resendOtp(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  /** True once this uid's welcome flow has been consumed; see src/onboarding/welcome.ts. */
  isNewAccount: boolean;
  clearNewAccount(): void;
  /** Re-reads emailVerified from Firebase and re-renders. */
  refreshEmailVerified(): Promise<void>;
  resendVerificationEmail(): Promise<void>;
  needsEmailVerification: boolean;
  /** Sets (or, with null, removes) the signed-in user's profile picture. */
  updatePhoto(photoURL: string | null): Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isSessionVerified, setIsSessionVerified] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [codeSendError, setCodeSendError] = useState<string | null>(null);
  // Remote profile status for the current user (null = not read yet). Reads are sequence-numbered so a
  // slow, older read can never overwrite a newer one (e.g. the read from the auth listener vs. sign-up).
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

  // Sends the first code after sign-in. Never throws: the user is already signed in and lands on
  // the verify screen, which shows the error and offers "Resend code" straight away.
  const sendFirstCode = useCallback(async () => {
    try {
      const res = await requestEmailVerification();
      if (res.maskedEmail) setVerificationEmail(res.maskedEmail);
      setCodeSendError(null);
    } catch (e) {
      setCodeSendError(e instanceof Error && e.message ? e.message : 'We couldn’t send your code. Tap “Resend code”.');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          // Check server-side device trust / fresh login status
          const trust = await checkDeviceSessionTrust();
          setIsSessionVerified(trust.trusted && trust.emailVerified);
          if (!trust.trusted || !trust.emailVerified) {
            setVerificationEmail(u.email);
            // Initiate verification code dispatch for unverified/fresh session
            void sendFirstCode();
          }
        } catch {
          setIsSessionVerified(false);
        }

        await applyProfileStatus(u.uid);
        try {
          setIsNewAccount(await isNewAccountPending(u.uid));
        } catch {
          setIsNewAccount(false);
        }
      } else {
        setIsSessionVerified(false);
        setVerificationEmail(null);
        setIsNewAccount(false);
        setProfileStatus(null);
      }
      setInitializing(false);
    });

    return () => unsubscribe();
  }, [sendFirstCode, applyProfileStatus]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    setUser({ ...cred.user } as User);
    setVerificationEmail(cred.user.email);

    // Validate server session trust
    try {
      const trust = await checkDeviceSessionTrust();
      if (trust.trusted && trust.emailVerified) {
        setIsSessionVerified(true);
        return;
      }
    } catch {
      /* proceed to OTP challenge */
    }

    setIsSessionVerified(false);
    await sendFirstCode();
  }, [sendFirstCode]);

  const register = useCallback(async (fullName: string, email: string, password: string, profile?: ValidProfile) => {
    const cleanEmail = email.trim();
    // 1. Create account with Firebase Auth
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await updateProfile(cred.user, { displayName: fullName.trim() });

    void markNewAccount(cred.user.uid);
    setIsNewAccount(true);
    setUser({ ...cred.user } as User);
    setVerificationEmail(cleanEmail);
    setIsSessionVerified(false);

    // 2. Save the profile collected on the sign-up form, or leave it pending for the profile form.
    //    If the write fails the local pending flag keeps the form on screen, so nothing is lost.
    if (profileGateEnabled) {
      try {
        if (profile) await saveCompleteProfile(cred.user.uid, profile);
        else await createPendingProfile(cred.user.uid);
      } catch {
        /* handled by the local pending flag */
      }
      await applyProfileStatus(cred.user.uid);
    }

    // 3. Dispatch 6-digit OTP code to registered email
    await sendFirstCode();
  }, [sendFirstCode, applyProfileStatus]);

  const completeProfile = useCallback(async (input: ProfileInput) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Your session has ended. Sign in again to continue.');
    const checked = validateProfile(input);
    if (!checked.ok) throw new Error(Object.values(checked.errors)[0] ?? 'Check your details and try again.');
    await saveCompleteProfile(uid, checked.value);
    // Show the name the person typed everywhere (profile, comments, greeting), not the Google account name.
    if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: checked.value.fullName });
    await applyProfileStatus(uid);
  }, [applyProfileStatus]);

  const signInWithGoogleIdToken = useCallback(async (idToken: string, accessToken?: string) => {
    const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken));
    setUser({ ...cred.user } as User);
    setVerificationEmail(cred.user.email);

    if (getAdditionalUserInfo(cred)?.isNewUser) {
      void markNewAccount(cred.user.uid);
      setIsNewAccount(true);
      // New Google account: the profile form must be completed before the app opens. Recorded remotely
      // so it still appears after a reinstall or on another device.
      if (profileGateEnabled) {
        try {
          await createPendingProfile(cred.user.uid);
        } catch {
          /* handled by the local pending flag */
        }
      }
    }
    if (profileGateEnabled) await applyProfileStatus(cred.user.uid);

    // Google email returning verified does NOT bypass app-level OTP verification
    try {
      const trust = await checkDeviceSessionTrust();
      if (trust.trusted && trust.emailVerified) {
        setIsSessionVerified(true);
        return;
      }
    } catch {
      /* proceed to OTP challenge */
    }

    setIsSessionVerified(false);
    await sendFirstCode();
  }, [sendFirstCode]);

  const verifyOtp = useCallback(async (code: string) => {
    await verifyEmailCode(code);
    if (auth.currentUser) {
      await reload(auth.currentUser);
      await auth.currentUser.getIdToken(true);
      setUser({ ...auth.currentUser } as User);
    }
    setIsSessionVerified(true);
  }, []);

  const resendOtp = useCallback(async () => {
    const emailToUse = verificationEmail || user?.email || undefined;
    const res = await requestEmailVerification(emailToUse);
    if (res.maskedEmail) setVerificationEmail(res.maskedEmail);
    setCodeSendError(null);
  }, [verificationEmail, user?.email]);

  const clearNewAccount = useCallback(() => setIsNewAccount(false), []);

  const refreshEmailVerified = useCallback(async () => {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    const trust = await checkDeviceSessionTrust();
    setIsSessionVerified(trust.trusted && trust.emailVerified);
    setUser({ ...auth.currentUser } as User);
  }, []);

  const updatePhoto = useCallback(async (photoURL: string | null) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { photoURL });
    setUser({ ...auth.currentUser } as User);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    await resendOtp();
  }, [resendOtp]);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const signOut = useCallback(async () => {
    setIsSessionVerified(false);
    setProfileStatus(null);
    setVerificationEmail(null);
    await fbSignOut(auth);
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      // 1. Remove verification codes and trusted devices from the verification service
      await deleteAccountOnServer();
    } catch {
      /* best effort: the records expire on their own */
    }
    // 2. Delete the Firebase account itself. Firebase may require a recent sign-in
    //    (auth/requires-recent-login); the Profile screen then asks the user to sign in again.
    if (auth.currentUser) await deleteUser(auth.currentUser);
    await signOut();
  }, [signOut]);

  const needsEmailVerification = Boolean(user && !isSessionVerified);

  // The profile form applies only to accounts that are new (remote 'pending', or a new-account flag on
  // this device while the remote status is missing or unreachable). Existing accounts never see it.
  const profileChecked = !user || profileStatus !== null;
  const needsProfile =
    profileGateEnabled &&
    !!user &&
    (profileStatus === 'pending' || ((profileStatus === 'none' || profileStatus === 'unknown') && isNewAccount));
  const value = useMemo(
    () => ({
      user,
      initializing,
      isSessionVerified,
      verificationEmail,
      codeSendError,
      signInWithEmail,
      register,
      profileChecked,
      needsProfile,
      completeProfile,
      signInWithGoogleIdToken,
      verifyOtp,
      resendOtp,
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
    [
      user,
      initializing,
      isSessionVerified,
      verificationEmail,
      codeSendError,
      signInWithEmail,
      register,
      profileChecked,
      needsProfile,
      completeProfile,
      signInWithGoogleIdToken,
      verifyOtp,
      resendOtp,
      resetPassword,
      signOut,
      deleteAccount,
      isNewAccount,
      clearNewAccount,
      refreshEmailVerified,
      resendVerificationEmail,
      needsEmailVerification,
      updatePhoto,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
