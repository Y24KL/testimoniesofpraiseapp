import kingsChatWebSdk from 'kingschat-web-sdk';

// Public client ID of the TOP web app in the KingsChat developer dashboard. It is not a secret.
export const KINGSCHAT_CLIENT_ID = 'f9f8da46-de8a-4f57-aa96-ab8fb2f83926';
const KINGSCHAT_SCOPES = ['user'];

export class KingsChatSignInError extends Error {}

/**
 * Opens the KingsChat sign-in popup. Resolves with true once the person has allowed access, and with
 * false when they close the popup, so the caller can stay quiet. The tokens are not stored anywhere:
 * nothing uses them yet, and the refresh token must never go into localStorage on web.
 */
export async function signInWithKingsChat(): Promise<boolean> {
  try {
    await kingsChatWebSdk.login({ clientId: KINGSCHAT_CLIENT_ID, scopes: KINGSCHAT_SCOPES });
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message.includes('User closed window')) return false;
    if (message.includes('enable popups')) {
      throw new KingsChatSignInError('Allow pop-ups for this site, then try again.');
    }
    throw new KingsChatSignInError('KingsChat sign-in didn’t finish. Try again.');
  }
}
