// Offline tests for the email-verification routes. Run: node test-auth.mjs
import assert from 'node:assert';
import worker from './src/index.js';

const PROJECT = 'demo-project';
const b64url = (buf) => Buffer.from(buf).toString('base64url');

// A real RSA key pair stands in for Google's token-signing key.
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify'],
);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };

async function token(claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: 'user1', email: 'Grace@Example.com', iat: now - 10, exp: now + 3600, ...claims }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}

// In-memory KV with the subset of the Workers KV API we use.
function makeKV() {
  const m = new Map();
  return {
    m,
    async get(k, type) { const v = m.get(k); return v === undefined ? null : type === 'json' ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  };
}

const sent = [];
let emailFails = false;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.includes('securetoken@system.gserviceaccount.com')) return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'cache-control': 'max-age=3600' } });
  if (url === 'https://api.resend.com/emails') {
    if (emailFails) return new Response('down', { status: 500 });
    sent.push(JSON.parse(init.body));
    return new Response('{"id":"x"}', { status: 200 });
  }
  throw new Error('unexpected fetch ' + url);
};

const kv = makeKV();
const env = { FIREBASE_PROJECT_ID: PROJECT, ALLOWED_ORIGINS: 'https://top-admin.onrender.com', OTP_KV: kv, OTP_PEPPER: 'test-pepper', RESEND_API_KEY: 'k' };
const call = async (path, body = {}, { auth, origin, e = env } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (auth !== null) headers.Authorization = `Bearer ${auth ?? (await token())}`;
  if (origin) headers.Origin = origin;
  const res = await worker.fetch(new Request(`https://relay${path}`, { method: 'POST', headers, body: JSON.stringify(body) }), e);
  return { status: res.status, body: await res.json() };
};
const lastCode = () => sent.at(-1).text.match(/\b(\d{6})\b/)[1];
const reset = () => {
  kv.m.clear();
  sent.length = 0;
};

// 1. not signed in / bad tokens
assert.equal((await call('/auth/otp/send', {}, { auth: null })).status, 401);
assert.equal((await call('/auth/otp/send', {}, { auth: 'nope' })).status, 401);
assert.equal((await call('/auth/otp/send', {}, { auth: await token({ aud: 'other-project' }) })).status, 401);
assert.equal((await call('/auth/otp/send', {}, { auth: await token({ exp: 1 }) })).status, 401);
const forged = (await token()).slice(0, -6) + 'AAAAAA';
assert.equal((await call('/auth/otp/send', {}, { auth: forged })).status, 401, 'tampered signature rejected');

// 2. send: code goes to the token's email (lowercased), masked in the reply, only a hash is stored
let r = await call('/auth/otp/send', { email: 'attacker@evil.example' });
assert.equal(r.status, 200);
assert.deepEqual(sent.at(-1).to, ['grace@example.com'], 'never sends to a client-supplied address');
assert.equal(r.body.maskedEmail, 'gr***@example.com');
assert.equal(r.body.cooldownSeconds, 60);
assert.ok(!kv.m.get('otp:user1').includes(lastCode()), 'plain code never stored');

// 3. cooldown
r = await call('/auth/otp/send');
assert.equal(r.status, 429);
assert.match(r.body.error, /wait \d+s/);

// 4. wrong code -> attempts countdown; right code -> trusted device
r = await call('/auth/otp/verify', { code: '000000', installationId: 'inst-1' });
assert.equal(r.status, 400);
assert.match(r.body.error, /4 attempts remaining/);
r = await call('/auth/otp/verify', { code: 'abc' });
assert.equal(r.status, 400);
assert.deepEqual((await call('/auth/session/trust', { installationId: 'inst-1' })).body, { trusted: false, emailVerified: false });
r = await call('/auth/otp/verify', { code: lastCode(), installationId: 'inst-1' });
assert.equal(r.status, 200);
assert.equal(r.body.emailVerified, true);
assert.deepEqual((await call('/auth/session/trust', { installationId: 'inst-1' })).body, { trusted: true, emailVerified: true });
assert.deepEqual((await call('/auth/session/trust', { installationId: 'other-phone' })).body, { trusted: false, emailVerified: false });

// 5. single use
r = await call('/auth/otp/verify', { code: lastCode(), installationId: 'inst-1' });
assert.equal(r.status, 404);

// 6. lockout after 5 wrong attempts
reset();
await call('/auth/otp/send');
for (let i = 0; i < 4; i++) assert.equal((await call('/auth/otp/verify', { code: '000000' })).status, 400);
assert.equal((await call('/auth/otp/verify', { code: '000000' })).status, 429);
assert.equal((await call('/auth/otp/verify', { code: lastCode() })).status, 404, 'locked code cannot be used even if correct');

// 7. expiry
reset();
await call('/auth/otp/send');
const rec = JSON.parse(kv.m.get('otp:user1'));
kv.m.set('otp:user1', JSON.stringify({ ...rec, expiresAt: Date.now() - 1 }));
assert.equal((await call('/auth/otp/verify', { code: lastCode() })).status, 410);

// 8. hourly limit (5 per hour)
reset();
for (let i = 0; i < 5; i++) {
  const cur = kv.m.get('otp:user1');
  if (cur) kv.m.set('otp:user1', JSON.stringify({ ...JSON.parse(cur), lastSentAt: 0 })); // skip cooldown
  assert.equal((await call('/auth/otp/send')).status, 200);
}
kv.m.set('otp:user1', JSON.stringify({ ...JSON.parse(kv.m.get('otp:user1')), lastSentAt: 0 }));
r = await call('/auth/otp/send');
assert.equal(r.status, 429);
assert.match(r.body.error, /Hourly/);

// 9. delivery failure stores nothing; missing config is reported, not faked
reset();
emailFails = true;
assert.equal((await call('/auth/otp/send')).status, 503);
assert.equal(kv.m.has('otp:user1'), false);
emailFails = false;
assert.equal((await call('/auth/otp/send', {}, { e: { ...env, RESEND_API_KEY: undefined } })).status, 503);
assert.equal((await call('/auth/otp/send', {}, { e: { ...env, OTP_KV: undefined } })).status, 503);
assert.equal((await call('/auth/otp/send', {}, { e: { ...env, OTP_PEPPER: undefined } })).status, 503);

// 10. account deletion clears codes and every trusted device of that user only
reset();
await kv.put('trust:user1:a', '{}');
await kv.put('trust:user1:b', '{}');
await kv.put('trust:user2:a', '{}');
await kv.put('otp:user1', '{}');
assert.equal((await call('/auth/account/delete')).status, 200);
assert.deepEqual([...kv.m.keys()], ['trust:user2:a']);

// 11. origins: native (no Origin) ok, allowed site ok, unknown site refused; wrong method refused
assert.equal((await call('/auth/session/trust', { installationId: 'x' })).status, 200);
assert.equal((await call('/auth/session/trust', { installationId: 'x' }, { origin: 'https://top-admin.onrender.com' })).status, 200);
assert.equal((await call('/auth/session/trust', { installationId: 'x' }, { origin: 'https://evil.example' })).status, 403);
const get = await worker.fetch(new Request('https://relay/auth/otp/send'), env);
assert.equal(get.status, 405);

console.log('auth tests passed');
