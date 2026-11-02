import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/api/firebase';
import { CONFIG } from '@/constants/config';

// Public client ID of the TOP app in the KingsChat dashboard. It is not a secret.
export const KINGSCHAT_CLIENT_ID = 'f9f8da46-de8a-4f57-aa96-ab8fb2f83926';
const KINGSCHAT_LOGIN_URL = 'https://accounts.kingschat.online/log-in';
// The Worker sends the person back here for app sign-ins (see top-admin/worker/src/kingschat.js).
const APP_RETURN_URL = 'testimoniesofpraise://kingschat';

export class KingsChatSignInError extends Error {}

/** Firebase uids of KingsChat accounts start with "kc_" (set by the Worker). */
export function isKingsChatUid(uid: string): boolean {
  return uid.startsWith('kc_');
}

const MESSAGES: Record<string, string> = {
  invalid: 'That KingsChat sign-in link is no longer valid. Please try again.',
  missing: 'KingsChat did not send back the sign-in. Please try again.',
  failed: 'KingsChat sign-in didn’t finish. Try again.',
  unavailable: 'KingsChat sign-in is not available yet.',
};

async function loginCheck(): Promise<string> {
  try {
    const res = await fetch(`${CONFIG.authApiUrl}/api/auth/kingschat/state?target=app`);
    if (!res.ok) throw new Error('state unavailable');
    return ((await res.json()) as { state: string }).state;
  } catch {
    throw new KingsChatSignInError('KingsChat sign-in is not available right now. Try again later.');
  }
}

async function redeemHandoff(handoff: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${CONFIG.authApiUrl}/api/auth/kingschat/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handoff }),
    });
  } catch {
    throw new KingsChatSignInError('No connection. Check your internet and try again.');
  }
  if (!res.ok) throw new KingsChatSignInError('This KingsChat sign-in has expired. Please try again.');
  return ((await res.json()) as { token: string }).token;
}

/**
 * Opens KingsChat's login page in an in-app browser. When KingsChat sends the person back, the Worker returns a
 * one-time handoff ID, which is exchanged for a Firebase sign-in. Resolves quietly if the person closes the page.
 */
export async function signInWithKingsChat(): Promise<void> {
  const state = await loginCheck();
  const url = `${KINGSCHAT_LOGIN_URL}?clientId=${encodeURIComponent(KINGSCHAT_CLIENT_ID)}&origin=${encodeURIComponent(state)}`;

  const result = await WebBrowser.openAuthSessionAsync(url, APP_RETURN_URL);
  if (result.type === 'cancel' || result.type === 'dismiss') return;
  if (result.type !== 'success') throw new KingsChatSignInError(MESSAGES.failed);

  const params = Linking.parse(result.url).queryParams ?? {};
  const status = typeof params.kingschat === 'string' ? params.kingschat : 'failed';
  const handoff = typeof params.handoff === 'string' ? params.handoff : '';
  if (status !== 'ok' || !handoff) throw new KingsChatSignInError(MESSAGES[status] ?? MESSAGES.failed);

  const token = await redeemHandoff(handoff);
  await signInWithCustomToken(auth, token);
}
