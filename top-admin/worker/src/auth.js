/**
 * Email verification (6-digit code) + trusted-device sessions, served by the Cloudflare Worker.
 *
 * Replaces the Firebase Cloud Functions sendEmailOtp / verifyEmailOtp / checkSessionTrust /
 * deleteUserAccount, which need the paid Blaze plan. Same request/response shapes, same rules:
 * 10-minute codes, 5 attempts, 60 s resend cooldown, 5 codes per hour.
 *
 * - Caller identity: the Firebase ID token in `Authorization: Bearer`, verified here against
 *   Google's public keys (no service account needed). The code is always sent to the email in
 *   the verified token, never to an address supplied by the client.
 * - Storage: Cloudflare KV binding `OTP_KV` (codes are stored only as HMAC hashes).
 * - Secrets (wrangler secret put): OTP_PEPPER, and RESEND_API_KEY or BREVO_API_KEY. MAIL_FROM var.
 */

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_HOURLY_LIMIT = 5;
const TRUST_TTL_SECONDS = 365 * 24 * 3600;
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

export class AuthError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const enc = new TextEncoder();
const b64urlToBytes = (s) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const toHex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');

let jwksCache = { keys: null, until: 0 };
async function googleKeys(fetchImpl) {
  if (jwksCache.keys && Date.now() < jwksCache.until) return jwksCache.keys;
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw new AuthError('unavailable', 'Could not verify sign-in right now. Please try again.', 503);
  const { keys } = await res.json();
  const maxAge = Number((res.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  jwksCache = { keys, until: Date.now() + Math.min(maxAge, 6 * 3600) * 1000 };
  return keys;
}
export const _resetJwksCache = () => (jwksCache = { keys: null, until: 0 });

/** Verifies a Firebase Auth ID token (RS256) and returns { uid, email }. */
export async function verifyFirebaseToken(authorization, projectId, fetchImpl = fetch) {
  const token = (authorization || '').startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('unauthenticated', 'Sign-in required.', 401);
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    throw new AuthError('unauthenticated', 'Sign-in required.', 401);
  }
  if (header.alg !== 'RS256' || !header.kid) throw new AuthError('unauthenticated', 'Invalid sign-in token.', 401);
  const jwk = (await googleKeys(fetchImpl)).find((k) => k.kid === header.kid);
  if (!jwk) throw new AuthError('unauthenticated', 'Sign-in expired. Please sign in again.', 401);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  const now = Math.floor(Date.now() / 1000);
  if (
    !ok ||
    payload.aud !== projectId ||
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    payload.exp <= now ||
    payload.iat > now + 300
  ) {
    throw new AuthError('unauthenticated', 'Sign-in expired. Please sign in again.', 401);
  }
  return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '' };
}

async function hmac(pepper, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Uniform 6-digit code (100000-999999) from the CSPRNG, without modulo bias. */
function randomCode() {
  const buf = new Uint32Array(1);
  const range = 900000;
  const limit = Math.floor(0x100000000 / range) * range;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return String(100000 + (buf[0] % range));
}

export function maskEmail(email) {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}

function emailHtml(code) {
  return `<!doctype html><html><body style="margin:0;background:#12001C;font-family:Arial,Helvetica,sans-serif;color:#fff">
<div style="max-width:480px;margin:0 auto;padding:32px 24px;text-align:center">
<div style="color:#F5C542;font-weight:800;letter-spacing:2px;font-size:14px">TESTIMONIES OF PRAISE</div>
<h1 style="font-size:22px;margin:16px 0 8px">Verify your email</h1>
<p style="color:#CDBBDD;font-size:15px;line-height:1.5">Enter this code in the app to finish signing in.</p>
<div style="font-size:34px;font-weight:800;letter-spacing:10px;background:#251035;border:1px solid #3A2253;border-radius:14px;padding:18px;margin:20px 0;color:#F5C542">${code}</div>
<p style="color:#9C86B3;font-size:13px;line-height:1.5">The code expires in <b>10 minutes</b> and can be used once.<br>If you didn't request it, you can ignore this email. Never share this code.</p>
</div></body></html>`;
}

async function sendEmail(env, to, code, fetchImpl) {
  const from = env.MAIL_FROM || 'Testimonies of Praise <auth@testimoniesofpraise.org>';
  const subject = `${code} is your Testimonies of Praise code`;
  const text = `Your Testimonies of Praise verification code is ${code}. It expires in 10 minutes.`;
  let res;
  if (env.RESEND_API_KEY) {
    res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html: emailHtml(code), text }),
    });
  } else if (env.BREVO_API_KEY) {
    // Brevo accepts "Name <address>" split into name/email
    const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    res = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: m ? { name: m[1], email: m[2] } : { email: from }, to: [{ email: to }], subject, htmlContent: emailHtml(code), textContent: text }),
    });
  } else {
    throw new AuthError('unavailable', 'Email sending is not configured on the server yet.', 503);
  }
  if (!res.ok) {
    console.error('[auth] email provider error', res.status, (await res.text().catch(() => '')).slice(0, 300));
    throw new AuthError('unavailable', 'We couldn’t send the verification email. Please try again in a moment.', 503);
  }
}

function requireConfig(env) {
  if (!env.OTP_KV) throw new AuthError('unavailable', 'Verification storage is not configured on the server yet.', 503);
  if (!env.OTP_PEPPER) throw new AuthError('unavailable', 'Verification is not configured on the server yet.', 503);
}

const otpKey = (uid) => `otp:${uid}`;
const trustKey = (uid, installationId) => `trust:${uid}:${installationId}`;
const cleanInstallationId = (v) => String(v || '').trim().slice(0, 128).replace(/[^A-Za-z0-9_-]/g, '');

export async function sendOtp(env, caller, _body, fetchImpl = fetch) {
  requireConfig(env);
  if (!caller.email) throw new AuthError('failed-precondition', 'Your account has no email address.', 412);
  const now = Date.now();
  const existing = await env.OTP_KV.get(otpKey(caller.uid), 'json');
  let hourlyCount = 0;
  let hourlyResetAt = now + 3600 * 1000;
  if (existing) {
    if (now - (existing.lastSentAt || 0) < OTP_RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
      throw new AuthError('resource-exhausted', `Please wait ${wait}s before requesting a new code.`, 429);
    }
    if (now < (existing.hourlyResetAt || 0)) {
      hourlyCount = existing.hourlyCount || 0;
      hourlyResetAt = existing.hourlyResetAt;
    }
    if (hourlyCount >= OTP_HOURLY_LIMIT) throw new AuthError('resource-exhausted', 'Hourly verification limit reached. Please try again later.', 429);
  }

  const code = randomCode();
  await sendEmail(env, caller.email, code, fetchImpl); // only store the code once it was delivered
  const expiresAt = now + OTP_EXPIRY_MS;
  await env.OTP_KV.put(
    otpKey(caller.uid),
    JSON.stringify({ hash: await hmac(env.OTP_PEPPER, `${caller.uid}:${code}`), status: 'pending', attempts: 0, expiresAt, lastSentAt: now, hourlyCount: hourlyCount + 1, hourlyResetAt }),
    { expirationTtl: 3600 + 120 },
  );
  return { ok: true, maskedEmail: maskEmail(caller.email), cooldownSeconds: 60, expiresAt };
}

export async function verifyOtp(env, caller, body) {
  requireConfig(env);
  const code = String(body?.code || '').trim();
  if (!/^\d{6}$/.test(code)) throw new AuthError('invalid-argument', 'Please enter the 6-digit code from your email.', 400);
  const rec = await env.OTP_KV.get(otpKey(caller.uid), 'json');
  if (!rec || rec.status !== 'pending') throw new AuthError('not-found', 'No active code. Tap “Resend code” to get a new one.', 404);
  const ttl = { expirationTtl: 3600 + 120 };
  if (Date.now() > rec.expiresAt) {
    await env.OTP_KV.put(otpKey(caller.uid), JSON.stringify({ ...rec, status: 'expired' }), ttl);
    throw new AuthError('deadline-exceeded', 'This code has expired. Tap “Resend code” to get a new one.', 410);
  }
  if ((rec.attempts || 0) >= OTP_MAX_ATTEMPTS) throw new AuthError('resource-exhausted', 'Too many attempts. Tap “Resend code” to get a new one.', 429);

  const ok = timingSafeEqualHex(await hmac(env.OTP_PEPPER, `${caller.uid}:${code}`), rec.hash);
  if (!ok) {
    const attempts = (rec.attempts || 0) + 1;
    const remaining = OTP_MAX_ATTEMPTS - attempts;
    await env.OTP_KV.put(otpKey(caller.uid), JSON.stringify({ ...rec, attempts, status: remaining <= 0 ? 'exhausted' : 'pending' }), ttl);
    if (remaining <= 0) throw new AuthError('resource-exhausted', 'Incorrect code. Too many attempts. Tap “Resend code” to get a new one.', 429);
    throw new AuthError('invalid-argument', `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, 400);
  }

  // Single use: keep only the rate-limit counters.
  await env.OTP_KV.put(otpKey(caller.uid), JSON.stringify({ status: 'verified', lastSentAt: rec.lastSentAt, hourlyCount: rec.hourlyCount, hourlyResetAt: rec.hourlyResetAt }), ttl);
  const sessionNonce = crypto.randomUUID();
  const installationId = cleanInstallationId(body?.installationId);
  if (installationId) {
    await env.OTP_KV.put(trustKey(caller.uid, installationId), JSON.stringify({ verifiedAt: Date.now(), sessionNonce }), { expirationTtl: TRUST_TTL_SECONDS });
  }
  return { ok: true, emailVerified: true, sessionNonce };
}

export async function checkTrust(env, caller, body) {
  requireConfig(env);
  const installationId = cleanInstallationId(body?.installationId);
  if (!installationId) return { trusted: false, emailVerified: false };
  const rec = await env.OTP_KV.get(trustKey(caller.uid, installationId), 'json');
  return { trusted: Boolean(rec), emailVerified: Boolean(rec) };
}

export async function deleteAccountData(env, caller) {
  requireConfig(env);
  await env.OTP_KV.delete(otpKey(caller.uid));
  let cursor;
  do {
    const page = await env.OTP_KV.list({ prefix: `trust:${caller.uid}:`, cursor });
    await Promise.all(page.keys.map((k) => env.OTP_KV.delete(k.name)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return { ok: true };
}

export const AUTH_ROUTES = {
  '/auth/otp/send': sendOtp,
  '/auth/otp/verify': verifyOtp,
  '/auth/session/trust': checkTrust,
  '/auth/account/delete': deleteAccountData,
};
