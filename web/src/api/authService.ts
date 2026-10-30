import { auth } from './firebase';

/**
 * Email verification (6-digit code) and trusted-device checks for the website. Same Cloudflare Worker
 * routes the app uses (top-admin/worker/src/auth.js). The signed-in user's Firebase ID token proves who
 * is calling; the code is always emailed to that account's own address.
 */

/** The public Worker address (no secret); used when no build setting is given. */
const BASE = (((import.meta.env.VITE_AUTH_API_URL || import.meta.env.VITE_AI_API_URL) as string | undefined) || 'https://top-push-relay.gtrusouth116.workers.dev').replace(/\/+$/, '');
const INSTALLATION_KEY = 'top:installation-id';

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

export class AuthServiceError extends Error {}

const TIMEOUT_MS = 15000;

/** A random id for this browser, kept in localStorage. It identifies the trusted device. */
function getInstallationId(): string {
  try {
    const existing = window.localStorage.getItem(INSTALLATION_KEY);
    if (existing) return existing;
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(INSTALLATION_KEY, id);
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

async function callAuthApi<T>(path: string, body: Record<string, unknown>, isValid: (d: any) => boolean): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new AuthServiceError('Please sign in again.');
  if (!BASE) throw new AuthServiceError('The verification service is not configured on this site yet.');
  const token = await user.getIdToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new AuthServiceError('No connection to the verification service. Check your internet and try again.');
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
    throw new AuthServiceError(typeof data?.error === 'string' ? data.error : 'Something went wrong. Please try again.');
  }
  if (!isValid(data)) throw new AuthServiceError('The verification service is being updated. Please try again shortly.');
  return data as T;
}

// Sign-in can ask for a code from more than one place at once. Only one code is sent per window.
const RECENT_SEND_MS = 45_000;
let inflight: { uid: string; promise: Promise<SendOtpResult> } | null = null;
let lastSent: { uid: string; at: number; result: SendOtpResult } | null = null;

/** Emails a server-generated 6-digit code to the signed-in user's own address. */
export async function requestEmailVerification(): Promise<SendOtpResult> {
  const uid = auth.currentUser?.uid ?? '';
  if (inflight && inflight.uid === uid) return inflight.promise;
  if (lastSent && lastSent.uid === uid && Date.now() - lastSent.at < RECENT_SEND_MS) return lastSent.result;
  const promise = (async () => {
    const result = await callAuthApi<SendOtpResult>('/auth/otp/send', { installationId: getInstallationId() }, (d) => d?.ok === true && typeof d.maskedEmail === 'string');
    lastSent = { uid, at: Date.now(), result };
    return result;
  })();
  inflight = { uid, promise };
  try {
    return await promise;
  } finally {
    if (inflight?.promise === promise) inflight = null;
  }
}

/** Checks the 6-digit code; on success this browser becomes a trusted device. */
export async function verifyEmailCode(code: string): Promise<VerifyOtpResult> {
  return callAuthApi<VerifyOtpResult>('/auth/otp/verify', { code: code.trim(), installationId: getInstallationId() }, (d) => d?.ok === true);
}

/** Whether this browser already verified for the signed-in account. Offline counts as not trusted. */
export async function checkDeviceSessionTrust(): Promise<SessionTrustResult> {
  try {
    return await callAuthApi<SessionTrustResult>('/auth/session/trust', { installationId: getInstallationId() }, (d) => typeof d?.trusted === 'boolean');
  } catch {
    return { trusted: false, emailVerified: false };
  }
}
