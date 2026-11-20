var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/auth.js
var OTP_EXPIRY_MS = 10 * 60 * 1e3;
var OTP_MAX_ATTEMPTS = 5;
var OTP_RESEND_COOLDOWN_MS = 60 * 1e3;
var OTP_HOURLY_LIMIT = 5;
var TRUST_TTL_SECONDS = 365 * 24 * 3600;
var JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
var AuthError = class extends Error {
  static {
    __name(this, "AuthError");
  }
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
};
var enc = new TextEncoder();
var b64urlToBytes = /* @__PURE__ */ __name((s) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}, "b64urlToBytes");
var toHex = /* @__PURE__ */ __name((buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join(""), "toHex");
var jwksCache = { keys: null, until: 0 };
async function googleKeys(fetchImpl) {
  if (jwksCache.keys && Date.now() < jwksCache.until) return jwksCache.keys;
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw new AuthError("unavailable", "Could not verify sign-in right now. Please try again.", 503);
  const { keys } = await res.json();
  const maxAge = Number((res.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 3600);
  jwksCache = { keys, until: Date.now() + Math.min(maxAge, 6 * 3600) * 1e3 };
  return keys;
}
__name(googleKeys, "googleKeys");
async function verifyFirebaseToken(authorization, projectId, fetchImpl = fetch) {
  const token = (authorization || "").startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthError("unauthenticated", "Sign-in required.", 401);
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    throw new AuthError("unauthenticated", "Sign-in required.", 401);
  }
  if (header.alg !== "RS256" || !header.kid) throw new AuthError("unauthenticated", "Invalid sign-in token.", 401);
  const jwk = (await googleKeys(fetchImpl)).find((k) => k.kid === header.kid);
  if (!jwk) throw new AuthError("unauthenticated", "Sign-in expired. Please sign in again.", 401);
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  const now = Math.floor(Date.now() / 1e3);
  if (!ok || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || typeof payload.sub !== "string" || !payload.sub || payload.exp <= now || payload.iat > now + 300) {
    throw new AuthError("unauthenticated", "Sign-in expired. Please sign in again.", 401);
  }
  return { uid: payload.sub, email: typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "" };
}
__name(verifyFirebaseToken, "verifyFirebaseToken");
async function hmac(pepper, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}
__name(hmac, "hmac");
function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
__name(timingSafeEqualHex, "timingSafeEqualHex");
function randomCode() {
  const buf = new Uint32Array(1);
  const range = 9e5;
  const limit = Math.floor(4294967296 / range) * range;
  do
    crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return String(1e5 + buf[0] % range);
}
__name(randomCode, "randomCode");
function maskEmail(email) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}
__name(maskEmail, "maskEmail");
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
__name(emailHtml, "emailHtml");
async function sendEmail(env, to, code, fetchImpl) {
  const from = env.MAIL_FROM || "Testimonies of Praise <auth@testimoniesofpraise.org>";
  const subject = `${code} is your Testimonies of Praise code`;
  const text = `Your Testimonies of Praise verification code is ${code}. It expires in 10 minutes.`;
  let res;
  if (env.RESEND_API_KEY) {
    res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html: emailHtml(code), text })
    });
  } else if (env.BREVO_API_KEY) {
    const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    res = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender: m ? { name: m[1], email: m[2] } : { email: from }, to: [{ email: to }], subject, htmlContent: emailHtml(code), textContent: text })
    });
  } else {
    throw new AuthError("unavailable", "Email sending is not configured on the server yet.", 503);
  }
  if (!res.ok) {
    console.error("[auth] email provider error", res.status, (await res.text().catch(() => "")).slice(0, 300));
    throw new AuthError("unavailable", "We couldn\u2019t send the verification email. Please try again in a moment.", 503);
  }
}
__name(sendEmail, "sendEmail");
function requireConfig(env) {
  if (!env.OTP_KV) throw new AuthError("unavailable", "Verification storage is not configured on the server yet.", 503);
  if (!env.OTP_PEPPER) throw new AuthError("unavailable", "Verification is not configured on the server yet.", 503);
}
__name(requireConfig, "requireConfig");
var otpKey = /* @__PURE__ */ __name((uid) => `otp:${uid}`, "otpKey");
var trustKey = /* @__PURE__ */ __name((uid, installationId) => `trust:${uid}:${installationId}`, "trustKey");
var cleanInstallationId = /* @__PURE__ */ __name((v) => String(v || "").trim().slice(0, 128).replace(/[^A-Za-z0-9_-]/g, ""), "cleanInstallationId");
async function sendOtp(env, caller, _body, fetchImpl = fetch) {
  requireConfig(env);
  if (!caller.email) throw new AuthError("failed-precondition", "Your account has no email address.", 412);
  const now = Date.now();
  const existing = await env.OTP_KV.get(otpKey(caller.uid), "json");
  let hourlyCount = 0;
  let hourlyResetAt = now + 3600 * 1e3;
  if (existing) {
    if (now - (existing.lastSentAt || 0) < OTP_RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1e3);
      throw new AuthError("resource-exhausted", `Please wait ${wait}s before requesting a new code.`, 429);
    }
    if (now < (existing.hourlyResetAt || 0)) {
      hourlyCount = existing.hourlyCount || 0;
      hourlyResetAt = existing.hourlyResetAt;
    }
    if (hourlyCount >= OTP_HOURLY_LIMIT) throw new AuthError("resource-exhausted", "Hourly verification limit reached. Please try again later.", 429);
  }
  const code = randomCode();
  await sendEmail(env, caller.email, code, fetchImpl);
  const expiresAt = now + OTP_EXPIRY_MS;
  await env.OTP_KV.put(
    otpKey(caller.uid),
    JSON.stringify({ hash: await hmac(env.OTP_PEPPER, `${caller.uid}:${code}`), status: "pending", attempts: 0, expiresAt, lastSentAt: now, hourlyCount: hourlyCount + 1, hourlyResetAt }),
    { expirationTtl: 3600 + 120 }
  );
  return { ok: true, maskedEmail: maskEmail(caller.email), cooldownSeconds: 60, expiresAt };
}
__name(sendOtp, "sendOtp");
async function verifyOtp(env, caller, body) {
  requireConfig(env);
  const code = String(body?.code || "").trim();
  if (!/^\d{6}$/.test(code)) throw new AuthError("invalid-argument", "Please enter the 6-digit code from your email.", 400);
  const rec = await env.OTP_KV.get(otpKey(caller.uid), "json");
  if (!rec || rec.status !== "pending") throw new AuthError("not-found", "No active code. Tap \u201CResend code\u201D to get a new one.", 404);
  const ttl = { expirationTtl: 3600 + 120 };
  if (Date.now() > rec.expiresAt) {
    await env.OTP_KV.put(otpKey(caller.uid), JSON.stringify({ ...rec, status: "expired" }), ttl);
    throw new AuthError("deadline-exceeded", "This code has expired. Tap \u201CResend code\u201D to get a new one.", 410);
  }
  if ((rec.attempts || 0) >= OTP_MAX_ATTEMPTS) throw new AuthError("resource-exhausted", "Too many attempts. Tap \u201CResend code\u201D to get a new one.", 429);
  const ok = timingSafeEqualHex(await hmac(env.OTP_PEPPER, `${caller.uid}:${code}`), rec.hash);
  if (!ok) {
    const attempts = (rec.attempts || 0) + 1;
    const remaining = OTP_MAX_ATTEMPTS - attempts;
    await env.OTP_KV.put(otpKey(caller.uid), JSON.stringify({ ...rec, attempts, status: remaining <= 0 ? "exhausted" : "pending" }), ttl);
    if (remaining <= 0) throw new AuthError("resource-exhausted", "Incorrect code. Too many attempts. Tap \u201CResend code\u201D to get a new one.", 429);
    throw new AuthError("invalid-argument", `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`, 400);
  }
  await env.OTP_KV.put(otpKey(caller.uid), JSON.stringify({ status: "verified", lastSentAt: rec.lastSentAt, hourlyCount: rec.hourlyCount, hourlyResetAt: rec.hourlyResetAt }), ttl);
  const sessionNonce = crypto.randomUUID();
  const installationId = cleanInstallationId(body?.installationId);
  if (installationId) {
    await env.OTP_KV.put(trustKey(caller.uid, installationId), JSON.stringify({ verifiedAt: Date.now(), sessionNonce }), { expirationTtl: TRUST_TTL_SECONDS });
  }
  return { ok: true, emailVerified: true, sessionNonce };
}
__name(verifyOtp, "verifyOtp");
async function checkTrust(env, caller, body) {
  requireConfig(env);
  const installationId = cleanInstallationId(body?.installationId);
  if (!installationId) return { trusted: false, emailVerified: false };
  const rec = await env.OTP_KV.get(trustKey(caller.uid, installationId), "json");
  return { trusted: Boolean(rec), emailVerified: Boolean(rec) };
}
__name(checkTrust, "checkTrust");
async function deleteAccountData(env, caller) {
  requireConfig(env);
  await env.OTP_KV.delete(otpKey(caller.uid));
  let cursor;
  do {
    const page = await env.OTP_KV.list({ prefix: `trust:${caller.uid}:`, cursor });
    await Promise.all(page.keys.map((k) => env.OTP_KV.delete(k.name)));
    cursor = page.list_complete ? void 0 : page.cursor;
  } while (cursor);
  return { ok: true };
}
__name(deleteAccountData, "deleteAccountData");
var AUTH_ROUTES = {
  "/auth/otp/send": sendOtp,
  "/auth/otp/verify": verifyOtp,
  "/auth/session/trust": checkTrust,
  "/auth/account/delete": deleteAccountData
};

// src/kingschatVerify.js
var CERTS_URL = "https://connect.kingsch.at/oauth2/certs";
var CERTS_TTL_MS = 24 * 60 * 60 * 1e3;
var certCache = { fetchedAt: 0, keys: /* @__PURE__ */ new Map() };
function base64UrlToBytes(part) {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(base64UrlToBytes, "base64UrlToBytes");
function decodeJsonPart(part) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}
__name(decodeJsonPart, "decodeJsonPart");
function pemToSpkiBytes(pem) {
  const body = pem.replace(/-----BEGIN PUBLIC KEY-----/, "").replace(/-----END PUBLIC KEY-----/, "").replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(pemToSpkiBytes, "pemToSpkiBytes");
async function importCertificate(pem) {
  return crypto.subtle.importKey(
    "spki",
    pemToSpkiBytes(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}
__name(importCertificate, "importCertificate");
async function getSigningKey(kid, { fetchFn = fetch, now = Date.now() } = {}) {
  const fresh = now - certCache.fetchedAt < CERTS_TTL_MS;
  if (fresh && certCache.keys.has(kid)) return certCache.keys.get(kid);
  const res = await fetchFn(CERTS_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Could not load KingsChat certificates");
  const payload = await res.json();
  const keys = /* @__PURE__ */ new Map();
  for (const cert of payload.certificates ?? []) {
    if (typeof cert.kid === "string" && typeof cert.pem_certificate === "string") {
      keys.set(cert.kid, await importCertificate(cert.pem_certificate));
    }
  }
  certCache = { fetchedAt: now, keys };
  return keys.get(kid) ?? null;
}
__name(getSigningKey, "getSigningKey");
async function verifyKingsChatToken(token, { clientId, fetchFn = fetch, now = Date.now() } = {}) {
  if (typeof token !== "string" || token.split(".").length !== 3) throw new Error("Malformed token");
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  const header = decodeJsonPart(headerPart);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Unsupported token header");
  const key = await getSigningKey(header.kid, { fetchFn, now });
  if (!key) throw new Error("Unknown signing key");
  const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlToBytes(signaturePart), signed);
  if (!valid) throw new Error("Invalid token signature");
  const claims = decodeJsonPart(payloadPart);
  if (claims.iss !== "kingschat") throw new Error("Token issuer is not KingsChat");
  if (!clientId || claims.acid !== clientId) throw new Error("Token was issued for another application");
  if (typeof claims.exp !== "number" || claims.exp <= now) throw new Error("Token has expired");
  if (typeof claims.sub !== "string" || !claims.sub) throw new Error("Token has no user");
  return claims.sub;
}
__name(verifyKingsChatToken, "verifyKingsChatToken");

// src/firebaseCustomToken.js
var AUDIENCE = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";
var TOKEN_LIFETIME_SECONDS = 3600;
var MAX_UID_LENGTH = 128;
var enc2 = new TextEncoder();
function base64UrlFromBytes(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64UrlFromBytes, "base64UrlFromBytes");
function base64UrlFromJson(value) {
  return base64UrlFromBytes(enc2.encode(JSON.stringify(value)));
}
__name(base64UrlFromJson, "base64UrlFromJson");
function pkcs8BytesFromPem(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(pkcs8BytesFromPem, "pkcs8BytesFromPem");
function parseServiceAccount(raw) {
  let account;
  try {
    account = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("Service account secret is not valid JSON");
  }
  if (!account || typeof account.client_email !== "string" || typeof account.private_key !== "string") {
    throw new Error("Service account secret is missing client_email or private_key");
  }
  return account;
}
__name(parseServiceAccount, "parseServiceAccount");
async function mintFirebaseCustomToken(serviceAccountRaw, uid, now = Date.now()) {
  if (typeof uid !== "string" || !uid || uid.length > MAX_UID_LENGTH) throw new Error("Invalid Firebase uid");
  const account = parseServiceAccount(serviceAccountRaw);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8BytesFromPem(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const issuedAt = Math.floor(now / 1e3);
  const header = base64UrlFromJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlFromJson({
    iss: account.client_email,
    sub: account.client_email,
    aud: AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    uid
  });
  const signed = enc2.encode(`${header}.${payload}`);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, signed));
  return `${header}.${payload}.${base64UrlFromBytes(signature)}`;
}
__name(mintFirebaseCustomToken, "mintFirebaseCustomToken");

// src/kingschat.js
var KINGSCHAT_CLIENT_ID = "f9f8da46-de8a-4f57-aa96-ab8fb2f83926";
var KINGSCHAT_TOKEN_URL = "https://connect.kingsch.at/developer/api/oauth2/token";
var KINGSCHAT_PROFILE_URL = "https://connect.kingsch.at/developer/api/user/profile";
var DEFAULT_SITE_URL = "https://testimoniesofpraiseapp.com";
var STATE_MAX_AGE_MS = 10 * 60 * 1e3;
var HANDOFF_TTL_SECONDS = 60;
var HANDOFF_PREFIX = "kc_handoff:";
var enc3 = new TextEncoder();
function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(randomHex, "randomHex");
async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc3.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc3.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacHex, "hmacHex");
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
__name(safeEqual, "safeEqual");
var TARGETS = ["web", "app"];
var APP_RETURN_URL = "testimoniesofpraise://kingschat";
async function makeLoginState(secret, now = Date.now(), target = "web") {
  if (!TARGETS.includes(target)) throw new Error("Unknown sign-in target");
  const payload = `${now}.${randomHex(16)}.${target}`;
  return `${payload}.${await hmacHex(secret, `kc-state:${payload}`)}`;
}
__name(makeLoginState, "makeLoginState");
async function checkLoginState(state, secret, now = Date.now()) {
  if (typeof state !== "string") return null;
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [issuedAt, nonce, target, signature] = parts;
  if (!TARGETS.includes(target)) return null;
  const payload = `${issuedAt}.${nonce}.${target}`;
  if (!safeEqual(await hmacHex(secret, `kc-state:${payload}`), signature)) return null;
  const age = now - Number(issuedAt);
  if (!(Number.isFinite(age) && age >= 0 && age <= STATE_MAX_AGE_MS)) return null;
  return target;
}
__name(checkLoginState, "checkLoginState");
function siteRedirect(status, siteUrl = DEFAULT_SITE_URL, handoff, target = "web") {
  const handoffPart = handoff ? `&handoff=${encodeURIComponent(handoff)}` : "";
  if (target === "app") return `${APP_RETURN_URL}?kingschat=${encodeURIComponent(status)}${handoffPart}`;
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, "");
  return `${base}/#/signin?kingschat=${encodeURIComponent(status)}${handoffPart}`;
}
__name(siteRedirect, "siteRedirect");
function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const list = String(env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
  return list.includes(origin) ? origin : "";
}
__name(allowedOrigin, "allowedOrigin");
function jsonResponse(body, status, request, env) {
  const headers = { "Content-Type": "application/json", Vary: "Origin", "Cache-Control": "no-store" };
  const origin = allowedOrigin(request, env);
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "content-type";
  }
  return new Response(JSON.stringify(body), { status, headers });
}
__name(jsonResponse, "jsonResponse");
async function handleKingsChatState(request, env, deps = {}) {
  if (!env.OTP_PEPPER) return jsonResponse({ error: "KingsChat sign-in is not configured yet." }, 503, request, env);
  const target = new URL(request.url).searchParams.get("target") === "app" ? "app" : "web";
  const state = await makeLoginState(env.OTP_PEPPER, deps.now ?? Date.now(), target);
  return jsonResponse({ state }, 200, request, env);
}
__name(handleKingsChatState, "handleKingsChatState");
async function handleKingsChatRedeem(request, env) {
  if (!env.OTP_KV) return jsonResponse({ error: "KingsChat sign-in is not configured yet." }, 503, request, env);
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400, request, env);
  }
  const handoff = typeof body?.handoff === "string" ? body.handoff : "";
  if (!/^[a-f0-9]{32}$/.test(handoff)) return jsonResponse({ error: "Invalid request." }, 400, request, env);
  const key = `${HANDOFF_PREFIX}${handoff}`;
  const stored = await env.OTP_KV.get(key);
  if (!stored) return jsonResponse({ error: "This sign-in has expired. Please try again." }, 404, request, env);
  await env.OTP_KV.delete(key);
  let record;
  try {
    record = JSON.parse(stored);
  } catch {
    return jsonResponse({ error: "This sign-in has expired. Please try again." }, 404, request, env);
  }
  return jsonResponse({ token: record.token, name: record.name ?? null }, 200, request, env);
}
__name(handleKingsChatRedeem, "handleKingsChatRedeem");
async function fetchKingsChatName(accessToken, apiKey, fetchFn = fetch) {
  if (!apiKey) return null;
  try {
    const res = await fetchFn(KINGSCHAT_PROFILE_URL, {
      headers: { Accept: "application/json", "api-key": apiKey, Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const name = typeof payload?.profile?.name === "string" ? payload.profile.name.trim() : "";
    return name ? name.slice(0, 100) : null;
  } catch {
    return null;
  }
}
__name(fetchKingsChatName, "fetchKingsChatName");
async function exchangeCode(code, fetchFn) {
  const res = await fetchFn(KINGSCHAT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ grant_type: "code", client_id: KINGSCHAT_CLIENT_ID, code })
  });
  if (!res.ok) throw new Error("Code exchange failed");
  const payload = await res.json();
  if (typeof payload.access_token !== "string" || !payload.access_token) throw new Error("No access token");
  return payload.access_token;
}
__name(exchangeCode, "exchangeCode");
async function handleKingsChatCallback(request, env, deps = {}) {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? Date.now();
  const site = env.SITE_URL || DEFAULT_SITE_URL;
  if (request.method !== "POST") return Response.redirect(siteRedirect("invalid", site), 303);
  let code = "";
  let origin = "";
  try {
    const form = await request.formData();
    code = String(form.get("code") ?? "").trim();
    origin = String(form.get("origin") ?? "");
  } catch {
    return Response.redirect(siteRedirect("invalid", site), 303);
  }
  if (!code || code.length > 512) return Response.redirect(siteRedirect("missing", site), 303);
  if (!env.OTP_PEPPER || !env.OTP_KV || !env.FIREBASE_SERVICE_ACCOUNT) {
    return Response.redirect(siteRedirect("unavailable", site), 303);
  }
  const target = await checkLoginState(origin, env.OTP_PEPPER, now);
  if (!target) return Response.redirect(siteRedirect("invalid", site), 303);
  let accessToken;
  try {
    accessToken = await exchangeCode(code, fetchFn);
  } catch {
    return Response.redirect(siteRedirect("failed", site, void 0, target), 303);
  }
  let kingsChatUserId;
  try {
    kingsChatUserId = await verifyKingsChatToken(accessToken, { clientId: KINGSCHAT_CLIENT_ID, fetchFn, now });
  } catch {
    return Response.redirect(siteRedirect("failed", site, void 0, target), 303);
  }
  const customToken = await mintFirebaseCustomToken(env.FIREBASE_SERVICE_ACCOUNT, `kc_${kingsChatUserId}`, now);
  const name = await fetchKingsChatName(accessToken, env.KINGSCHAT_API_KEY, fetchFn);
  const handoff = randomHex(16);
  await env.OTP_KV.put(`${HANDOFF_PREFIX}${handoff}`, JSON.stringify({ token: customToken, name }), {
    expirationTtl: HANDOFF_TTL_SECONDS
  });
  return Response.redirect(siteRedirect("ok", site, handoff, target), 303);
}
__name(handleKingsChatCallback, "handleKingsChatCallback");

// src/ai.js
var BGE_MODEL = "@cf/baai/bge-m3";
var EXPECTED_EMBEDDING_DIMENSIONS = 1024;
var RATE_WINDOW_SECONDS = 60;
var AIEndpointError = class extends Error {
  static {
    __name(this, "AIEndpointError");
  }
  constructor(status, code, message) {
    super(message);
    this.name = "AIEndpointError";
    this.status = status;
    this.code = code;
  }
};
function validateSearchQuery(value) {
  if (typeof value !== "string") {
    throw new AIEndpointError(400, "invalid_query", "Enter a search question.");
  }
  const query = value.trim();
  if (!query) throw new AIEndpointError(400, "invalid_query", "Enter a search question.");
  if (query.length > 1e3) {
    throw new AIEndpointError(400, "query_too_long", "Keep your search question under 1,000 characters.");
  }
  return query;
}
__name(validateSearchQuery, "validateSearchQuery");
async function enforceAiRateLimit(env, uid, action, maxRequests) {
  if (!env.OTP_KV) {
    throw new AIEndpointError(503, "rate_limit_unavailable", "AI services are temporarily unavailable.");
  }
  const bucket = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1e3));
  const key = `ai-rate:${String(action).replace(/[^a-z0-9_-]/gi, "")}:${uid}:${bucket}`;
  const current = Number(await env.OTP_KV.get(key) || "0");
  if (current >= maxRequests) {
    throw new AIEndpointError(429, "rate_limited", "You have reached the short-term AI request limit. Please try again in a minute.");
  }
  await env.OTP_KV.put(key, String(current + 1), { expirationTtl: RATE_WINDOW_SECONDS * 2 });
}
__name(enforceAiRateLimit, "enforceAiRateLimit");
function decodeFirestoreValue(value) {
  if (!value || typeof value !== "object") return void 0;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue?.values || []).map(decodeFirestoreValue);
  if ("mapValue" in value) {
    const out = {};
    for (const [key, child] of Object.entries(value.mapValue?.fields || {})) out[key] = decodeFirestoreValue(child);
    return out;
  }
  return void 0;
}
__name(decodeFirestoreValue, "decodeFirestoreValue");
async function semanticSearch(env, authorization, question, limit = 8) {
  const query = validateSearchQuery(question);
  if (!env.FIREBASE_PROJECT_ID) {
    throw new AIEndpointError(503, "firestore_not_configured", "Internal testimony search is not configured yet.");
  }
  const embedded = await createEmbeddings(env, [query]);
  const embedding = embedded.embeddings[0];
  const fieldPaths = [
    "title",
    "description",
    "authorName",
    "thumbnail",
    "videoUrl",
    "duration",
    "category",
    "keywords",
    "createdAt",
    "publishedAt",
    "isPublished",
    "isFeatured",
    "isDownloadable"
  ];
  const structuredQuery = {
    from: [{ collectionId: "testimonies" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "isPublished" },
        op: "EQUAL",
        value: { booleanValue: true }
      }
    },
    select: { fields: fieldPaths.map((fieldPath2) => ({ fieldPath: fieldPath2 })) },
    findNearest: {
      vectorField: { fieldPath: "aiEmbedding" },
      // Firestore REST encodes a vector value as a map with __type__ "__vector__".
      queryVector: { mapValue: { fields: { __type__: { stringValue: "__vector__" }, value: { arrayValue: { values: embedding.map((number) => ({ doubleValue: number })) } } } } },
      distanceMeasure: "COSINE",
      limit: Math.max(1, Math.min(12, Number.isInteger(limit) ? limit : 8))
    }
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2e4);
  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:runQuery`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery }),
      signal: controller.signal
    });
    const raw = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
    if (!response.ok) {
      console.error("[semantic] Firestore HTTP", response.status, raw.slice(0, 300));
      if (response.status === 401 || response.status === 403) {
        throw new AIEndpointError(403, "firestore_search_denied", "You do not have permission to search this content. Please sign in and verify your account.");
      }
      if (response.status === 400 || response.status === 404 || response.status === 412) {
        throw new AIEndpointError(503, "vector_index_unavailable", "The testimony vector index is not ready. Ask an administrator to create the Firestore vector index and reindex published testimonies.");
      }
      throw new AIEndpointError(502, "firestore_search_failed", "Internal testimony search is temporarily unavailable.");
    }
    const documents = Array.isArray(payload) ? payload.flatMap((entry) => entry?.document ? [entry.document] : []) : [];
    const results = documents.flatMap((document) => {
      const fields = document.fields || {};
      const decoded = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]));
      const id = typeof document.name === "string" ? document.name.split("/").pop() : "";
      if (!id || decoded.isPublished !== true || typeof decoded.title !== "string") return [];
      return [{
        id,
        title: decoded.title,
        description: typeof decoded.description === "string" ? decoded.description : "",
        authorName: typeof decoded.authorName === "string" ? decoded.authorName : "",
        thumbnail: typeof decoded.thumbnail === "string" ? decoded.thumbnail : "",
        videoUrl: typeof decoded.videoUrl === "string" ? decoded.videoUrl : "",
        duration: typeof decoded.duration === "number" ? decoded.duration : void 0,
        category: typeof decoded.category === "string" ? decoded.category : "",
        keywords: Array.isArray(decoded.keywords) ? decoded.keywords.filter((value) => typeof value === "string") : [],
        createdAt: typeof decoded.createdAt === "string" ? decoded.createdAt : null,
        publishedAt: typeof decoded.publishedAt === "string" ? decoded.publishedAt : null,
        isPublished: true,
        isFeatured: decoded.isFeatured === true,
        isDownloadable: decoded.isDownloadable === true
      }];
    });
    return { results, model: embedded.model, dimensions: embedded.dimensions };
  } catch (error) {
    if (error instanceof AIEndpointError) throw error;
    if (error?.name === "AbortError") throw new AIEndpointError(504, "firestore_search_timeout", "Internal testimony search timed out. Please try again.");
    throw new AIEndpointError(502, "firestore_search_failed", "Internal testimony search is temporarily unavailable.");
  } finally {
    clearTimeout(timer);
  }
}
__name(semanticSearch, "semanticSearch");
async function createEmbeddings(env, rawTexts) {
  if (!env.AI || typeof env.AI.run !== "function") {
    throw new AIEndpointError(503, "embeddings_not_configured", "Semantic search embeddings are not configured on the server yet.");
  }
  if (!Array.isArray(rawTexts) || rawTexts.length < 1 || rawTexts.length > 16) {
    throw new AIEndpointError(400, "invalid_texts", "Send between 1 and 16 text items for embedding.");
  }
  const texts = rawTexts.map((text) => {
    if (typeof text !== "string" || !text.trim() || text.length > 3e3) {
      throw new AIEndpointError(400, "invalid_text", "Each text item must contain 1\u20133,000 characters.");
    }
    return text.trim();
  });
  if (texts.reduce((n, text) => n + text.length, 0) > 24e3) {
    throw new AIEndpointError(400, "payload_too_large", "The combined embedding text is too large.");
  }
  let result;
  try {
    result = await env.AI.run(BGE_MODEL, { text: texts });
  } catch {
    throw new AIEndpointError(502, "embedding_failed", "Could not generate search embeddings right now.");
  }
  const rawData = result?.data ?? result?.embeddings ?? result?.result?.data;
  let embeddings = [];
  if (Array.isArray(rawData) && rawData.length && Array.isArray(rawData[0])) {
    embeddings = rawData;
  } else if (Array.isArray(rawData) && rawData.every((n) => typeof n === "number") && texts.length === 1) {
    embeddings = [rawData];
  } else if (Array.isArray(rawData) && rawData.every((n) => typeof n === "number") && Array.isArray(result?.shape) && result.shape.length === 2 && result.shape[0] === texts.length) {
    const dimensions2 = result.shape[1];
    embeddings = Array.from({ length: texts.length }, (_, i) => rawData.slice(i * dimensions2, (i + 1) * dimensions2));
  }
  if (embeddings.length !== texts.length) {
    throw new AIEndpointError(502, "invalid_embeddings", "The embedding service returned an unexpected result.");
  }
  const dimensions = embeddings[0]?.length;
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 2048) {
    throw new AIEndpointError(502, "invalid_embedding_dimensions", "The embedding service returned an unsupported vector size.");
  }
  if (dimensions !== EXPECTED_EMBEDDING_DIMENSIONS) {
    throw new AIEndpointError(502, "embedding_model_changed", `Expected ${EXPECTED_EMBEDDING_DIMENSIONS}-dimension embeddings but received ${dimensions}. Check the model before indexing.`);
  }
  for (const vector of embeddings) {
    if (!Array.isArray(vector) || vector.length !== dimensions || vector.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
      throw new AIEndpointError(502, "invalid_embedding_values", "The embedding service returned invalid vector values.");
    }
  }
  return { embeddings, dimensions, model: BGE_MODEL };
}
__name(createEmbeddings, "createEmbeddings");

// src/clips.js
var GEMINI = "https://generativelanguage.googleapis.com";
var EMBED_MODEL = "models/gemini-embedding-001";
var DIMENSIONS = 1024;
async function embedQuery(env, text) {
  if (!env.GEMINI_API_KEY) throw new AIEndpointError(503, "clip_search_not_configured", "Video moment search is not available yet.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2e4);
  try {
    const response = await fetch(`${GEMINI}/v1beta/${EMBED_MODEL}:embedContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBED_MODEL,
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: DIMENSIONS
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => null);
    const values = data?.embedding?.values;
    if (!response.ok || !Array.isArray(values) || values.length !== DIMENSIONS) {
      throw new AIEndpointError(502, "embedding_failed", "Video moment search is temporarily unavailable.");
    }
    return values;
  } catch (error) {
    if (error instanceof AIEndpointError) throw error;
    throw new AIEndpointError(502, "embedding_failed", "Video moment search is temporarily unavailable.");
  } finally {
    clearTimeout(timer);
  }
}
__name(embedQuery, "embedQuery");
async function searchClips(env, authorization, uid, question, limit = 6) {
  const query = validateSearchQuery(question);
  await enforceAiRateLimit(env, uid, "clip-search", 25);
  const vector = await embedQuery(env, query);
  const structuredQuery = {
    from: [{ collectionId: "testimonyClips" }],
    where: { fieldFilter: { field: { fieldPath: "isPublished" }, op: "EQUAL", value: { booleanValue: true } } },
    findNearest: {
      vectorField: { fieldPath: "embedding" },
      // Firestore REST encodes a vector value as a map with __type__ "__vector__".
      queryVector: { mapValue: { fields: { __type__: { stringValue: "__vector__" }, value: { arrayValue: { values: vector.map((n) => ({ doubleValue: n })) } } } } },
      distanceMeasure: "COSINE",
      limit: Math.max(1, Math.min(10, Number.isInteger(limit) ? limit : 6))
    }
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2e4);
  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:runQuery`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AIEndpointError(403, "firestore_search_denied", "You do not have permission to search this content.");
      }
      throw new AIEndpointError(503, "clip_index_unavailable", "The video moment index is not ready yet.");
    }
    const clips = (Array.isArray(payload) ? payload : []).flatMap((entry) => {
      const f = entry?.document?.fields;
      if (!f || f.isPublished?.booleanValue !== true) return [];
      const testimonyId = f.testimonyId?.stringValue;
      const startSec = Number(f.startSec?.integerValue ?? f.startSec?.doubleValue);
      if (!testimonyId || !Number.isFinite(startSec)) return [];
      return [{
        testimonyId,
        title: String(f.title?.stringValue ?? "").slice(0, 200),
        startSec,
        endSec: Number(f.endSec?.integerValue ?? f.endSec?.doubleValue ?? startSec),
        startLabel: String(f.startLabel?.stringValue ?? ""),
        description: String(f.description?.stringValue ?? "").slice(0, 300)
      }];
    });
    return { clips };
  } catch (error) {
    if (error instanceof AIEndpointError) throw error;
    if (error?.name === "AbortError") throw new AIEndpointError(504, "clip_search_timeout", "Video moment search timed out. Please try again.");
    throw new AIEndpointError(502, "clip_search_failed", "Video moment search is temporarily unavailable.");
  } finally {
    clearTimeout(timer);
  }
}
__name(searchClips, "searchClips");

// src/praxiom.js
var PRAXIOM_BASE_URL = "https://cloud.praxiomai.io/v1";
var PRAXIOM_MODEL = "praxiom";
var PRAXIOM_TIMEOUT_MS = 25e3;
async function praxiomError(response) {
  let code = "";
  try {
    code = (await response.json())?.error?.code || "";
  } catch {
    code = "";
  }
  const status = response.status;
  console.error("[praxiom] HTTP", status, code);
  if (status === 402 || code === "insufficient_credit") {
    return new AIEndpointError(503, "provider_balance", "The assistant is out of AI credit. Please tell the administrator.");
  }
  if (status === 401 || code === "invalid_api_key") {
    return new AIEndpointError(502, "provider_auth_error", "The assistant key needs checking. Please tell the administrator.");
  }
  if (status === 429) {
    return new AIEndpointError(429, "provider_rate_limit", "The assistant is busy. Please wait a moment and try again.");
  }
  if (status === 503 || code === "model_unavailable") {
    return new AIEndpointError(503, "provider_unavailable", "The assistant is temporarily unavailable. Please try again shortly.");
  }
  if (status === 400 && code === "context_length_exceeded") {
    return new AIEndpointError(400, "context_too_long", "That conversation is too long. Please start a new chat.");
  }
  if (status === 400) {
    return new AIEndpointError(400, "provider_request_error", "The assistant could not read that request. Please rephrase and try again.");
  }
  return new AIEndpointError(502, "provider_error", `The assistant could not complete this request (code ${status}).`);
}
__name(praxiomError, "praxiomError");
async function postChat(env, body, { fetchFn = fetch, signal } = {}) {
  if (!env.PRAXIOM_API_KEY) {
    throw new AIEndpointError(503, "assistant_not_configured", "The assistant is not available right now.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRAXIOM_TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const response = await fetchFn(`${PRAXIOM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.PRAXIOM_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, model: PRAXIOM_MODEL }),
      signal: controller.signal
    });
    if (!response.ok) throw await praxiomError(response);
    return response;
  } catch (error) {
    if (error instanceof AIEndpointError) throw error;
    if (error?.name === "AbortError") {
      throw new AIEndpointError(504, "provider_timeout", "The assistant took too long. Please try again.");
    }
    throw new AIEndpointError(502, "provider_unavailable", "The assistant is temporarily unavailable.");
  } finally {
    clearTimeout(timer);
  }
}
__name(postChat, "postChat");
async function praxiomChat(env, { messages, tools, maxTokens = 700, temperature = 0.3 }, options = {}) {
  const body = {
    messages,
    max_tokens: maxTokens,
    temperature,
    ...tools?.length ? { tools } : {}
  };
  const response = await postChat(env, body, options);
  const data = await response.json();
  const choice = data?.choices?.[0];
  const message = choice?.message;
  if (!message) throw new AIEndpointError(502, "empty_answer", "The assistant did not return an answer. Please try again.");
  return {
    text: typeof message.content === "string" ? message.content.trim() : "",
    toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
    finishReason: choice.finish_reason || null,
    usage: data.usage || null
  };
}
__name(praxiomChat, "praxiomChat");

// src/assistant.js
var MAX_MESSAGES = 12;
var MAX_MESSAGE_CHARS = 1e3;
var MAX_TOOL_ROUNDS = 4;
var MAX_REPLY_CHARS = 2e3;
var ASSISTANT_SCREENS = ["live", "radio", "adotopoc", "written", "testimonies", "sponsor", "downloads"];
var SYSTEM_PROMPT = `You are Praxiom, the AI assistant for the Testimonies of Praise app and website.
Help people use the app, find testimonies, and answer general questions. Be friendly, patient, respectful and encouraging. Be brief and accurate. This is a Christian testimony-sharing platform, so keep a respectful tone when discussing faith.

About Testimonies of Praise (use this wording when someone asks what it is):
"Testimonies of Praise is an LMM TV production in collaboration with Loveworld XP, dedicated to showcasing the life-changing impact of the songs by the Loveworld Singers. Through powerful, real-life testimonies, the programme reveals how these inspired songs have brought healing, hope, restoration, miracles, and transformation to countless lives around the world. In the past year alone, more than 500 life-changing testimonies have been shared, demonstrating the undeniable power of God's Word expressed through music. Beyond inspiring testimonies, Testimonies of Praise also serves as a platform for promoting the Ministry of Music's products, services, and initiatives, while providing updates on major events and programmes across the Loveworld Nation."
After that description, briefly list the app's features below, and offer to take the person to one or help find a testimony.

What the app offers (use these exact names when you refer to them):
- "Click to watch Live": our live broadcasts, with live chat when we are on air.
- "T.O.P on Loveworld Radio": our 24/7 audio stream (Listen tab).
- "ADOTOPOC Resource Center": resources for hosting outreaches and crusades.
- "Read Testimonies": written testimonies people can read in full and comment on.
- "Watch powerful Testimonies": the video testimony archive (Testimonies tab).
- "Sponsor Testimonies of Praise show": how to support the show.
- Downloads: testimonies saved for offline viewing.

Rules:
- For testimonies in the app, use search_testimonies and mention only testimonies it returned.
- When someone asks to find a moment inside a video (for example "the part where a cat appears"), use search_clips and name the video and the time.
- Use open_screen only when the person asks to go somewhere; name the screen in your reply.
- You have no live or current information and no web search. For questions about current events, prices, schedules or anything that changes, say you do not have that information and suggest checking with the TOP team.
- If a tool fails or finds nothing, say so plainly. Do not guess.
- For login, sign-in, verification, playback, download or notification problems: suggest the likely fix step by step, then say that if it still fails the person should contact the TOP team. Never say you fixed a problem, because you cannot change anything in the account or app.
- If you do not know something, say so. Never invent prices, bank details, phone numbers, links, dates, Bible verses, testimonies or statistics.
- Never ask for or repeat passwords, codes or personal details.
- Keep answers short: a few sentences. Give more detail only when the person asks for it.
- Format: plain text. For a list, start each item on its own line with "- ". Do not use asterisks, bold markers or headings.`;
var TOOLS = [
  {
    type: "function",
    function: {
      name: "search_testimonies",
      description: "Search published testimonies in the app by meaning. Returns titles and short descriptions.",
      parameters: { type: "object", properties: { query: { type: "string", description: "What the person is looking for, in a few words." } }, required: ["query"] }
    }
  },
  {
    type: "function",
    function: {
      name: "search_clips",
      description: 'Find the moment inside a testimony video that matches a description (for example "a cat", "the pastor prays"). Returns the video and the start time.',
      parameters: { type: "object", properties: { query: { type: "string", description: "What is seen or said in the moment, in a few words." } }, required: ["query"] }
    }
  },
  {
    type: "function",
    function: {
      name: "open_screen",
      description: "Suggest opening one of the app screens.",
      parameters: { type: "object", properties: { screen: { type: "string", enum: ASSISTANT_SCREENS } }, required: ["screen"] }
    }
  }
];
function validateMessages(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AIEndpointError(400, "invalid_messages", "Send your question to the assistant.");
  }
  const recent = value.slice(-MAX_MESSAGES);
  return recent.map((item) => {
    if (!item || typeof item !== "object" || item.role !== "user" && item.role !== "assistant") {
      throw new AIEndpointError(400, "invalid_messages", "The conversation could not be read. Please start a new chat.");
    }
    if (typeof item.content !== "string" || !item.content.trim()) {
      throw new AIEndpointError(400, "invalid_messages", "Messages cannot be empty.");
    }
    const content = item.content.trim();
    if (item.role === "user" && content.length > MAX_MESSAGE_CHARS) {
      throw new AIEndpointError(400, "message_too_long", `Keep each message under ${MAX_MESSAGE_CHARS} characters.`);
    }
    return { role: item.role, content: content.slice(0, MAX_MESSAGE_CHARS) };
  });
}
__name(validateMessages, "validateMessages");
function validateToolCall(name, args) {
  if (name === "search_testimonies" || name === "search_clips") {
    if (typeof args?.query !== "string" || !args.query.trim() || args.query.length > 200) return { ok: false, reason: "invalid_arguments" };
    return { ok: true, name, args: { query: args.query.trim() } };
  }
  if (name === "open_screen") {
    if (!ASSISTANT_SCREENS.includes(args?.screen)) return { ok: false, reason: "unknown_screen" };
    return { ok: true, name, args: { screen: args.screen } };
  }
  return { ok: false, reason: "unknown_tool" };
}
__name(validateToolCall, "validateToolCall");
async function runAssistant(env, authorization, uid, rawMessages, deps = {}) {
  const messages = validateMessages(rawMessages);
  await enforceAiRateLimit(env, uid, "assistant", 20);
  const semanticSearch2 = deps.semanticSearch || semanticSearch;
  const searchClips2 = deps.searchClips || searchClips;
  const conversation = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
  let navigate = null;
  let testimonies = [];
  let clips = [];
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const allowTools = round < MAX_TOOL_ROUNDS;
    const turn = await praxiomChat(
      env,
      { messages: conversation, tools: allowTools ? TOOLS : void 0, maxTokens: 700, temperature: 0.3 },
      { fetchFn: deps.fetchFn }
    );
    if (turn.toolCalls.length === 0) {
      const reply = turn.text.slice(0, MAX_REPLY_CHARS);
      if (!reply) throw new AIEndpointError(502, "empty_answer", "The assistant did not return an answer. Please try again.");
      return { reply, navigate, testimonies, clips, sources: [] };
    }
    conversation.push({ role: "assistant", content: turn.text || null, tool_calls: turn.toolCalls });
    for (const call of turn.toolCalls) {
      let args = null;
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = null;
      }
      const checked = validateToolCall(call.function?.name, args);
      let result;
      if (!checked.ok) {
        result = { error: checked.reason };
      } else if (checked.name === "search_testimonies") {
        const found = await semanticSearch2(env, authorization, checked.args.query, 5);
        testimonies = found.results.slice(0, 5).map((t) => ({ id: t.id, title: t.title, description: String(t.description || "").slice(0, 300) }));
        result = { testimonies };
      } else if (checked.name === "search_clips") {
        const found = await searchClips2(env, authorization, uid, checked.args.query, 4);
        clips = found.clips.slice(0, 4);
        result = { clips: clips.map((c) => ({ testimonyId: c.testimonyId, title: c.title, startLabel: c.startLabel, startSec: c.startSec, description: c.description })) };
      } else {
        navigate = checked.args.screen;
        result = { opened: checked.args.screen };
      }
      conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new AIEndpointError(502, "too_many_steps", "That took too many steps. Please ask in a simpler way.");
}
__name(runAssistant, "runAssistant");

// src/notify/engine.ts
var CATEGORIES = [
  "dailyPraise",
  "testimonies",
  "loveworldMusic",
  "lyricalAnalysis",
  "live",
  "featuredChoirs",
  "articles",
  "announcements",
  "community"
];
var DAILY_MAX_OPTIONS = [1, 3, 5];
var FREQUENCY_TO_MAX = { light: 1, balanced: 3, frequent: 5 };
var MIN_INTERVAL_OPTIONS = [120, 180, 240];
var HARD_MIN_INTERVAL_MIN = 120;
var DEFAULT_TIMEZONE = "Africa/Lagos";
var DEFAULT_CATEGORIES = Object.fromEntries(CATEGORIES.map((c) => [c, true]));
var DEFAULT_SETTINGS = {
  dailyMax: 3,
  frequency: "balanced",
  categories: { ...DEFAULT_CATEGORIES },
  timezone: DEFAULT_TIMEZONE,
  quietHours: { enabled: true, start: "22:00", end: "07:00" },
  minIntervalMinutes: 120,
  signals: { counts: {}, opened: {}, seen: {} },
  lastActiveAt: null
};
function legacyToCategories(prefs) {
  const p = prefs || {};
  const on = /* @__PURE__ */ __name((v) => v !== false, "on");
  return {
    dailyPraise: true,
    testimonies: on(p.testimonies),
    loveworldMusic: on(p.loveworld),
    lyricalAnalysis: on(p.loveworld),
    live: on(p.live),
    featuredChoirs: on(p.choirs),
    articles: on(p.articles),
    announcements: on(p.announcements),
    community: on(p.promotions)
  };
}
__name(legacyToCategories, "legacyToCategories");
var HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
var isHHMM = /* @__PURE__ */ __name((v) => typeof v === "string" && HHMM.test(v), "isHHMM");
var hhmmToMinutes = /* @__PURE__ */ __name((v) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5)), "hhmmToMinutes");
var tzCache = /* @__PURE__ */ new Map();
function isValidTimeZone(tz) {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  if (tzCache.has(tz)) return tzCache.get(tz);
  let ok = false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
    ok = true;
  } catch {
    ok = false;
  }
  tzCache.set(tz, ok);
  return ok;
}
__name(isValidTimeZone, "isValidTimeZone");
var num = /* @__PURE__ */ __name((v) => typeof v === "number" && Number.isFinite(v) ? v : null, "num");
var obj = /* @__PURE__ */ __name((v) => v && typeof v === "object" && !Array.isArray(v) ? v : {}, "obj");
var MAX_SEEN = 200;
function normalizeSignals(raw) {
  const r = obj(raw);
  const counts = {};
  const opened = {};
  for (const c of CATEGORIES) {
    const n = num(obj(r.counts)[c]);
    if (n !== null && n > 0) counts[c] = Math.min(n, 1e6);
    const o = num(obj(r.opened)[c]);
    if (o !== null && o > 0) opened[c] = Math.min(o, 1e6);
  }
  const seen = Object.entries(obj(r.seen)).filter(([k, v]) => k.length <= 128 && num(v) !== null).sort((a, b) => b[1] - a[1]).slice(0, MAX_SEEN);
  return { counts, opened, seen: Object.fromEntries(seen) };
}
__name(normalizeSignals, "normalizeSignals");
function normalizeSettings(raw, legacy, defaultTz = DEFAULT_TIMEZONE) {
  const r = obj(raw);
  const freq = r.frequency === "light" || r.frequency === "balanced" || r.frequency === "frequent" ? r.frequency : null;
  const dailyMax = DAILY_MAX_OPTIONS.includes(r.dailyMax) ? r.dailyMax : freq ? FREQUENCY_TO_MAX[freq] : DEFAULT_SETTINGS.dailyMax;
  const frequency = dailyMax === 1 ? "light" : dailyMax === 5 ? "frequent" : "balanced";
  const savedCats = obj(r.categories);
  const base = Object.keys(savedCats).length ? DEFAULT_CATEGORIES : legacy ? legacyToCategories(legacy) : DEFAULT_CATEGORIES;
  const categories = { ...base };
  for (const c of CATEGORIES) if (typeof savedCats[c] === "boolean") categories[c] = savedCats[c];
  const qh = obj(r.quietHours);
  const quietHours = {
    enabled: typeof qh.enabled === "boolean" ? qh.enabled : DEFAULT_SETTINGS.quietHours.enabled,
    start: isHHMM(qh.start) ? qh.start : DEFAULT_SETTINGS.quietHours.start,
    end: isHHMM(qh.end) ? qh.end : DEFAULT_SETTINGS.quietHours.end
  };
  const mi = num(r.minIntervalMinutes);
  return {
    dailyMax,
    frequency,
    categories,
    timezone: isValidTimeZone(r.timezone) ? r.timezone : isValidTimeZone(defaultTz) ? defaultTz : DEFAULT_TIMEZONE,
    quietHours,
    minIntervalMinutes: mi !== null && MIN_INTERVAL_OPTIONS.includes(mi) ? mi : DEFAULT_SETTINGS.minIntervalMinutes,
    signals: normalizeSignals(r.signals),
    lastActiveAt: num(r.lastActiveAt)
  };
}
__name(normalizeSettings, "normalizeSettings");
function typeToCategory(type) {
  switch (type) {
    case "testimony":
    case "written":
    case "featured":
      return "testimonies";
    case "live":
      return "live";
    case "announcement":
      return "announcements";
    case "article":
      return "articles";
    case "choir":
      return "featuredChoirs";
    case "loveworld":
      return "loveworldMusic";
    case "lyrical":
      return "lyricalAnalysis";
    case "dailyPraise":
      return "dailyPraise";
    default:
      return "community";
  }
}
__name(typeToCategory, "typeToCategory");
function prefToCategory(pref) {
  switch (pref) {
    case "testimonies":
      return "testimonies";
    case "live":
      return "live";
    case "announcements":
      return "announcements";
    case "promotions":
      return "community";
    case "choirs":
      return "featuredChoirs";
    case "loveworld":
      return "loveworldMusic";
    case "articles":
      return "articles";
    default:
      return null;
  }
}
__name(prefToCategory, "prefToCategory");
var CATEGORY_DEFAULT_TYPE = {
  dailyPraise: "dailyPraise",
  testimonies: "testimony",
  loveworldMusic: "loveworld",
  lyricalAnalysis: "lyrical",
  live: "live",
  featuredChoirs: "choir",
  articles: "article",
  announcements: "announcement",
  community: "community"
};
var ROUTE_TYPES = /* @__PURE__ */ new Set([
  "testimony",
  "written",
  "featured",
  "live",
  "announcement",
  "article",
  "promotion",
  "radio",
  "resource",
  "choir",
  "loveworld",
  "lyrical",
  "dailyPraise",
  "community"
]);
var fmtCache = /* @__PURE__ */ new Map();
function fmt(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    fmtCache.set(tz, f);
  }
  return f;
}
__name(fmt, "fmt");
function localParts(ms, tz) {
  const p = {};
  for (const part of fmt(tz).formatToParts(new Date(ms))) p[part.type] = part.value;
  const hour = Number(p.hour) % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: hour * 60 + Number(p.minute), hour };
}
__name(localParts, "localParts");
function offsetMs(ms, tz) {
  const p = {};
  for (const part of fmt(tz).formatToParts(new Date(ms))) p[part.type] = part.value;
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return asUtc - Math.floor(ms / 1e3) * 1e3;
}
__name(offsetMs, "offsetMs");
function zonedTimeToUtc(date, minutes, tz) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const o1 = offsetMs(guess, tz);
  let t = guess - o1;
  const o2 = offsetMs(t, tz);
  if (o2 !== o1) t = guess - o2;
  return t;
}
__name(zonedTimeToUtc, "zonedTimeToUtc");
function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
__name(addDays, "addDays");
function inQuietHours(minutes, q) {
  if (!q.enabled) return false;
  const s = hhmmToMinutes(q.start);
  const e = hhmmToMinutes(q.end);
  if (s === e) return false;
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}
__name(inQuietHours, "inQuietHours");
function quietHoursEnd(ms, s) {
  const lp = localParts(ms, s.timezone);
  if (!inQuietHours(lp.minutes, s.quietHours)) return ms;
  const end = hhmmToMinutes(s.quietHours.end);
  const date = lp.minutes < end ? lp.date : addDays(lp.date, 1);
  return zonedTimeToUtc(date, end, s.timezone);
}
__name(quietHoursEnd, "quietHoursEnd");
var DEFAULT_WINDOWS = [
  { id: "morning", time: "08:00", categories: ["dailyPraise"] },
  { id: "midday", time: "11:30", categories: ["testimonies"] },
  { id: "afternoon", time: "14:30", categories: ["loveworldMusic", "lyricalAnalysis"] },
  { id: "evening", time: "17:30", categories: ["community", "featuredChoirs", "articles", "announcements"] },
  { id: "night", time: "20:00", categories: ["live", "*"] }
];
function normalizeEngineConfig(raw) {
  const r = obj(raw);
  const list = Array.isArray(r.windows) ? r.windows : [];
  const windows = [];
  for (const w of list.slice(0, 12)) {
    const o = obj(w);
    if (!isHHMM(o.time)) continue;
    const cats = (Array.isArray(o.categories) ? o.categories : []).filter((c) => c === "*" || CATEGORIES.includes(c));
    if (!cats.length) continue;
    windows.push({ id: typeof o.id === "string" && o.id ? o.id.slice(0, 32) : o.time, time: o.time, categories: cats });
  }
  windows.sort((a, b) => hhmmToMinutes(a.time) - hhmmToMinutes(b.time));
  return {
    enabled: r.enabled !== false,
    windows: windows.length ? windows : DEFAULT_WINDOWS,
    defaultTimezone: isValidTimeZone(r.defaultTimezone) ? r.defaultTimezone : DEFAULT_TIMEZONE
  };
}
__name(normalizeEngineConfig, "normalizeEngineConfig");
function nextWindowSlot(afterMs, tz, category, windows) {
  const usable = windows.filter((w) => w.categories.includes(category) || w.categories.includes("*"));
  if (!usable.length) return null;
  const start = localParts(afterMs, tz).date;
  for (let k = 0; k < 9; k++) {
    const date = addDays(start, k);
    for (const w of usable) {
      const at = zonedTimeToUtc(date, hhmmToMinutes(w.time), tz);
      if (at >= afterMs) return { at, windowId: w.id };
    }
  }
  return null;
}
__name(nextWindowSlot, "nextWindowSlot");
var HOUR = 36e5;
var MINUTE = 6e4;
var DEFAULT_EXPIRY_HOURS = {
  dailyPraise: 16,
  testimonies: 72,
  loveworldMusic: 72,
  lyricalAnalysis: 72,
  live: 3,
  featuredChoirs: 72,
  articles: 72,
  announcements: 48,
  community: 72
};
var DEFAULT_PRIORITY = {
  dailyPraise: 60,
  testimonies: 50,
  loveworldMusic: 45,
  lyricalAnalysis: 45,
  live: 90,
  featuredChoirs: 40,
  articles: 40,
  announcements: 70,
  community: 35
};
var str = /* @__PURE__ */ __name((v, max) => typeof v === "string" ? v.trim().slice(0, max) : "", "str");
var safeId = /* @__PURE__ */ __name((v) => v.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120), "safeId");
function safeDeepLink(v) {
  const s = str(v, 300);
  if (!s) return null;
  return /^(\/#\/|#\/|top:\/\/)[A-Za-z0-9/_\-?=&.%]*$/.test(s) ? s : null;
}
__name(safeDeepLink, "safeDeepLink");
function normalizeCampaign(id, raw, now) {
  const r = obj(raw);
  const title = str(r.title, 100);
  const body = str(r.body ?? r.message, 300);
  if (!title || !body) return null;
  const type = typeof r.type === "string" && ROUTE_TYPES.has(r.type) ? r.type : null;
  const category = CATEGORIES.includes(r.category) ? r.category : typeToCategory(type);
  const publishAt = num(r.publishAt) ?? num(r.createdAt) ?? now;
  const expiresAt = num(r.expiresAt) ?? publishAt + DEFAULT_EXPIRY_HOURS[category] * HOUR;
  const pr = num(r.priority);
  const contentId = str(r.contentId, 100) || null;
  const audience = Array.isArray(r.audienceUids) ? r.audienceUids.filter((u) => typeof u === "string" && u && u.length <= 128).slice(0, 30) : null;
  const status = ["scheduled", "fanning_out", "queued", "cancelled", "expired", "invalid"].includes(r.status) ? r.status : "scheduled";
  return {
    id,
    title,
    body,
    category,
    type: type ?? CATEGORY_DEFAULT_TYPE[category],
    contentId,
    deepLink: safeDeepLink(r.deepLink),
    publishAt,
    expiresAt,
    priority: pr !== null ? Math.max(0, Math.min(100, pr)) : DEFAULT_PRIORITY[category],
    dedupeKey: str(r.dedupeKey, 150) || (contentId ? `${category}:${contentId}` : `campaign:${id}`),
    delivery: r.delivery === "immediate" || r.delivery === "window" ? r.delivery : category === "live" ? "immediate" : "window",
    audienceUids: audience && audience.length ? audience : null,
    status,
    cursor: typeof r.cursor === "string" ? r.cursor : null,
    source: str(r.source, 40) || "admin"
  };
}
__name(normalizeCampaign, "normalizeCampaign");
var queueId = /* @__PURE__ */ __name((campaignId, uid) => `${safeId(campaignId)}__${safeId(uid)}`.slice(0, 250), "queueId");
function buildQueueItem(c, uid, s, now, windows) {
  if (!s.categories[c.category]) return { skip: "category_off" };
  const start = Math.max(c.publishAt, now);
  if (start >= c.expiresAt) return { skip: "expired" };
  let at = start;
  let windowId = null;
  if (c.delivery === "window") {
    const slot = nextWindowSlot(start, s.timezone, c.category, windows);
    if (slot && slot.at < c.expiresAt) {
      at = slot.at;
      windowId = slot.windowId;
    }
  }
  const id = queueId(c.id, uid);
  return {
    item: {
      uid,
      notificationId: id,
      campaignId: c.id,
      title: c.title,
      body: c.body,
      type: c.type,
      category: c.category,
      contentId: c.contentId,
      deepLink: c.deepLink,
      scheduledAt: at,
      dueAt: at,
      expiresAt: c.expiresAt,
      timezone: s.timezone,
      priority: c.priority,
      dedupeKey: c.dedupeKey,
      delivery: c.delivery,
      status: "scheduled",
      createdAt: now,
      sentAt: null,
      attempts: 0,
      deferrals: 0,
      windowId
    }
  };
}
__name(buildQueueItem, "buildQueueItem");
var LEDGER_KEEP_MS = 35 * 24 * HOUR;
function normalizeLedger(raw) {
  const e = obj(obj(raw).entries);
  const entries = {};
  for (const [k, v] of Object.entries(e)) {
    const o = obj(v);
    const at = num(o.at);
    if (at === null || typeof o.day !== "string") continue;
    entries[k] = { at, day: o.day, key: typeof o.key === "string" ? o.key : "", cat: o.cat || "community" };
  }
  return { entries };
}
__name(normalizeLedger, "normalizeLedger");
function ledgerStats(l, day) {
  let countToday = 0;
  let lastSentAt = 0;
  const keys = /* @__PURE__ */ new Set();
  for (const e of Object.values(l.entries)) {
    if (e.day === day) countToday += 1;
    if (e.at > lastSentAt) lastSentAt = e.at;
    if (e.key) keys.add(e.key);
  }
  return { countToday, lastSentAt, keys };
}
__name(ledgerStats, "ledgerStats");
function ledgerWith(l, id, entry, now) {
  const entries = {};
  for (const [k, v] of Object.entries(l.entries)) if (now - v.at < LEDGER_KEEP_MS) entries[k] = v;
  entries[id] = entry;
  return { entries };
}
__name(ledgerWith, "ledgerWith");
function ledgerWithout(l, id) {
  const entries = { ...l.entries };
  delete entries[id];
  return { entries };
}
__name(ledgerWithout, "ledgerWithout");
var ACTIVE_WINDOW_MS = 6 * MINUTE;
var MAX_DEFERRALS = 24;
var MAX_ATTEMPTS = 5;
var PROCESSING_LEASE_MS = 10 * MINUTE;
var WINDOW_LATE_MS = 90 * MINUTE;
var minGapMs = /* @__PURE__ */ __name((s) => Math.max(HARD_MIN_INTERVAL_MIN, s.minIntervalMinutes) * MINUTE, "minGapMs");
function relevance(item, s, now) {
  const used = s.signals.counts[item.category] ?? 0;
  const opened = s.signals.opened[item.category] ?? 0;
  const ageH = Math.max(0, (now - item.scheduledAt) / HOUR);
  return item.priority + 15 * Math.min(1, used / 10) + 10 * Math.min(1, opened / 5) - Math.min(20, ageH * 0.5);
}
__name(relevance, "relevance");
function deferTo(item, until, s, ctx) {
  if (item.delivery === "immediate") return until;
  const slot = nextWindowSlot(until, s.timezone, item.category, ctx.windows)?.at ?? until;
  return slot < item.expiresAt ? slot : until;
}
__name(deferTo, "deferTo");
function evaluate(item, s, ledger, now, ctx) {
  if (now >= item.expiresAt) return { action: "skip", status: "expired", reason: "expired" };
  if (!s.categories[item.category]) return { action: "skip", status: "skipped", reason: "category_off" };
  if (item.contentId && s.signals.seen[item.contentId]) return { action: "skip", status: "skipped", reason: "already_seen" };
  const day = localParts(now, s.timezone).date;
  const st = ledgerStats(ledger, day);
  if (ledger.entries[item.notificationId] || st.keys.has(item.dedupeKey)) return { action: "skip", status: "skipped", reason: "duplicate" };
  const active = s.lastActiveAt !== null && now - s.lastActiveAt < ACTIVE_WINDOW_MS && s.lastActiveAt <= now + MINUTE;
  if (!ctx.hasDevices && !active) return { action: "skip", status: "skipped", reason: "no_devices" };
  const wrap = /* @__PURE__ */ __name((until, reason) => {
    const at = deferTo(item, until, s, ctx);
    if (at >= item.expiresAt) return { action: "skip", status: "expired", reason: `expired_${reason}` };
    if (item.deferrals >= MAX_DEFERRALS) return { action: "skip", status: "skipped", reason: "too_many_deferrals" };
    return { action: "defer", until: at, reason };
  }, "wrap");
  if (st.countToday >= s.dailyMax) return wrap(zonedTimeToUtc(addDays(day, 1), 0, s.timezone), "daily_cap");
  if (st.lastSentAt && now - st.lastSentAt < minGapMs(s)) return wrap(st.lastSentAt + minGapMs(s), "spacing");
  const qEnd = quietHoursEnd(now, s);
  if (qEnd > now) return wrap(qEnd, "quiet_hours");
  if (item.delivery === "window" && item.windowId && now - item.scheduledAt > WINDOW_LATE_MS) return wrap(now, "missed_window");
  return { action: "send", channel: active ? "in_app" : "push", score: relevance(item, s, now) };
}
__name(evaluate, "evaluate");
var COL = {
  settings: "notificationSettings",
  queue: "notificationQueue",
  ledger: "notificationLedger",
  campaigns: "notificationCampaigns",
  stats: "notificationStats",
  tokens: "pushTokens",
  config: "settings",
  configId: "notificationEngine",
  inbox: /* @__PURE__ */ __name((uid) => `users/${uid}/notifications`, "inbox")
};
function toTokenRow(d) {
  const r = d.data;
  const uid = typeof r.uid === "string" ? r.uid : "";
  if (!uid) return null;
  const token = typeof r.token === "string" ? r.token : "";
  const w = obj(r.web);
  const keys = obj(w.keys);
  const web = typeof w.endpoint === "string" && /^https:\/\//.test(w.endpoint) && typeof keys.p256dh === "string" && typeof keys.auth === "string" ? { endpoint: w.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } } : null;
  const kind = web ? "web" : /^Expo(nent)?PushToken\[/.test(token) ? "expo" : null;
  if (!kind) return null;
  return { id: d.id, uid, kind, token, web, prefs: r.prefs ? obj(r.prefs) : null, updatedAt: num(r.updatedAtMs) ?? num(r.updatedAt) ?? 0 };
}
__name(toTokenRow, "toTokenRow");
function legacyFor(rows) {
  const withPrefs = rows.filter((r) => r.prefs).sort((a, b) => b.updatedAt - a.updatedAt);
  return withPrefs[0]?.prefs ?? null;
}
__name(legacyFor, "legacyFor");
var Stats = class {
  static {
    __name(this, "Stats");
  }
  inc = {};
  campaigns = /* @__PURE__ */ new Map();
  add(path, n = 1) {
    this.inc[path] = (this.inc[path] ?? 0) + n;
  }
  event(ev, cat, campaignId, extra) {
    this.add(`events.${ev}`);
    this.add(`categories.${cat}.${ev.replace("notification_", "")}`);
    if (extra) this.add(extra);
    const field = ev.replace("notification_", "");
    const c = this.campaigns.get(campaignId) ?? {};
    c[`counts.${field}`] = (c[`counts.${field}`] ?? 0) + 1;
    this.campaigns.set(campaignId, c);
  }
  campaign(campaignId, path, n = 1) {
    const c = this.campaigns.get(campaignId) ?? {};
    c[path] = (c[path] ?? 0) + n;
    this.campaigns.set(campaignId, c);
  }
  writes(now) {
    const out = [];
    if (Object.keys(this.inc).length) {
      out.push({ col: COL.stats, id: new Date(now).toISOString().slice(0, 10), kind: "merge", data: { updatedAt: now }, inc: this.inc });
    }
    for (const [id, inc] of this.campaigns) out.push({ col: COL.campaigns, id, kind: "merge", data: { lastActivityAt: now }, inc });
    return out;
  }
};
var reasonKey = /* @__PURE__ */ __name((r) => `skipReasons.${r.replace(/[^A-Za-z0-9_]/g, "_")}`, "reasonKey");
var chunk = /* @__PURE__ */ __name((a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n)), "chunk");
var uniq = /* @__PURE__ */ __name((a) => [...new Set(a)], "uniq");
var backoffMs = /* @__PURE__ */ __name((attempts) => Math.min(30 * MINUTE, MINUTE * 2 ** Math.max(0, attempts - 1)), "backoffMs");
async function tokensFor(store, uids) {
  const out = /* @__PURE__ */ new Map();
  const pages = await Promise.all(chunk(uids, 30).map((c) => store.whereIn(COL.tokens, "uid", c)));
  for (const d of pages.flat()) {
    const t = toTokenRow(d);
    if (!t) continue;
    out.set(t.uid, [...out.get(t.uid) ?? [], t]);
  }
  return out;
}
__name(tokensFor, "tokensFor");
async function fanOut(store, cfg, now, o, rep, stats) {
  const due = await store.dueQuery(COL.campaigns, "dueAt", now, o.maxCampaigns);
  for (const doc of due) {
    rep.campaigns += 1;
    const c = normalizeCampaign(doc.id, doc.data, now);
    const finish = /* @__PURE__ */ __name((status) => store.commit([{ col: COL.campaigns, id: doc.id, kind: "update", data: { status, finishedAt: now }, remove: ["dueAt"], ifVersion: doc.version }], false), "finish");
    if (!c) {
      await finish("invalid");
      continue;
    }
    if (c.status === "cancelled" || c.status === "expired" || c.status === "queued" || c.status === "invalid") {
      await finish(c.status);
      continue;
    }
    if (now >= c.expiresAt) {
      await finish("expired");
      continue;
    }
    let version = doc.version;
    let cursor = c.cursor;
    for (let p = 0; p < o.maxPages; p++) {
      let rows;
      let done;
      if (c.audienceUids) {
        rows = await store.whereIn(COL.tokens, "uid", c.audienceUids);
        done = true;
      } else {
        rows = await store.pageById(COL.tokens, cursor, o.pageSize);
        done = rows.length < o.pageSize;
      }
      const tokens = rows.map(toTokenRow).filter((t) => Boolean(t));
      const byUid = /* @__PURE__ */ new Map();
      for (const t of tokens) byUid.set(t.uid, [...byUid.get(t.uid) ?? [], t]);
      const uids = [...byUid.keys()];
      const settings = uids.length ? await store.get(COL.settings, uids) : /* @__PURE__ */ new Map();
      const creates = [];
      const items = [];
      let notQueued = 0;
      for (const uid of uids) {
        const s = normalizeSettings(settings.get(uid)?.data, legacyFor(byUid.get(uid) ?? []), cfg.defaultTimezone);
        const r = buildQueueItem(c, uid, s, now, cfg.windows);
        if ("skip" in r) {
          notQueued += 1;
          stats.add(reasonKey(r.skip));
          continue;
        }
        items.push(r.item);
        creates.push({ col: COL.queue, id: r.item.notificationId, kind: "create", data: r.item });
      }
      const results = creates.length ? await store.commit(creates, false) : [];
      let created = 0;
      results.forEach((res, i) => {
        if (!res.ok) return;
        created += 1;
        stats.add("events.notification_queued");
        stats.add(`categories.${items[i].category}.queued`);
      });
      rep.queued += created;
      rep.notQueued += notQueued;
      const nextCursor = rows.length ? rows[rows.length - 1].id : cursor;
      const [upd] = await store.commit(
        [{
          col: COL.campaigns,
          id: doc.id,
          kind: "update",
          ifVersion: version,
          data: done ? { status: "queued", cursor: nextCursor, queuedAt: now } : { status: "fanning_out", cursor: nextCursor },
          ...done ? { remove: ["dueAt"] } : {},
          inc: { "counts.queued": created, "counts.notQueued": notQueued }
        }],
        false
      );
      if (!upd.ok) {
        rep.conflicts += 1;
        o.log(`[notify] campaign ${doc.id} is being fanned out by another run`);
        break;
      }
      version = upd.version ?? version;
      cursor = nextCursor;
      if (done) break;
    }
  }
}
__name(fanOut, "fanOut");
async function dispatchDue(store, sender, cfg, now, o, rep, stats) {
  const due = await store.dueQuery(COL.queue, "dueAt", now, o.maxItems);
  if (!due.length) return;
  const plain = [];
  const live = [];
  for (const d of due) {
    if (d.data.status === "processing") {
      plain.push({ col: COL.queue, id: d.id, kind: "update", ifVersion: d.version, data: { status: "failed", lastError: "interrupted", finishedAt: now }, remove: ["dueAt"] });
      stats.event("notification_failed", d.data.category, d.data.campaignId);
      rep.failed += 1;
    } else if (d.data.status === "scheduled") live.push(d);
    else plain.push({ col: COL.queue, id: d.id, kind: "update", ifVersion: d.version, data: {}, remove: ["dueAt"] });
  }
  const uids = uniq(live.map((d) => d.data.uid));
  const campaignIds = uniq(live.map((d) => d.data.campaignId));
  const [settingsMap, ledgerMap, tokenMap, campaignMap] = await Promise.all([
    store.get(COL.settings, uids),
    store.get(COL.ledger, uids),
    tokensFor(store, uids),
    store.get(COL.campaigns, campaignIds)
  ]);
  const claims = [];
  const skip = /* @__PURE__ */ __name((d, status, reason) => {
    plain.push({ col: COL.queue, id: d.id, kind: "update", ifVersion: d.version, data: { status, skipReason: reason, finishedAt: now }, remove: ["dueAt"] });
    stats.event(status === "expired" ? "notification_expired" : "notification_skipped", d.data.category, d.data.campaignId, reasonKey(reason));
    if (status === "expired") rep.expired += 1;
    else rep.skipped += 1;
  }, "skip");
  const defer = /* @__PURE__ */ __name((d, until, reason) => {
    plain.push({ col: COL.queue, id: d.id, kind: "update", ifVersion: d.version, data: { dueAt: until, scheduledAt: until, lastDeferReason: reason }, inc: { deferrals: 1 } });
    stats.add(`deferReasons.${reason}`);
    rep.deferred += 1;
  }, "defer");
  for (const uid of uids) {
    const mine = live.filter((d) => d.data.uid === uid);
    const tokens = tokenMap.get(uid) ?? [];
    const s = normalizeSettings(settingsMap.get(uid)?.data, legacyFor(tokens), cfg.defaultTimezone);
    const ledgerDoc = ledgerMap.get(uid) ?? null;
    const ledger = normalizeLedger(ledgerDoc?.data);
    const ctx = { windows: cfg.windows, hasDevices: tokens.length > 0 };
    const sendable = [];
    for (const d of mine) {
      const camp = campaignMap.get(d.data.campaignId);
      if (camp && camp.data.status === "cancelled") {
        skip(d, "skipped", "cancelled");
        continue;
      }
      const dec = evaluate(d.data, s, ledger, now, ctx);
      if (dec.action === "skip") skip(d, dec.status, dec.reason);
      else if (dec.action === "defer") defer(d, dec.until, dec.reason);
      else sendable.push({ d, dec });
    }
    if (!sendable.length) continue;
    sendable.sort((a, b) => b.dec.score - a.dec.score || a.d.data.scheduledAt - b.d.data.scheduledAt);
    const [best, ...rest] = sendable;
    for (const r of rest) {
      const after = now + minGapMs(s);
      const at = r.d.data.delivery === "immediate" ? after : nextWindowSlot(after, s.timezone, r.d.data.category, cfg.windows)?.at ?? after;
      if (at >= r.d.data.expiresAt) skip(r.d, "expired", "expired_slot_taken");
      else defer(r.d, at, "slot_taken");
    }
    const lp = localParts(now, s.timezone);
    claims.push({ item: best.d, channel: best.dec.channel, ledger, ledgerVersion: ledgerDoc ? ledgerDoc.version : null, day: lp.date, hour: lp.hour });
  }
  if (plain.length) await store.commit(plain, false);
  if (!claims.length) return;
  const nextLedger = /* @__PURE__ */ __name((c) => ledgerWith(c.ledger, c.item.data.notificationId, { at: now, day: c.day, key: c.item.data.dedupeKey, cat: c.item.data.category }, now), "nextLedger");
  const claimWrites = /* @__PURE__ */ __name((c) => {
    const it = c.item.data;
    const next = nextLedger(c);
    return [
      { col: COL.queue, id: c.item.id, kind: "update", ifVersion: c.item.version, data: { status: "processing", dueAt: now + PROCESSING_LEASE_MS, claimedAt: now, channel: c.channel }, inc: { attempts: 1 } },
      { col: COL.ledger, id: it.uid, kind: "set", ifVersion: c.ledgerVersion, data: { ...next, uid: it.uid, updatedAt: now } }
    ];
  }, "claimWrites");
  const won = [];
  const all = await store.commit(claims.flatMap(claimWrites), true);
  if (all.every((r) => r.ok)) {
    claims.forEach((c, i) => won.push({ c, ledgerVersion: all[i * 2 + 1].version ?? null, written: nextLedger(c) }));
  } else {
    for (const c of claims) {
      const r = await store.commit(claimWrites(c), true);
      if (r.every((x) => x.ok)) won.push({ c, ledgerVersion: r[1].version ?? null, written: nextLedger(c) });
      else rep.conflicts += 1;
    }
  }
  if (!won.length) return;
  const messages = [];
  const webJobs = [];
  const results = won.map(() => []);
  const tickets = won.map(() => []);
  const deadTokens = /* @__PURE__ */ new Set();
  const inboxWrites = [];
  won.forEach(({ c }, i) => {
    const it = c.item.data;
    const data = { type: it.type, contentId: it.contentId ?? void 0, deepLink: it.deepLink ?? void 0, campaignId: it.campaignId, category: it.category, notificationId: it.notificationId };
    if (c.channel === "in_app") {
      inboxWrites.push({
        col: COL.inbox(it.uid),
        id: it.notificationId,
        kind: "set",
        data: { title: it.title, message: it.body, type: it.type, contentId: it.contentId, deepLink: it.deepLink, campaignId: it.campaignId, category: it.category, source: "engine", isRead: false, createdAtMs: now }
      });
      return;
    }
    for (const t of tokenMap.get(it.uid) ?? []) {
      if (t.kind === "expo") messages.push({ msg: { to: t.token, title: it.title, body: it.body, data, sound: "default", channelId: "default", priority: "high" }, claim: i, tokenId: t.id });
      else if (t.web) webJobs.push({ claim: i, row: t, payload: { title: it.title, body: it.body, data } });
    }
  });
  if (inboxWrites.length) {
    const r = await store.commit(inboxWrites, false);
    let k = 0;
    won.forEach(({ c }, i) => {
      if (c.channel !== "in_app") return;
      results[i].push(r[k++]?.ok ? { status: "ok" } : { status: "error", code: "InboxWriteFailed", retryable: true, tokenGone: false });
    });
  }
  if (messages.length) {
    const res = await sender.expo(messages.map((m) => m.msg)).catch(() => messages.map(() => ({ status: "error", code: "NetworkError", retryable: true, tokenGone: false })));
    messages.forEach((m, k) => {
      const r = res[k] ?? { status: "error", code: "NoTicket", retryable: true, tokenGone: false };
      results[m.claim].push(r);
      if (r.status === "ok" && r.id) tickets[m.claim].push({ id: r.id, tokenId: m.tokenId });
      if (r.status === "error") {
        stats.add(`tickets.${r.code.replace(/[^A-Za-z0-9_]/g, "_")}`);
        if (r.tokenGone) deadTokens.add(m.tokenId);
      } else stats.add("tickets.ok");
    });
  }
  for (const j of webJobs) {
    const r = await sender.webPush(j.row.web, j.payload).catch(() => ({ status: "error", code: "NetworkError", retryable: true, tokenGone: false }));
    results[j.claim].push(r);
    if (r.status === "error" && r.tokenGone) deadTokens.add(j.row.id);
    stats.add(r.status === "ok" ? "webpush.ok" : `webpush.${r.code.replace(/[^A-Za-z0-9_]/g, "_")}`);
  }
  const out = [];
  const rollbacks = [];
  won.forEach(({ c, ledgerVersion, written }, i) => {
    const it = c.item.data;
    const rs = results[i];
    const ok = rs.some((r) => r.status === "ok");
    const errs = rs.filter((r) => r.status === "error");
    if (ok) {
      const t = tickets[i].slice(0, 10);
      out.push({
        col: COL.queue,
        id: c.item.id,
        kind: "update",
        data: { status: "sent", sentAt: now, ticketIds: t.map((x) => x.id), tickets: t, ...t.length ? { receiptDueAt: now + 15 * MINUTE, receiptChecks: 0 } : {}, localHour: c.hour },
        remove: ["dueAt", "lastError"]
      });
      stats.event("notification_sent", it.category, it.campaignId, `hours.h${String(c.hour).padStart(2, "0")}`);
      if (c.channel === "in_app") {
        stats.add("channels.in_app");
        stats.campaign(it.campaignId, "counts.inApp");
        rep.inApp += 1;
      } else stats.add("channels.push");
      rep.sent += 1;
      return;
    }
    const retryable = rs.length === 0 ? false : errs.some((e) => e.retryable);
    const lastError = (errs[0]?.code ?? (rs.length ? "Unknown" : "NoDevices")).slice(0, 80);
    const attempts = (it.attempts ?? 0) + 1;
    rollbacks.push({ uid: it.uid, id: it.notificationId, version: ledgerVersion, ledger: written });
    if (retryable && attempts < MAX_ATTEMPTS && now + backoffMs(attempts) < it.expiresAt) {
      out.push({ col: COL.queue, id: c.item.id, kind: "update", data: { status: "scheduled", dueAt: now + backoffMs(attempts), lastError } });
      stats.add("retries");
      rep.retried += 1;
    } else {
      out.push({ col: COL.queue, id: c.item.id, kind: "update", data: { status: "failed", lastError, finishedAt: now }, remove: ["dueAt"] });
      stats.event("notification_failed", it.category, it.campaignId);
      rep.failed += 1;
    }
  });
  for (const id of deadTokens) out.push({ col: COL.tokens, id, kind: "delete" });
  rep.tokensRemoved += deadTokens.size;
  if (out.length) await store.commit(out, false);
  for (const rb of rollbacks) {
    let version = rb.version;
    let base = rb.ledger;
    for (let attempt = 0; attempt < 3 && base.entries[rb.id]; attempt++) {
      const [r] = await store.commit([{ col: COL.ledger, id: rb.uid, kind: "set", ifVersion: version, data: { ...ledgerWithout(base, rb.id), uid: rb.uid, updatedAt: now } }], true);
      if (r.ok) break;
      const cur = (await store.get(COL.ledger, [rb.uid])).get(rb.uid) ?? null;
      if (!cur) break;
      version = cur.version;
      base = normalizeLedger(cur.data);
    }
  }
}
__name(dispatchDue, "dispatchDue");
async function checkReceipts(store, sender, now, rep, stats) {
  const due = await store.dueQuery(COL.queue, "receiptDueAt", now, 300);
  if (!due.length) return;
  const ids = uniq(due.flatMap((d) => (d.data.tickets ?? []).map((t) => t.id))).slice(0, 1e3);
  const receipts = ids.length ? await sender.receipts(ids).catch(() => null) : {};
  if (!receipts) return;
  const writes = [];
  const dead = /* @__PURE__ */ new Set();
  for (const d of due) {
    const ts = d.data.tickets ?? [];
    const got = ts.filter((t) => receipts[t.id]);
    if (got.length < ts.length && (d.data.receiptChecks ?? 0) < 3) {
      writes.push({ col: COL.queue, id: d.id, kind: "update", data: { receiptDueAt: now + 30 * MINUTE }, inc: { receiptChecks: 1 } });
      continue;
    }
    const codes = got.map((t) => receipts[t.id].status === "ok" ? "ok" : receipts[t.id].details?.error || "Error");
    got.forEach((t) => {
      if (receipts[t.id].details?.error === "DeviceNotRegistered") dead.add(t.tokenId);
    });
    for (const code of codes) stats.add(`receipts.${code.replace(/[^A-Za-z0-9_]/g, "_")}`);
    rep.receipts += codes.length;
    writes.push({ col: COL.queue, id: d.id, kind: "update", data: { receiptStatus: codes.length ? codes.every((c) => c === "ok") ? "ok" : codes.find((c) => c !== "ok") : "unknown" }, remove: ["receiptDueAt"] });
  }
  for (const id of dead) writes.push({ col: COL.tokens, id, kind: "delete" });
  rep.tokensRemoved += dead.size;
  if (writes.length) await store.commit(writes, false);
}
__name(checkReceipts, "checkReceipts");
async function runDispatcher(store, sender, opts = {}) {
  const o = {
    now: opts.now ?? Date.now(),
    maxPages: opts.maxPages ?? 3,
    pageSize: opts.pageSize ?? 300,
    maxCampaigns: opts.maxCampaigns ?? 3,
    maxItems: opts.maxItems ?? 100,
    log: opts.log ?? (() => void 0)
  };
  const now = o.now;
  const rep = { enabled: true, campaigns: 0, queued: 0, notQueued: 0, sent: 0, inApp: 0, deferred: 0, skipped: 0, expired: 0, failed: 0, retried: 0, conflicts: 0, tokensRemoved: 0, receipts: 0 };
  const cfg = normalizeEngineConfig((await store.get(COL.config, [COL.configId])).get(COL.configId)?.data);
  if (!cfg.enabled) {
    rep.enabled = false;
    return rep;
  }
  const stats = new Stats();
  try {
    await fanOut(store, cfg, now, o, rep, stats);
    await dispatchDue(store, sender, cfg, now, o, rep, stats);
    await checkReceipts(store, sender, now, rep, stats);
  } finally {
    const w = stats.writes(now);
    if (w.length) await store.commit(w, false).catch(() => void 0);
  }
  o.log(`[notify] ${JSON.stringify(rep)}`);
  return rep;
}
__name(runDispatcher, "runDispatcher");
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
__name(hash, "hash");
function eventCampaign(ev, now) {
  const category = ev.category ?? typeToCategory(ev.type);
  const key = ev.key ? `${ev.type}:${ev.key}` : ev.type === "live" ? `live:${ev.liveKey || new Date(now).toISOString().slice(0, 10)}:${hash(ev.title)}` : `${ev.type}:${ev.contentId || hash(`${ev.title}|${ev.body}`)}`;
  const id = safeId(`ev_${key.replace(/:/g, "_")}`);
  return {
    id,
    data: {
      title: ev.title.slice(0, 100),
      body: ev.body.slice(0, 300),
      type: ev.type,
      category,
      contentId: ev.contentId ?? null,
      publishAt: now,
      expiresAt: now + DEFAULT_EXPIRY_HOURS[category] * HOUR,
      priority: DEFAULT_PRIORITY[category],
      dedupeKey: key,
      delivery: category === "live" ? "immediate" : "window",
      status: "scheduled",
      dueAt: now,
      source: "event",
      createdAt: now,
      counts: { queued: 0, sent: 0, skipped: 0, failed: 0, expired: 0 }
    }
  };
}
__name(eventCampaign, "eventCampaign");

// src/notify/firestoreStore.js
var enc4 = new TextEncoder();
var b64url = /* @__PURE__ */ __name((bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}, "b64url");
var cachedToken = null;
async function serviceAccessToken(serviceAccountRaw, fetchFn = fetch, now = Date.now()) {
  const sa = parseServiceAccount(serviceAccountRaw);
  if (cachedToken && cachedToken.email === sa.client_email && cachedToken.exp > now + 6e4) return cachedToken.token;
  const pem = sa.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const iat = Math.floor(now / 1e3);
  const head = b64url(enc4.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const body = b64url(
    enc4.encode(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 }))
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc4.encode(`${head}.${body}`)));
  const res = await fetchFn("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${head}.${body}.${b64url(sig)}`
  });
  if (!res.ok) throw new Error(`Service account token request failed (${res.status})`);
  const j = await res.json();
  cachedToken = { token: j.access_token, exp: now + (Number(j.expires_in) || 3600) * 1e3, email: sa.client_email };
  return cachedToken.token;
}
__name(serviceAccessToken, "serviceAccessToken");
function toValue(v) {
  if (v === null || v === void 0) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.filter((x) => x !== void 0).map(toValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
__name(toValue, "toValue");
function toFields(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (v !== void 0) out[k] = toValue(v);
  return out;
}
__name(toFields, "toFields");
function fromValue(v) {
  if (!v || typeof v !== "object") return null;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("referenceValue" in v) return v.referenceValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  return null;
}
__name(fromValue, "fromValue");
function fromFields(f) {
  const out = {};
  for (const [k, v] of Object.entries(f || {})) out[k] = fromValue(v);
  return out;
}
__name(fromFields, "fromFields");
var fieldPath = /* @__PURE__ */ __name((dotted) => dotted.split(".").map((s) => /^[A-Za-z_][A-Za-z_0-9]*$/.test(s) ? s : `\`${s.replace(/\\/g, "\\\\").replace(/`/g, "\\`")}\``).join("."), "fieldPath");
function nest(flat) {
  const out = {};
  for (const [path, v] of Object.entries(flat || {})) {
    const k = path.split(".");
    let cur = out;
    for (const p of k.slice(0, -1)) cur = cur[p] && typeof cur[p] === "object" && !Array.isArray(cur[p]) ? cur[p] : cur[p] = {};
    cur[k[k.length - 1]] = v;
  }
  return out;
}
__name(nest, "nest");
function createFirestoreStore({ projectId, getToken, fetchFn = fetch }) {
  const root = `projects/${projectId}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${root}`;
  const name = /* @__PURE__ */ __name((col, id) => `${root}/${col}/${id}`, "name");
  const idOf = /* @__PURE__ */ __name((n) => n.slice(n.lastIndexOf("/") + 1), "idOf");
  const parentOf = /* @__PURE__ */ __name((col) => {
    const i = col.lastIndexOf("/");
    return i < 0 ? { parent: base, collectionId: col } : { parent: `${base}/${col.slice(0, i)}`, collectionId: col.slice(i + 1) };
  }, "parentOf");
  async function call(url, body) {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let json2 = null;
    try {
      json2 = text ? JSON.parse(text) : null;
    } catch {
    }
    return { ok: res.ok, status: res.status, json: json2, text };
  }
  __name(call, "call");
  async function query(col, structuredQuery) {
    const { parent, collectionId } = parentOf(col);
    const r = await call(`${parent}:runQuery`, { structuredQuery: { from: [{ collectionId }], ...structuredQuery } });
    if (!r.ok) throw new Error(`Firestore query on ${col} failed (${r.status}): ${r.text.slice(0, 200)}`);
    return (r.json || []).filter((x) => x.document).map((x) => ({ id: idOf(x.document.name), data: fromFields(x.document.fields), version: x.document.updateTime }));
  }
  __name(query, "query");
  function toWrite(w) {
    const docName = name(w.col, w.id);
    if (w.kind === "delete") return { delete: docName, ...w.ifVersion ? { currentDocument: { updateTime: w.ifVersion } } : {} };
    const out = {};
    if (w.kind === "create" || w.kind === "set") {
      out.update = { name: docName, fields: toFields(w.data || {}) };
    } else {
      out.update = { name: docName, fields: toFields(nest(w.data || {})) };
      out.updateMask = { fieldPaths: [...Object.keys(w.data || {}), ...w.remove || []].map(fieldPath) };
    }
    const inc = Object.entries(w.inc || {}).filter(([, n]) => n !== 0);
    if (inc.length) out.updateTransforms = inc.map(([p, n]) => ({ fieldPath: fieldPath(p), increment: toValue(n) }));
    if (w.kind === "create" || w.ifVersion === null) out.currentDocument = { exists: false };
    else if (typeof w.ifVersion === "string") out.currentDocument = { updateTime: w.ifVersion };
    else if (w.kind === "update") out.currentDocument = { exists: true };
    return out;
  }
  __name(toWrite, "toWrite");
  return {
    async get(col, ids) {
      const out = new Map(ids.map((id) => [id, null]));
      for (let i = 0; i < ids.length; i += 100) {
        const r = await call(`${base}:batchGet`, { documents: ids.slice(i, i + 100).map((id) => name(col, id)) });
        if (!r.ok) throw new Error(`Firestore batchGet on ${col} failed (${r.status})`);
        for (const x of r.json || []) if (x.found) out.set(idOf(x.found.name), { id: idOf(x.found.name), data: fromFields(x.found.fields), version: x.found.updateTime });
      }
      return out;
    },
    dueQuery(col, field, max, limit) {
      if (limit <= 0) return Promise.resolve([]);
      return query(col, {
        where: { fieldFilter: { field: { fieldPath: field }, op: "LESS_THAN_OR_EQUAL", value: { integerValue: String(Math.floor(max)) } } },
        orderBy: [{ field: { fieldPath: field }, direction: "ASCENDING" }],
        limit
      });
    },
    whereIn(col, field, values) {
      if (!values.length) return Promise.resolve([]);
      return query(col, { where: { fieldFilter: { field: { fieldPath: field }, op: "IN", value: { arrayValue: { values: values.slice(0, 30).map(toValue) } } } } });
    },
    pageById(col, afterId, limit) {
      return query(col, {
        orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
        ...afterId ? { startAt: { values: [{ referenceValue: name(col, afterId) }], before: false } } : {},
        limit
      });
    },
    async commit(writes, atomic) {
      if (!writes.length) return [];
      if (atomic) {
        const r = await call(`${base}:commit`, { writes: writes.map(toWrite) });
        if (r.ok) return (r.json?.writeResults || []).map((x) => ({ ok: true, version: x.updateTime || r.json.commitTime }));
        if ([400, 404, 409].includes(r.status) || /FAILED_PRECONDITION|ALREADY_EXISTS|NOT_FOUND|ABORTED/.test(r.text)) return writes.map(() => ({ ok: false }));
        throw new Error(`Firestore commit failed (${r.status}): ${r.text.slice(0, 200)}`);
      }
      const results = new Array(writes.length);
      let start = 0;
      while (start < writes.length) {
        const seen = /* @__PURE__ */ new Set();
        let end = start;
        while (end < writes.length && end - start < 400 && !seen.has(`${writes[end].col}/${writes[end].id}`)) seen.add(`${writes[end].col}/${writes[end++].id}`);
        const part = writes.slice(start, end);
        const r = await call(`${base}:batchWrite`, { writes: part.map(toWrite) });
        if (!r.ok) throw new Error(`Firestore batchWrite failed (${r.status}): ${r.text.slice(0, 200)}`);
        part.forEach((_, i) => {
          const code = r.json?.status?.[i]?.code ?? 0;
          results[start + i] = code === 0 ? { ok: true, version: r.json?.writeResults?.[i]?.updateTime } : { ok: false };
        });
        start = end;
      }
      return results;
    }
  };
}
__name(createFirestoreStore, "createFirestoreStore");

// src/notify/senders.js
var EXPO_SEND = "https://exp.host/--/api/v2/push/send";
var EXPO_RECEIPTS = "https://exp.host/--/api/v2/push/getReceipts";
var RETRYABLE_TICKET = /* @__PURE__ */ new Set(["MessageRateExceeded"]);
var netErr = /* @__PURE__ */ __name((code = "NetworkError") => ({ status: "error", code, retryable: true, tokenGone: false }), "netErr");
function createExpoSender(fetchFn = fetch, log = () => void 0) {
  async function batch(msgs, allowSplit = true) {
    let res;
    try {
      res = await fetchFn(EXPO_SEND, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(msgs) });
    } catch {
      return msgs.map(() => netErr());
    }
    if (res.ok) {
      const data = (await res.json().catch(() => ({})))?.data || [];
      return msgs.map((_, i) => {
        const t = data[i];
        if (!t) return netErr("NoTicket");
        if (t.status === "ok") return { status: "ok", id: t.id };
        const code = t.details?.error || "Unknown";
        return { status: "error", code, retryable: RETRYABLE_TICKET.has(code), tokenGone: code === "DeviceNotRegistered" };
      });
    }
    const text = await res.text().catch(() => "");
    let err = null;
    try {
      err = JSON.parse(text)?.errors?.[0] ?? null;
    } catch {
    }
    if (allowSplit && err?.code === "PUSH_TOO_MANY_EXPERIENCE_IDS" && err.details && typeof err.details === "object") {
      const out = new Array(msgs.length);
      const groups = Object.values(err.details).map((tokens) => msgs.map((m, i) => [m, i]).filter(([m]) => (tokens || []).includes(m.to)));
      for (const g of groups) {
        const r = await batch(g.map(([m]) => m), false);
        g.forEach(([, i], k) => out[i] = r[k]);
      }
      return out.map((x) => x ?? netErr("NoTicket"));
    }
    log(`[notify] Expo HTTP ${res.status}: ${text.slice(0, 200)}`);
    const retryable = res.status === 429 || res.status >= 500;
    return msgs.map(() => ({ status: "error", code: `HTTP_${res.status}`, retryable, tokenGone: false }));
  }
  __name(batch, "batch");
  return {
    async expo(messages) {
      const out = [];
      for (let i = 0; i < messages.length; i += 100) out.push(...await batch(messages.slice(i, i + 100)));
      return out;
    },
    async receipts(ids) {
      const out = {};
      for (let i = 0; i < ids.length; i += 1e3) {
        const res = await fetchFn(EXPO_RECEIPTS, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ ids: ids.slice(i, i + 1e3) }) });
        if (!res.ok) throw new Error(`Expo receipts HTTP ${res.status}`);
        Object.assign(out, (await res.json())?.data || {});
      }
      return out;
    }
  };
}
__name(createExpoSender, "createExpoSender");
var te = new TextEncoder();
var b64urlEncode = /* @__PURE__ */ __name((bytes) => {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}, "b64urlEncode");
var b64urlDecode = /* @__PURE__ */ __name((str2) => {
  const s = String(str2).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}, "b64urlDecode");
var concat = /* @__PURE__ */ __name((...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}, "concat");
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}
__name(hkdf, "hkdf");
async function encryptWebPush(sub, plaintext, { salt = crypto.getRandomValues(new Uint8Array(16)), serverKeys } = {}) {
  const uaPublic = b64urlDecode(sub.keys.p256dh);
  const authSecret = b64urlDecode(sub.keys.auth);
  const keys = serverKeys || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, keys.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(te.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(plaintext, new Uint8Array([2]))));
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}
__name(encryptWebPush, "encryptWebPush");
async function vapidAuthorization(endpoint, publicKey, privateKey, subject, now = Date.now()) {
  const pub = b64urlDecode(publicKey);
  const jwk = { kty: "EC", crv: "P-256", d: privateKey, x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64urlEncode(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64urlEncode(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1e3) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64urlEncode(sig)}, k=${publicKey}`;
}
__name(vapidAuthorization, "vapidAuthorization");
function createWebPushSender(env, fetchFn = fetch) {
  const pub = env.VAPID_PUBLIC_KEY;
  const priv = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT || "https://testimoniesofpraiseapp.com";
  return /* @__PURE__ */ __name(async function webPush(sub, payload) {
    if (!pub || !priv) return { status: "error", code: "WebPushNotConfigured", retryable: false, tokenGone: false };
    let res;
    try {
      const body = await encryptWebPush(sub, te.encode(JSON.stringify(payload)));
      res = await fetchFn(sub.endpoint, {
        method: "POST",
        headers: { Authorization: await vapidAuthorization(sub.endpoint, pub, priv, subject), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "normal" },
        body
      });
    } catch {
      return netErr();
    }
    if (res.status >= 200 && res.status < 300) return { status: "ok" };
    if (res.status === 404 || res.status === 410) return { status: "error", code: "SubscriptionGone", retryable: false, tokenGone: true };
    return { status: "error", code: `HTTP_${res.status}`, retryable: res.status === 429 || res.status >= 500, tokenGone: false };
  }, "webPush");
}
__name(createWebPushSender, "createWebPushSender");

// src/notify/index.js
var engineConfigured = /* @__PURE__ */ __name((env) => Boolean(env.FIREBASE_SERVICE_ACCOUNT && env.FIREBASE_PROJECT_ID), "engineConfigured");
function makeStore(env, fetchFn = fetch) {
  return createFirestoreStore({
    projectId: env.FIREBASE_PROJECT_ID,
    getToken: /* @__PURE__ */ __name(() => serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT, fetchFn), "getToken"),
    fetchFn
  });
}
__name(makeStore, "makeStore");
function makeSender(env, fetchFn = fetch) {
  const expo = createExpoSender(fetchFn, (m) => console.log(m));
  return { expo: expo.expo, receipts: expo.receipts, webPush: createWebPushSender(env, fetchFn) };
}
__name(makeSender, "makeSender");
function runEngine(env, { fetchFn = fetch, now } = {}) {
  return runDispatcher(makeStore(env, fetchFn), makeSender(env, fetchFn), {
    now,
    maxItems: Number(env.NOTIFY_MAX_ITEMS) || 100,
    pageSize: Number(env.NOTIFY_PAGE_SIZE) || 300,
    maxPages: Number(env.NOTIFY_MAX_PAGES) || 3,
    log: /* @__PURE__ */ __name((m) => console.log(m), "log")
  });
}
__name(runEngine, "runEngine");
var NotifyInputError = class extends Error {
  static {
    __name(this, "NotifyInputError");
  }
};
function parseEvent(req) {
  const r = req && typeof req === "object" ? req : {};
  const data = r.data && typeof r.data === "object" ? r.data : {};
  const type = typeof data.type === "string" ? data.type : r.type;
  const contentId = data.contentId ?? r.contentId;
  if (typeof type !== "string" || !ROUTE_TYPES.has(type)) throw new NotifyInputError("Invalid data.");
  if (contentId !== void 0 && contentId !== null && (typeof contentId !== "string" || contentId.length > 100)) throw new NotifyInputError("Invalid data.");
  if (typeof r.title !== "string" || !r.title.trim() || r.title.length > 100) throw new NotifyInputError("Invalid title.");
  if (typeof r.body !== "string" || !r.body.trim() || r.body.length > 300) throw new NotifyInputError("Invalid message.");
  let category = typeToCategory(type);
  if (r.pref !== void 0) {
    const fromPref = prefToCategory(r.pref);
    if (!fromPref) throw new NotifyInputError("Unknown notification type.");
    if (type === "announcement" || type === "featured" || type === "promotion") category = fromPref;
  }
  return { type, contentId: contentId || null, title: r.title.trim(), body: r.body.trim(), category };
}
__name(parseEvent, "parseEvent");
async function publishEvent(env, ev, { fetchFn = fetch, now = Date.now() } = {}) {
  const store = makeStore(env, fetchFn);
  const c = eventCampaign(ev, now);
  const [r] = await store.commit([{ col: COL.campaigns, id: c.id, kind: "create", data: c.data }], false);
  const report = await runEngine(env, { fetchFn, now });
  return { campaignId: c.id, created: r.ok, report };
}
__name(publishEvent, "publishEvent");

// src/index.js
var WORKER_VERSION = "2.5.0";
var json = /* @__PURE__ */ __name((body, status, headers) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    ...headers
  }
}), "json");
async function verifyAdmin(auth, env) {
  const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const q = await fetch(`${base}:runQuery`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "pushTokens" }],
        where: { fieldFilter: { field: { fieldPath: "prefs.testimonies" }, op: "EQUAL", value: { booleanValue: true } } },
        limit: 1
      }
    })
  });
  return q.status !== 401 && q.status !== 403 && q.ok;
}
__name(verifyAdmin, "verifyAdmin");
function parseAllowedOrigins(raw) {
  return String(raw || "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
}
__name(parseAllowedOrigins, "parseAllowedOrigins");
var LOCAL_DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function isAllowedOrigin(origin, allowed) {
  if (!origin) return false;
  return allowed.includes(origin) || LOCAL_DEV_ORIGIN.test(origin);
}
__name(isAllowedOrigin, "isAllowedOrigin");
function corsHeaders(origin, allowed) {
  const headers = {
    "Access-Control-Allow-Headers": "authorization, content-type, x-file-name, x-folder, cache-control",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
  if (isAllowedOrigin(origin, allowed)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
__name(corsHeaders, "corsHeaders");
var index_default = {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (e) {
      const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
      console.error("[relay] unhandled error", e?.stack || e);
      return json({ error: "Internal relay error." }, 500, corsHeaders(request.headers.get("Origin") || "", allowed));
    }
  },
  /** Cron Trigger (wrangler.toml [triggers]): the notification dispatcher, every 5 minutes. */
  async scheduled(_event, env, ctx) {
    if (!engineConfigured(env)) {
      console.error("[notify] FIREBASE_SERVICE_ACCOUNT is not set: the notification engine cannot run.");
      return;
    }
    ctx.waitUntil(runEngine(env).catch((e) => console.error("[notify] dispatcher run failed", e?.stack || e)));
  }
};
async function handle(request, env) {
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const origin = request.headers.get("Origin") || "";
  const isOriginAllowed = isAllowedOrigin(origin, allowed);
  const cors = corsHeaders(origin, allowed);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: isOriginAllowed ? 204 : 403, headers: cors });
  }
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (request.method === "GET" && (pathname === "/api/media/status" || pathname === "/status")) {
    const hasAccessKey = Boolean(env.BUNNY_STORAGE_ACCESS_KEY);
    const hasZoneName = Boolean(env.BUNNY_STORAGE_ZONE_NAME);
    const hasCdnHost = Boolean(env.BUNNY_CDN_HOSTNAME);
    const hasEndpoint = Boolean(env.BUNNY_STORAGE_ENDPOINT);
    const missingBunny = [];
    if (!hasAccessKey) missingBunny.push("BUNNY_STORAGE_ACCESS_KEY");
    if (!hasZoneName) missingBunny.push("BUNNY_STORAGE_ZONE_NAME");
    const bunnyConfigured = hasAccessKey && hasZoneName;
    return json(
      {
        status: "ok",
        version: WORKER_VERSION,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        providers: {
          bunny: {
            configured: bunnyConfigured,
            hasAccessKey,
            storageZone: env.BUNNY_STORAGE_ZONE_NAME || null,
            cdnHostname: env.BUNNY_CDN_HOSTNAME || (env.BUNNY_STORAGE_ZONE_NAME ? `${env.BUNNY_STORAGE_ZONE_NAME}.b-cdn.net` : null),
            endpoint: env.BUNNY_STORAGE_ENDPOINT || "storage.bunnycdn.com",
            missingConfig: missingBunny,
            state: bunnyConfigured ? "ready" : !hasZoneName ? "missing_zone" : "missing_secret"
          },
          cloudinary: {
            configured: Boolean(env.CLOUDINARY_CLOUD_NAME || env.VITE_CLOUDINARY_CLOUD_NAME),
            cloudName: env.CLOUDINARY_CLOUD_NAME || env.VITE_CLOUDINARY_CLOUD_NAME || null
          },
          firebase: {
            configured: Boolean(env.FIREBASE_PROJECT_ID),
            projectId: env.FIREBASE_PROJECT_ID || null
          }
        }
      },
      200,
      {
        ...cors,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0"
      }
    );
  }
  if (pathname === "/api/auth/kingschat/callback") return handleKingsChatCallback(request, env);
  if (request.method === "GET" && pathname === "/api/auth/kingschat/state") return handleKingsChatState(request, env);
  if (request.method === "POST" && pathname === "/api/auth/kingschat/redeem") return handleKingsChatRedeem(request, env);
  if (pathname.startsWith("/auth/") && AUTH_ROUTES[pathname]) {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);
    if (origin && !isOriginAllowed) return json({ error: "Origin not allowed." }, 403, cors);
    try {
      const caller = await verifyFirebaseToken(request.headers.get("Authorization"), env.FIREBASE_PROJECT_ID);
      const body = await request.json().catch(() => ({}));
      return json(await AUTH_ROUTES[pathname](env, caller, body), 200, { ...cors, "Cache-Control": "no-store" });
    } catch (e) {
      if (e instanceof AuthError) return json({ error: e.message, code: e.code }, e.status, { ...cors, "Cache-Control": "no-store" });
      throw e;
    }
  }
  if (pathname.startsWith("/api/ai/")) {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);
    if (origin && !isOriginAllowed) return json({ error: "Origin not allowed." }, 403, cors);
    const authorization = request.headers.get("Authorization") || "";
    try {
      const caller = await verifyFirebaseToken(authorization, env.FIREBASE_PROJECT_ID);
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ error: "A valid JSON object is required." }, 400, { ...cors, "Cache-Control": "no-store" });
      }
      let result;
      if (pathname === "/api/ai/search") {
        return json({ error: "Web search is no longer available." }, 410, { ...cors, "Cache-Control": "no-store" });
      } else if (pathname === "/api/ai/semantic-search") {
        await enforceAiRateLimit(env, caller.uid, "semantic-search", 25);
        result = await semanticSearch(env, authorization, body.query, body.limit);
      } else if (pathname === "/api/ai/clip-search") {
        result = await searchClips(env, authorization, caller.uid, body.query, body.limit);
      } else if (pathname === "/api/ai/assistant") {
        result = { ...await runAssistant(env, authorization, caller.uid, body.messages) };
      } else if (pathname === "/api/ai/embed-query") {
        await enforceAiRateLimit(env, caller.uid, "embed-query", 30);
        if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 1e3) {
          return json({ error: "A query between 1 and 1,000 characters is required." }, 400, { ...cors, "Cache-Control": "no-store" });
        }
        const embedded = await createEmbeddings(env, [body.text]);
        result = { embedding: embedded.embeddings[0], dimensions: embedded.dimensions, model: embedded.model };
      } else if (pathname === "/api/ai/index-content") {
        if (!await verifyAdmin(authorization, env)) return json({ error: "Admins only." }, 403, { ...cors, "Cache-Control": "no-store" });
        await enforceAiRateLimit(env, caller.uid, "index-content", 120);
        const embedded = await createEmbeddings(env, body.texts);
        result = { embeddings: embedded.embeddings, dimensions: embedded.dimensions, model: embedded.model };
      } else {
        return json({ error: "Unknown AI endpoint." }, 404, { ...cors, "Cache-Control": "no-store" });
      }
      return json(result, 200, { ...cors, "Cache-Control": "no-store" });
    } catch (e) {
      if (e instanceof AuthError) return json({ error: e.message, code: e.code }, e.status, { ...cors, "Cache-Control": "no-store" });
      if (e instanceof AIEndpointError) return json({ error: e.message, code: e.code }, e.status, { ...cors, "Cache-Control": "no-store" });
      console.error("[ai] request failed", e?.stack || e);
      return json({ error: "AI service temporarily unavailable." }, 502, { ...cors, "Cache-Control": "no-store" });
    }
  }
  if (request.method === "GET" && pathname === "/api/notifications/vapid-key") {
    return json({ publicKey: env.VAPID_PUBLIC_KEY || null }, 200, { ...cors, "Cache-Control": "public, max-age=3600" });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);
  if (!isOriginAllowed) return json({ error: "Origin not allowed." }, 403, cors);
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Sign in required." }, 401, cors);
  if (pathname === "/upload/bunny" || pathname === "/api/media/upload") {
    const isAdmin = await verifyAdmin(auth, env);
    if (!isAdmin) return json({ error: "Admins only." }, 403, cors);
    if (!env.BUNNY_STORAGE_ACCESS_KEY || !env.BUNNY_STORAGE_ZONE_NAME) {
      return json(
        {
          error: "Bunny Storage is not configured on the server. Set BUNNY_STORAGE_ZONE_NAME and BUNNY_STORAGE_ACCESS_KEY in worker secrets."
        },
        503,
        cors
      );
    }
    let fileBody;
    let rawName = "";
    let folder = "audio";
    let contentType = "application/octet-stream";
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") {
        return json({ error: "No valid file found in multipart upload." }, 400, cors);
      }
      rawName = file.name || `upload-${Date.now()}`;
      contentType = file.type || "application/octet-stream";
      const formFolder = formData.get("folder");
      if (typeof formFolder === "string" && formFolder.trim()) {
        folder = formFolder.trim().replace(/[^a-zA-Z0-9_-]/g, "");
      }
      fileBody = await file.arrayBuffer();
    } else {
      rawName = request.headers.get("x-file-name") || `upload-${Date.now()}`;
      const headerFolder = request.headers.get("x-folder");
      if (headerFolder) {
        folder = headerFolder.replace(/[^a-zA-Z0-9_-]/g, "");
      }
      contentType = ct || "application/octet-stream";
      fileBody = await request.arrayBuffer();
    }
    if (!fileBody || fileBody.byteLength === 0) {
      return json({ error: "Uploaded file is empty." }, 400, cors);
    }
    const safeName = rawName.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
    const cleanFilename = `${Date.now()}-${safeName}`;
    const storageEndpoint = env.BUNNY_STORAGE_ENDPOINT || "storage.bunnycdn.com";
    const zoneName = env.BUNNY_STORAGE_ZONE_NAME;
    const cdnHost = env.BUNNY_CDN_HOSTNAME || `${zoneName}.b-cdn.net`;
    const uploadUrl = `https://${storageEndpoint}/${zoneName}/${folder}/${cleanFilename}`;
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        AccessKey: env.BUNNY_STORAGE_ACCESS_KEY,
        "Content-Type": contentType
      },
      body: fileBody
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => "");
      return json({ error: `Bunny Storage upload error (${uploadRes.status}): ${errText}` }, 502, cors);
    }
    const cdnUrl = `https://${cdnHost}/${folder}/${cleanFilename}`;
    return json(
      {
        ok: true,
        url: cdnUrl,
        provider: "bunny",
        filename: cleanFilename,
        folder,
        path: `${folder}/${cleanFilename}`,
        size: fileBody.byteLength,
        contentType
      },
      200,
      cors
    );
  }
  if (pathname === "/api/media/verify") {
    const isAdmin = await verifyAdmin(auth, env);
    if (!isAdmin) return json({ error: "Admins only." }, 403, cors);
    let bodyJson;
    try {
      bodyJson = await request.json();
    } catch {
      return json({ error: "Invalid JSON request." }, 400, cors);
    }
    const targetUrl = bodyJson?.url;
    if (!targetUrl || typeof targetUrl !== "string" || !targetUrl.startsWith("http")) {
      return json({ error: "Valid HTTP/HTTPS target URL is required." }, 400, cors);
    }
    try {
      const headRes = await fetch(targetUrl, { method: "HEAD" });
      return json(
        {
          verified: headRes.ok,
          status: headRes.status,
          contentType: headRes.headers.get("content-type") || null,
          contentLength: headRes.headers.get("content-length") || null
        },
        200,
        cors
      );
    } catch (e) {
      return json({ verified: false, error: e?.message || "Verification request failed" }, 200, cors);
    }
  }
  const noStore = { ...cors, "Cache-Control": "no-store" };
  if (!await verifyAdmin(auth, env)) return json({ error: "Admins only." }, 403, noStore);
  if (!engineConfigured(env)) {
    return json({ error: "The notification engine is not configured on the server (FIREBASE_SERVICE_ACCOUNT is missing)." }, 503, noStore);
  }
  if (pathname === "/api/notifications/dispatch") {
    const report2 = await runEngine(env);
    return json({ ok: true, report: report2 }, 200, noStore);
  }
  let req;
  try {
    req = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400, noStore);
  }
  let ev;
  try {
    ev = parseEvent(req);
  } catch (e) {
    if (e instanceof NotifyInputError) return json({ error: e.message }, 400, noStore);
    throw e;
  }
  const { campaignId, created, report } = await publishEvent(env, ev);
  console.log(`[notify] event type=${ev.type} campaign=${campaignId} created=${created} queued=${report.queued} sent=${report.sent}`);
  return json({ ok: true, engine: true, campaignId, created, duplicate: !created, queued: report.queued, sent: report.sent, inApp: report.inApp, failed: report.failed }, 200, noStore);
}
__name(handle, "handle");
export {
  WORKER_VERSION,
  corsHeaders,
  index_default as default,
  isAllowedOrigin,
  parseAllowedOrigins
};
//# sourceMappingURL=index.js.map
