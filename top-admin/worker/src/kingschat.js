/**
 * KingsChat sign-in, following the KingsChat docs (Initiate Login, Handle the Callback, Exchange Code for Tokens,
 * Verifying an Access Token).
 *
 * 1. The site asks GET /api/auth/kingschat/state for a signed check value, and sends the person to
 *    https://accounts.kingschat.online/log-in?clientId=…&origin=<that value>.
 * 2. KingsChat posts code + origin to POST /api/auth/kingschat/callback (the only URL registered for the app).
 * 3. The Worker checks the check value, exchanges the code once, verifies the access token, and mints a Firebase
 *    custom token for uid "kc_<KingsChat user ID>".
 * 4. The Worker stores that token under a random one-time handoff ID for 60 seconds and sends the browser back to
 *    the site. The site calls POST /api/auth/kingschat/redeem to get the token and signs in.
 *
 * Codes and tokens are never logged or put in a URL. Only the one-time handoff ID is in the address.
 */

import { verifyKingsChatToken } from './kingschatVerify.js';
import { mintFirebaseCustomToken } from './firebaseCustomToken.js';

// Public client ID of the TOP web app in the KingsChat dashboard. It is not a secret.
export const KINGSCHAT_CLIENT_ID = 'f9f8da46-de8a-4f57-aa96-ab8fb2f83926';
export const KINGSCHAT_TOKEN_URL = 'https://connect.kingsch.at/developer/api/oauth2/token';
export const DEFAULT_SITE_URL = 'https://testimoniesofpraiseapp.com';

const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const HANDOFF_TTL_SECONDS = 60;
const HANDOFF_PREFIX = 'kc_handoff:';
const enc = new TextEncoder();

function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const TARGETS = ['web', 'app'];
export const APP_RETURN_URL = 'testimoniesofpraise://kingschat';

/**
 * Creates the check value the client passes as `origin`:
 * "<issued-at ms>.<nonce>.<target>.<signature>", where target is "web" or "app" (where to send the person back).
 */
export async function makeLoginState(secret, now = Date.now(), target = 'web') {
  if (!TARGETS.includes(target)) throw new Error('Unknown sign-in target');
  const payload = `${now}.${randomHex(16)}.${target}`;
  return `${payload}.${await hmacHex(secret, `kc-state:${payload}`)}`;
}

/** Returns "web" or "app" for a check value we issued within ten minutes, otherwise null. */
export async function checkLoginState(state, secret, now = Date.now()) {
  if (typeof state !== 'string') return null;
  const parts = state.split('.');
  if (parts.length !== 4) return null;
  const [issuedAt, nonce, target, signature] = parts;
  if (!TARGETS.includes(target)) return null;
  const payload = `${issuedAt}.${nonce}.${target}`;
  if (!safeEqual(await hmacHex(secret, `kc-state:${payload}`), signature)) return null;
  const age = now - Number(issuedAt);
  if (!(Number.isFinite(age) && age >= 0 && age <= STATE_MAX_AGE_MS)) return null;
  return target;
}

/** Where to send the person after the callback. Only the site's own address or the app's own link is used. */
export function siteRedirect(status, siteUrl = DEFAULT_SITE_URL, handoff, target = 'web') {
  const handoffPart = handoff ? `&handoff=${encodeURIComponent(handoff)}` : '';
  if (target === 'app') return `${APP_RETURN_URL}?kingschat=${encodeURIComponent(status)}${handoffPart}`;
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return `${base}/#/signin?kingschat=${encodeURIComponent(status)}${handoffPart}`;
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const list = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return list.includes(origin) ? origin : '';
}

function jsonResponse(body, status, request, env) {
  const headers = { 'Content-Type': 'application/json', Vary: 'Origin', 'Cache-Control': 'no-store' };
  const origin = allowedOrigin(request, env);
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'content-type';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/** GET ?target=web|app: a fresh check value for the client to pass to KingsChat. */
export async function handleKingsChatState(request, env, deps = {}) {
  if (!env.OTP_PEPPER) return jsonResponse({ error: 'KingsChat sign-in is not configured yet.' }, 503, request, env);
  const target = new URL(request.url).searchParams.get('target') === 'app' ? 'app' : 'web';
  const state = await makeLoginState(env.OTP_PEPPER, deps.now ?? Date.now(), target);
  return jsonResponse({ state }, 200, request, env);
}

/** POST {handoff}: returns the Firebase custom token once, then the handoff ID is gone. */
export async function handleKingsChatRedeem(request, env) {
  if (!env.OTP_KV) return jsonResponse({ error: 'KingsChat sign-in is not configured yet.' }, 503, request, env);
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400, request, env);
  }
  const handoff = typeof body?.handoff === 'string' ? body.handoff : '';
  if (!/^[a-f0-9]{32}$/.test(handoff)) return jsonResponse({ error: 'Invalid request.' }, 400, request, env);

  const key = `${HANDOFF_PREFIX}${handoff}`;
  const token = await env.OTP_KV.get(key);
  if (!token) return jsonResponse({ error: 'This sign-in has expired. Please try again.' }, 404, request, env);
  await env.OTP_KV.delete(key);
  return jsonResponse({ token }, 200, request, env);
}

async function exchangeCode(code, fetchFn) {
  const res = await fetchFn(KINGSCHAT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ grant_type: 'code', client_id: KINGSCHAT_CLIENT_ID, code }),
  });
  if (!res.ok) throw new Error('Code exchange failed');
  const payload = await res.json();
  if (typeof payload.access_token !== 'string' || !payload.access_token) throw new Error('No access token');
  return payload.access_token;
}

/** POST (form): KingsChat sends code and origin here after the person signs in. */
export async function handleKingsChatCallback(request, env, deps = {}) {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? Date.now();
  const site = env.SITE_URL || DEFAULT_SITE_URL;

  if (request.method !== 'POST') return Response.redirect(siteRedirect('invalid', site), 303);

  let code = '';
  let origin = '';
  try {
    const form = await request.formData();
    code = String(form.get('code') ?? '').trim();
    origin = String(form.get('origin') ?? '');
  } catch {
    return Response.redirect(siteRedirect('invalid', site), 303);
  }
  if (!code || code.length > 512) return Response.redirect(siteRedirect('missing', site), 303);

  if (!env.OTP_PEPPER || !env.OTP_KV || !env.FIREBASE_SERVICE_ACCOUNT) {
    return Response.redirect(siteRedirect('unavailable', site), 303);
  }
  // The check value says whether the person started on the web or in the app, so they go back to the right place.
  const target = await checkLoginState(origin, env.OTP_PEPPER, now);
  if (!target) return Response.redirect(siteRedirect('invalid', site), 303);

  // The code works once and expires quickly, so it is exchanged straight away.
  let accessToken;
  try {
    accessToken = await exchangeCode(code, fetchFn);
  } catch {
    return Response.redirect(siteRedirect('failed', site, undefined, target), 303);
  }

  let kingsChatUserId;
  try {
    kingsChatUserId = await verifyKingsChatToken(accessToken, { clientId: KINGSCHAT_CLIENT_ID, fetchFn, now });
  } catch {
    return Response.redirect(siteRedirect('failed', site, undefined, target), 303);
  }

  const customToken = await mintFirebaseCustomToken(env.FIREBASE_SERVICE_ACCOUNT, `kc_${kingsChatUserId}`, now);
  const handoff = randomHex(16);
  await env.OTP_KV.put(`${HANDOFF_PREFIX}${handoff}`, customToken, { expirationTtl: HANDOFF_TTL_SECONDS });
  return Response.redirect(siteRedirect('ok', site, handoff, target), 303);
}
