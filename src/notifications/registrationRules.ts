/**
 * Pure decisions for push registration (no React Native imports, so they are unit-tested in plain Node).
 * The runtime that calls these lives in registration.ts.
 */

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export type RegistrationState =
  | 'unsupported' // emulator / web: remote push cannot work
  | 'needs_permission' // never asked, or asking is still possible
  | 'blocked' // denied and the system will not ask again: only phone settings can fix it
  | 'registering'
  | 'registered'
  | 'error';

export interface RegistrationRecord {
  state: RegistrationState;
  uid: string | null;
  /** First characters of the Expo token, for diagnostics only. */
  tokenPreview: string | null;
  hasFcmToken: boolean;
  permission: PermissionStatus | null;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  /** Signature of the last record written to the server (token + uid + metadata). */
  lastWrittenSignature: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  failures: number;
}

export const EMPTY_RECORD: RegistrationRecord = {
  state: 'needs_permission',
  uid: null,
  tokenPreview: null,
  hasFcmToken: false,
  permission: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastWrittenSignature: null,
  errorCode: null,
  errorMessage: null,
  failures: 0,
};

/** Rewrite the server record at least this often, so "last registered" shows the device is alive. */
export const REFRESH_MS = 24 * 60 * 60 * 1000;
/** Waits before automatic retries after a failure in one session: 30 s, 2 min, 10 min, then stop. */
export const RETRY_DELAYS_MS = [30_000, 120_000, 600_000];

/**
 * Whether to show the system permission prompt now. The prompt is shown automatically at most once per app
 * version, only after the first-run notification screen was seen, and only while the system still allows asking.
 * Everything else is left to an explicit tap (Home banner, settings), so people are never nagged.
 */
export function shouldAutoAskPermission(input: { status: PermissionStatus; canAskAgain: boolean; primerSeen: boolean; askedForVersion: string | null; appVersion: string }): boolean {
  if (input.status === 'granted') return false;
  if (!input.canAskAgain) return false;
  if (!input.primerSeen) return false;
  return input.askedForVersion !== input.appVersion;
}

/** The state to show when the app cannot register because of permission. */
export function permissionState(status: PermissionStatus, canAskAgain: boolean): RegistrationState {
  if (status === 'granted') return 'registering';
  return canAskAgain ? 'needs_permission' : 'blocked';
}

/** Stable signature of what would be written; identical signatures within REFRESH_MS skip the write. */
export function registrationSignature(r: { uid: string; token: string; fcmToken?: string; appVersion?: string; timeZone?: string; prefs: Record<string, boolean> }): string {
  const prefs = Object.keys(r.prefs).sort().map((k) => `${k}=${r.prefs[k] ? 1 : 0}`).join(',');
  return [r.uid, r.token, r.fcmToken ?? '', r.appVersion ?? '', r.timeZone ?? '', prefs].join('|');
}

export function shouldWrite(record: RegistrationRecord, signature: string, now: number): boolean {
  if (record.lastWrittenSignature !== signature) return true;
  return !record.lastSuccessAt || now - record.lastSuccessAt >= REFRESH_MS;
}

/** Delay before the next automatic retry, or null when the session should stop retrying. */
export function nextRetryDelay(failures: number): number | null {
  return failures >= 1 && failures <= RETRY_DELAYS_MS.length ? RETRY_DELAYS_MS[failures - 1] : null;
}

/** Short, non-secret error code from anything thrown during registration. */
export function errorCode(e: unknown): string {
  const x = e as { code?: unknown; message?: unknown; name?: unknown };
  const raw = typeof x?.code === 'string' ? x.code : typeof x?.name === 'string' && x.name !== 'Error' ? x.name : 'unknown';
  const msg = typeof x?.message === 'string' ? x.message.toLowerCase() : '';
  if (msg.includes('permission') && msg.includes('missing')) return 'firestore-permission-denied';
  if (msg.includes('network') || msg.includes('offline') || msg.includes('timeout')) return 'network';
  if (msg.includes('fis_auth_error') || msg.includes('service_not_available')) return 'firebase-messaging-unavailable';
  return raw.replace(/[^A-Za-z0-9_/-]/g, '').slice(0, 60) || 'unknown';
}

/** Whether a failure is worth retrying automatically (network-type problems), not configuration errors. */
export function isRetryable(code: string): boolean {
  return code === 'network' || code === 'firebase-messaging-unavailable' || code === 'unknown' || code === 'unavailable' || code.includes('deadline');
}

/** Plain-language explanation for the diagnostics screen. */
export function explainRegistration(record: RegistrationRecord): string {
  switch (record.state) {
    case 'unsupported': return 'Push notifications only work on a real phone, not an emulator.';
    case 'needs_permission': return 'Notifications are not allowed yet. Turn them on to receive alerts.';
    case 'blocked': return 'Notifications are blocked for this app in your phone settings. Open settings to allow them.';
    case 'registering': return 'Connecting this phone…';
    case 'registered': return 'This phone is registered and can receive notifications.';
    case 'error':
      if (record.errorCode === 'network') return 'We could not reach the server. We will try again automatically.';
      if (record.errorCode === 'firestore-permission-denied') return 'The server refused this phone’s registration. Sign out and in again, or contact support.';
      return `Registration failed (${record.errorCode ?? 'unknown'}). Tap Retry, or contact support if it keeps happening.`;
    default: return '';
  }
}
