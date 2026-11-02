/**
 * Verifies a KingsChat access token (a signed JWT) as described in the KingsChat docs:
 * "Verifying an Access Token". The token is checked against KingsChat's public certificates, and the
 * claims are checked before the subject (the KingsChat user ID) is trusted.
 */

export const CERTS_URL = 'https://connect.kingsch.at/oauth2/certs';
const CERTS_TTL_MS = 24 * 60 * 60 * 1000;

let certCache = { fetchedAt: 0, keys: new Map() };

function base64UrlToBytes(part) {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJsonPart(part) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}

function pemToSpkiBytes(pem) {
  const body = pem.replace(/-----BEGIN PUBLIC KEY-----/, '').replace(/-----END PUBLIC KEY-----/, '').replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importCertificate(pem) {
  return crypto.subtle.importKey(
    'spki',
    pemToSpkiBytes(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

/** Returns the public key for a kid, from the 24-hour cache or a fresh fetch. */
export async function getSigningKey(kid, { fetchFn = fetch, now = Date.now() } = {}) {
  const fresh = now - certCache.fetchedAt < CERTS_TTL_MS;
  if (fresh && certCache.keys.has(kid)) return certCache.keys.get(kid);

  const res = await fetchFn(CERTS_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Could not load KingsChat certificates');
  const payload = await res.json();

  const keys = new Map();
  for (const cert of payload.certificates ?? []) {
    if (typeof cert.kid === 'string' && typeof cert.pem_certificate === 'string') {
      keys.set(cert.kid, await importCertificate(cert.pem_certificate));
    }
  }
  certCache = { fetchedAt: now, keys };
  return keys.get(kid) ?? null;
}

/**
 * Checks a KingsChat access token. Resolves with the KingsChat user ID (the `sub` claim).
 * Throws when the token is not valid for this application.
 */
export async function verifyKingsChatToken(token, { clientId, fetchFn = fetch, now = Date.now() } = {}) {
  if (typeof token !== 'string' || token.split('.').length !== 3) throw new Error('Malformed token');
  const [headerPart, payloadPart, signaturePart] = token.split('.');

  const header = decodeJsonPart(headerPart);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Unsupported token header');

  const key = await getSigningKey(header.kid, { fetchFn, now });
  if (!key) throw new Error('Unknown signing key');

  const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlToBytes(signaturePart), signed);
  if (!valid) throw new Error('Invalid token signature');

  const claims = decodeJsonPart(payloadPart);
  if (claims.iss !== 'kingschat') throw new Error('Token issuer is not KingsChat');
  if (!clientId || claims.acid !== clientId) throw new Error('Token was issued for another application');
  // exp is in milliseconds, per the KingsChat docs.
  if (typeof claims.exp !== 'number' || claims.exp <= now) throw new Error('Token has expired');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('Token has no user');

  return claims.sub;
}

/** Test helper: clears the certificate cache. */
export function resetCertCache() {
  certCache = { fetchedAt: 0, keys: new Map() };
}
