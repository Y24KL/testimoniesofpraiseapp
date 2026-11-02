import { AUTH_API_BASE } from './authService';

// Public client ID of the TOP web app in the KingsChat dashboard. It is not a secret.
export const KINGSCHAT_CLIENT_ID = 'f9f8da46-de8a-4f57-aa96-ab8fb2f83926';
const KINGSCHAT_LOGIN_URL = 'https://accounts.kingschat.online/log-in';

export class KingsChatSignInError extends Error {}

/** Firebase uids of KingsChat accounts start with "kc_" (set by the Worker). */
export function isKingsChatUid(uid: string): boolean {
  return uid.startsWith('kc_');
}

/**
 * Sends the person to KingsChat's login page. The Worker gives a signed check value first; KingsChat returns it
 * unchanged, and the Worker checks it before exchanging the code. The page leaves this site, so nothing is
 * stored here.
 */
export async function startKingsChatLogin(): Promise<void> {
  let state: string;
  try {
    const res = await fetch(`${AUTH_API_BASE}/api/auth/kingschat/state`);
    if (!res.ok) throw new Error('state unavailable');
    state = ((await res.json()) as { state: string }).state;
  } catch {
    throw new KingsChatSignInError('KingsChat sign-in is not available right now. Try again later.');
  }
  window.location.assign(
    `${KINGSCHAT_LOGIN_URL}?clientId=${encodeURIComponent(KINGSCHAT_CLIENT_ID)}&origin=${encodeURIComponent(state)}`,
  );
}

/**
 * Exchanges the one-time handoff ID from the Worker for a Firebase custom token and the person's KingsChat name
 * (null when KingsChat did not give one). The ID works once.
 */
export async function redeemKingsChatHandoff(handoff: string): Promise<{ token: string; name: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${AUTH_API_BASE}/api/auth/kingschat/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handoff }),
    });
  } catch {
    throw new KingsChatSignInError('No connection. Check your internet and try again.');
  }
  if (!res.ok) throw new KingsChatSignInError('This KingsChat sign-in has expired. Please try again.');
  return (await res.json()) as { token: string; name: string | null };
}

/**
 * Reads the result the Worker put in the address (#/signin?kingschat=…&handoff=…) and removes it from the
 * address bar. Returns null when this page was not opened from KingsChat.
 */
export function takeKingsChatReturn(): { status: string; handoff: string | null } | null {
  const hash = window.location.hash;
  const queryStart = hash.indexOf('?');
  if (queryStart === -1) return null;
  const params = new URLSearchParams(hash.slice(queryStart + 1));
  const status = params.get('kingschat');
  if (!status) return null;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/signin`);
  return { status, handoff: params.get('handoff') };
}
