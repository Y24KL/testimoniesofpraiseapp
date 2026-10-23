import { auth } from './firebase';
import { CONFIG } from '@/constants/config';
import { getInstallationId } from '@/utils/installation';
import { AppError } from '@/utils/errors';

/**
 * Email verification (6-digit code) and trusted-device checks.
 *
 * Served by the Cloudflare Worker (top-admin/worker/src/auth.js) instead of Firebase Cloud
 * Functions, which need the paid Blaze plan. The signed-in user's Firebase ID token proves who is
 * calling; the code is always emailed to that account's own address.
 */

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

const TIMEOUT_MS = 15000;

async function callAuthApi<T>(path: string, body: Record<string, unknown>, isValid: (d: any) => boolean): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new AppError('auth', 'Please sign in again.');
  if (!CONFIG.authApiUrl) throw new AppError('unknown', 'Verification service is not configured for this build.');
  const token = await user.getIdToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${CONFIG.authApiUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new AppError('network', 'No connection to the verification service. Check your internet and try again.');
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* handled below */
  }
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Something went wrong. Please try again.';
    if (res.status === 429) throw new AppError('permission', message);
    if (res.status === 503 || res.status >= 500) throw new AppError('network', message);
    throw new AppError('auth', message);
  }
  // An older Worker without these routes answers {"status":"ok"}: treat that as "not available".
  if (!isValid(data)) throw new AppError('network', 'The verification service is being updated. Please try again shortly.');
  return data as T;
}

/** Emails a server-generated 6-digit code to the signed-in user's own address. */
export async function requestEmailVerification(_emailHint?: string): Promise<SendOtpResult> {
  const installationId = await getInstallationId();
  return callAuthApi<SendOtpResult>('/auth/otp/send', { installationId }, (d) => d?.ok === true && typeof d.maskedEmail === 'string');
}

/** Checks the 6-digit code; on success this installation becomes a trusted device. */
export async function verifyEmailCode(code: string): Promise<VerifyOtpResult> {
  const installationId = await getInstallationId();
  return callAuthApi<VerifyOtpResult>('/auth/otp/verify', { code: code.trim(), installationId }, (d) => d?.ok === true);
}

/** Whether this app installation already verified for the signed-in account. */
export async function checkDeviceSessionTrust(): Promise<SessionTrustResult> {
  const installationId = await getInstallationId();
  try {
    return await callAuthApi<SessionTrustResult>('/auth/session/trust', { installationId }, (d) => typeof d?.trusted === 'boolean');
  } catch {
    // Offline or service unavailable: ask for a code rather than silently trusting the session.
    return { trusted: false, emailVerified: false };
  }
}

/** Removes the user's verification codes and trusted devices from the server. */
export async function deleteAccountOnServer(): Promise<void> {
  await callAuthApi<{ ok: boolean }>('/auth/account/delete', {}, (d) => d?.ok === true);
}
