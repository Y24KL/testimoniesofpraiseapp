/**
 * OAuth access tokens for Google APIs (Firestore REST), made from the project's service account with the
 * JWT bearer grant. Used only by server code: the notification engine. Tokens are cached in memory until
 * shortly before they expire. The service account is never sent anywhere except oauth2.googleapis.com.
 */
import { base64UrlFromBytes, base64UrlFromJson, parseServiceAccount, pkcs8BytesFromPem } from './firebaseCustomToken.js';

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const ASSERTION_LIFETIME_SECONDS = 3600;
const REFRESH_MARGIN_MS = 60000;
const enc = new TextEncoder();
const cache = new Map();

/** Builds and signs the JWT assertion for one scope. Exported for tests. */
export async function signAssertion(serviceAccountRaw, scope, now = Date.now()) {
  const account = parseServiceAccount(serviceAccountRaw);
  const key = await crypto.subtle.importKey('pkcs8', pkcs8BytesFromPem(account.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const issuedAt = Math.floor(now / 1000);
  const header = base64UrlFromJson({ alg: 'RS256', typ: 'JWT' });
  const payload = base64UrlFromJson({
    iss: account.client_email,
    scope,
    aud: GOOGLE_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + ASSERTION_LIFETIME_SECONDS,
  });
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${payload}`)));
  return `${header}.${payload}.${base64UrlFromBytes(signature)}`;
}

/** Returns a bearer token for `scope`, from the cache when it is still fresh. */
export async function getGoogleAccessToken(serviceAccountRaw, scope = FIRESTORE_SCOPE, { fetchFn = fetch, now = Date.now() } = {}) {
  const cached = cache.get(scope);
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > now) return cached.token;
  const assertion = await signAssertion(serviceAccountRaw, scope, now);
  const response = await fetchFn(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!response.ok) {
    // The body is not logged: it can echo request details.
    console.error('[google-auth] token exchange failed', response.status);
    throw new Error(`Google token exchange failed (${response.status})`);
  }
  const data = await response.json();
  if (typeof data.access_token !== 'string') throw new Error('Google token response had no access_token');
  cache.set(scope, { token: data.access_token, expiresAt: now + Number(data.expires_in || 3600) * 1000 });
  return data.access_token;
}

export function clearGoogleTokenCache() {
  cache.clear();
}
