/**
 * Mints a Firebase custom token signed with the project's service account, so the browser can sign in
 * with signInWithCustomToken(). The service account JSON is the Worker secret FIREBASE_SERVICE_ACCOUNT.
 * Firebase creates the user the first time a custom token for that uid is used.
 */

const AUDIENCE = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
const TOKEN_LIFETIME_SECONDS = 3600;
const MAX_UID_LENGTH = 128;

const enc = new TextEncoder();

function base64UrlFromBytes(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlFromJson(value) {
  return base64UrlFromBytes(enc.encode(JSON.stringify(value)));
}

function pkcs8BytesFromPem(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function parseServiceAccount(raw) {
  let account;
  try {
    account = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error('Service account secret is not valid JSON');
  }
  if (!account || typeof account.client_email !== 'string' || typeof account.private_key !== 'string') {
    throw new Error('Service account secret is missing client_email or private_key');
  }
  return account;
}

/** Returns a Firebase custom token for the given uid, signed with the service account. */
export async function mintFirebaseCustomToken(serviceAccountRaw, uid, now = Date.now()) {
  if (typeof uid !== 'string' || !uid || uid.length > MAX_UID_LENGTH) throw new Error('Invalid Firebase uid');
  const account = parseServiceAccount(serviceAccountRaw);

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8BytesFromPem(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const issuedAt = Math.floor(now / 1000);
  const header = base64UrlFromJson({ alg: 'RS256', typ: 'JWT' });
  const payload = base64UrlFromJson({
    iss: account.client_email,
    sub: account.client_email,
    aud: AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    uid,
  });
  const signed = enc.encode(`${header}.${payload}`);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, signed));
  return `${header}.${payload}.${base64UrlFromBytes(signature)}`;
}
