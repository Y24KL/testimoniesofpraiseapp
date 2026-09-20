export type ErrorKind = 'network' | 'auth' | 'permission' | 'notfound' | 'unknown';

export class AppError extends Error {
  kind: ErrorKind;
  constructor(kind: ErrorKind, message?: string) {
    super(message ?? kind);
    this.kind = kind;
  }
}

/** Normalises anything thrown by Firebase / fetch into an AppError. Raw messages are never shown to users. */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const code = (e as { code?: string })?.code ?? '';
  const msg = String((e as { message?: string })?.message ?? '');
  if (code === 'unavailable' || code === 'deadline-exceeded' || code.includes('network') || /network|failed to fetch|timeout|aborted/i.test(msg)) {
    return new AppError('network');
  }
  if (code === 'permission-denied') return new AppError('permission');
  if (code === 'not-found') return new AppError('notfound');
  if (code.startsWith('auth/')) return new AppError('auth');
  return new AppError('unknown');
}

export const MESSAGES = {
  network: 'Unable to connect.\nPlease check your internet connection.',
  video: 'Unable to play this video.\nPlease try again.',
  download: 'Download failed.\nPlease try again.',
  auth: 'Unable to sign you in.\nPlease check your details.',
  generic: 'Something went wrong.\nPlease try again.',
  offline: "YOU'RE OFFLINE.",
};

export function messageFor(e: unknown): string {
  const k = toAppError(e).kind;
  if (k === 'network') return MESSAGES.network;
  if (k === 'auth') return MESSAGES.auth;
  return MESSAGES.generic;
}

/** Friendly text for Firebase auth error codes. */
export function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Please choose a stronger password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return MESSAGES.network;
    case 'auth/requires-recent-login':
      return 'For your security, please sign in again and retry.';
    default:
      return MESSAGES.auth;
  }
}
