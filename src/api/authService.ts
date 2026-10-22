import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { getInstallationId } from '@/utils/installation';
import { AppError } from '@/utils/errors';

export interface SendOtpResult {
  ok: boolean;
  maskedEmail: string;
  cooldownSeconds: number;
  expiresAt: number;
}

export interface VerifyOtpResult {
  ok: boolean;
  emailVerified: boolean;
  sessionNonce?: string;
}

export interface SessionTrustResult {
  trusted: boolean;
  emailVerified: boolean;
}

/**
 * Requests a server-generated 6-digit verification code sent to the authenticated user's email.
 */
export async function requestEmailVerification(emailOverride?: string): Promise<SendOtpResult> {
  const installationId = await getInstallationId();
  const callable = httpsCallable<{ installationId: string; email?: string }, SendOtpResult>(
    functions,
    'sendEmailOtp',
  );

  try {
    const res = await callable({ installationId, email: emailOverride });
    return res.data;
  } catch (err: any) {
    const code = err?.code || '';
    const message = err?.message || 'Failed to send verification code.';

    if (code === 'functions/resource-exhausted') {
      throw new AppError('permission', message);
    }
    if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded') {
      throw new AppError('network', message);
    }
    throw new AppError('auth', message);
  }
}

/**
 * Validates the 6-digit numeric OTP with the server.
 */
export async function verifyEmailCode(code: string): Promise<VerifyOtpResult> {
  const installationId = await getInstallationId();
  const callable = httpsCallable<{ code: string; installationId: string }, VerifyOtpResult>(
    functions,
    'verifyEmailOtp',
  );

  try {
    const res = await callable({ code: code.trim(), installationId });
    return res.data;
  } catch (err: any) {
    const message = err?.message || 'Verification failed. Please check the code and try again.';
    throw new AppError('auth', message);
  }
}

/**
 * Verifies with the server whether the current app installation has a trusted, verified session.
 */
export async function checkDeviceSessionTrust(): Promise<SessionTrustResult> {
  const installationId = await getInstallationId();
  const callable = httpsCallable<{ installationId: string }, SessionTrustResult>(
    functions,
    'checkSessionTrust',
  );

  try {
    const res = await callable({ installationId });
    return res.data;
  } catch {
    // If the check fails (e.g. offline), fallback to unverified session until connection restored
    return { trusted: false, emailVerified: false };
  }
}

/**
 * Completely purges user records, push tokens, device trust records, and auth credentials.
 */
export async function deleteAccountOnServer(): Promise<void> {
  const callable = httpsCallable<void, { ok: boolean }>(functions, 'deleteUserAccount');
  try {
    await callable();
  } catch (err: any) {
    throw new AppError('auth', err?.message || 'Failed to delete account.');
  }
}
