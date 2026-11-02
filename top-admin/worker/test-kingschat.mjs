import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign, verify } from 'node:crypto';
import {
  handleKingsChatCallback,
  handleKingsChatRedeem,
  handleKingsChatState,
  makeLoginState,
  siteRedirect,
  KINGSCHAT_CLIENT_ID,
} from './src/kingschat.js';
import { resetCertCache } from './src/kingschatVerify.js';

const SITE = 'https://testimoniesofpraiseapp.com';
const CALLBACK = 'https://top-push-relay.gtrusouth116.workers.dev/api/auth/kingschat/callback';
const PEPPER = 'test-pepper';
const NOW = Date.parse('2026-11-03T12:00:00Z');

// KingsChat signs access tokens with this key; its public half is served from /oauth2/certs.
const kc = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KC_KID = 'kc-test-kid';
const kcPem = kc.publicKey.export({ type: 'spki', format: 'pem' });

// The Firebase service account signs custom tokens with this key.
const fb = generateKeyPairSync('rsa', { modulusLength: 2048 });
const serviceAccount = JSON.stringify({
  client_email: 'firebase-adminsdk-test@testimoniesofpraiseapp.iam.gserviceaccount.com',
  private_key: fb.privateKey.export({ type: 'pkcs8', format: 'pem' }),
});

const b64url = (input) => Buffer.from(input).toString('base64url');

function kingsChatToken(claims, { kid = KC_KID, key = kc.privateKey } = {}) {
  const header = b64url(JSON.stringify({ alg: 'RS256', kid }));
  const payload = b64url(JSON.stringify(claims));
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), key).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

function makeKv() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

// Stands in for KingsChat: the certificate list, the token endpoint, and a fail-safe for anything else.
function kingsChatFetch({ accessToken, failExchange = false, failProfile = false } = {}) {
  return async (url, init = {}) => {
    if (url === 'https://connect.kingsch.at/developer/api/user/profile') {
      assert.equal(init.headers['api-key'], 'test-api-key');
      assert.match(init.headers.Authorization, /^Bearer /);
      if (failProfile) return { ok: false, status: 403, json: async () => ({ error: 'user_not_authorized' }) };
      return { ok: true, json: async () => ({ profile: { id: 'kc-user-42', name: 'Jane Doe', email: 'jane@example.com' } }) };
    }
    if (url === 'https://connect.kingsch.at/oauth2/certs') {
      return { ok: true, json: async () => ({ certificates: [{ kid: KC_KID, pem_certificate: kcPem }] }) };
    }
    if (url === 'https://connect.kingsch.at/developer/api/oauth2/token') {
      const body = JSON.parse(init.body);
      assert.equal(body.grant_type, 'code');
      assert.equal(body.client_id, KINGSCHAT_CLIENT_ID);
      if (failExchange) return { ok: false, status: 400, json: async () => ({}) };
      return { ok: true, json: async () => ({ access_token: accessToken, refresh_token: 'r', expires_in_millis: 3600000 }) };
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

const goodClaims = (now = NOW) => ({ iss: 'kingschat', acid: KINGSCHAT_CLIENT_ID, sub: 'kc-user-42', exp: now + 60_000 });

function env(extra = {}) {
  return {
    OTP_PEPPER: PEPPER,
    OTP_KV: makeKv(),
    FIREBASE_SERVICE_ACCOUNT: serviceAccount,
    KINGSCHAT_API_KEY: 'test-api-key',
    ALLOWED_ORIGINS: `${SITE}, http://localhost:5173`,
    SITE_URL: SITE,
    ...extra,
  };
}

function callbackRequest(fields) {
  return new Request(CALLBACK, { method: 'POST', body: new URLSearchParams(fields) });
}

const location = (res) => res.headers.get('Location');

// GET is refused.
resetCertCache();
let res = await handleKingsChatCallback(new Request(CALLBACK), env(), { now: NOW });
assert.match(location(res), /kingschat=invalid$/);

// No check value: refused, and the code is never exchanged.
resetCertCache();
res = await handleKingsChatCallback(callbackRequest({ code: 'GOOD-CODE' }), env(), { now: NOW, fetchFn: kingsChatFetch() });
assert.match(location(res), /kingschat=invalid$/);

// Missing code with a valid check value.
resetCertCache();
const goodState = await makeLoginState(PEPPER, NOW);
res = await handleKingsChatCallback(callbackRequest({ origin: goodState }), env(), { now: NOW });
assert.match(location(res), /kingschat=missing$/);

// Full success: code exchanged, token verified, handoff created, and the browser sent back with the handoff ID only.
resetCertCache();
const kvOk = env();
res = await handleKingsChatCallback(
  callbackRequest({ code: 'GOOD-CODE', origin: goodState }),
  kvOk,
  { now: NOW, fetchFn: kingsChatFetch({ accessToken: kingsChatToken(goodClaims()) }) },
);
const handoffMatch = location(res).match(/^https:\/\/testimoniesofpraiseapp\.com\/#\/signin\?kingschat=ok&handoff=([a-f0-9]{32})$/);
assert.ok(handoffMatch, `unexpected redirect: ${location(res)}`);
assert.ok(!location(res).includes('GOOD-CODE'), 'the code must not appear in the redirect');
const handoffId = handoffMatch[1];

// The custom token is signed by the service account and is for the KingsChat-derived uid.
const storedRecord = JSON.parse(kvOk.OTP_KV.store.get(`kc_handoff:${handoffId}`));
const stored = storedRecord.token;
assert.equal(storedRecord.name, 'Jane Doe');
assert.ok(stored, 'handoff should be stored');
const [h, p, s] = stored.split('.');
assert.equal(JSON.parse(Buffer.from(p, 'base64url').toString()).uid, 'kc_kc-user-42');
assert.equal(
  verify('sha256', Buffer.from(`${h}.${p}`), fb.publicKey, Buffer.from(s, 'base64url')),
  true,
  'custom token must verify with the service account key',
);

// Redeeming returns the token once; the second attempt finds nothing.
const redeemReq = (handoff) =>
  new Request('https://top-push-relay.gtrusouth116.workers.dev/api/auth/kingschat/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE },
    body: JSON.stringify({ handoff }),
  });
res = await handleKingsChatRedeem(redeemReq(handoffId), kvOk);
assert.equal(res.status, 200);
const redeemed = await res.json();
assert.equal(redeemed.token, stored);
assert.equal(redeemed.name, 'Jane Doe');
assert.equal(res.headers.get('Access-Control-Allow-Origin'), SITE);
res = await handleKingsChatRedeem(redeemReq(handoffId), kvOk);
assert.equal(res.status, 404);

// Redeem refuses malformed IDs.
res = await handleKingsChatRedeem(redeemReq('../../etc'), env());
assert.equal(res.status, 400);

// A failed profile lookup does not block sign-in: the handoff is still made, without a name.
resetCertCache();
const noNameState = await makeLoginState(PEPPER, NOW);
const kvNoName = env();
res = await handleKingsChatCallback(
  callbackRequest({ code: 'GOOD-CODE', origin: noNameState }),
  kvNoName,
  { now: NOW, fetchFn: kingsChatFetch({ accessToken: kingsChatToken(goodClaims()), failProfile: true }) },
);
const noNameId = location(res).match(/handoff=([a-f0-9]{32})$/)?.[1];
assert.ok(noNameId, `expected a handoff: ${location(res)}`);
res = await handleKingsChatRedeem(redeemReq(noNameId), kvNoName);
const noName = await res.json();
assert.ok(noName.token);
assert.equal(noName.name, null);

// A check value from more than ten minutes ago is refused.
resetCertCache();
res = await handleKingsChatCallback(
  callbackRequest({ code: 'GOOD-CODE', origin: goodState }),
  env(),
  { now: NOW + 11 * 60 * 1000, fetchFn: kingsChatFetch({ accessToken: kingsChatToken(goodClaims()) }) },
);
assert.match(location(res), /kingschat=invalid$/);

// A check value with a changed timestamp is refused.
resetCertCache();
const [, nonce, target, sig] = goodState.split('.');
const forgedState = `${NOW + 1000}.${nonce}.${target}.${sig}`;
res = await handleKingsChatCallback(callbackRequest({ code: 'GOOD-CODE', origin: forgedState }), env(), { now: NOW, fetchFn: kingsChatFetch({ accessToken: kingsChatToken(goodClaims()) }) });
assert.match(location(res), /kingschat=invalid$/);

// KingsChat refuses the code.
resetCertCache();
res = await handleKingsChatCallback(callbackRequest({ code: 'BAD-CODE', origin: goodState }), env(), { now: NOW, fetchFn: kingsChatFetch({ failExchange: true }) });
assert.match(location(res), /kingschat=failed$/);

// A token issued for another application is refused.
resetCertCache();
res = await handleKingsChatCallback(
  callbackRequest({ code: 'OTHER-APP', origin: goodState }),
  env(),
  { now: NOW, fetchFn: kingsChatFetch({ accessToken: kingsChatToken({ ...goodClaims(), acid: 'someone-else' }) }) },
);
assert.match(location(res), /kingschat=failed$/);

// Missing server secrets: reported as unavailable, nothing is exchanged.
resetCertCache();
res = await handleKingsChatCallback(callbackRequest({ code: 'GOOD-CODE', origin: goodState }), env({ FIREBASE_SERVICE_ACCOUNT: undefined }), { now: NOW });
assert.match(location(res), /kingschat=unavailable$/);

// The state endpoint returns a fresh check value, and CORS only for allowed origins.
const stateRes = await handleKingsChatState(new Request('https://x.test/api/auth/kingschat/state', { headers: { Origin: SITE } }), env(), { now: NOW });
const { state } = await stateRes.json();
assert.equal(await checkValid(state), 'web');
assert.equal(stateRes.headers.get('Access-Control-Allow-Origin'), SITE);
const stateOther = await handleKingsChatState(new Request('https://x.test/api/auth/kingschat/state', { headers: { Origin: 'https://evil.example' } }), env(), { now: NOW });
assert.equal(stateOther.headers.get('Access-Control-Allow-Origin'), null);

async function checkValid(value) {
  const { checkLoginState } = await import('./src/kingschat.js');
  return checkLoginState(value, PEPPER, NOW);
}

// The app: a check value made for the app sends the person back to the app's own link.
resetCertCache();
const appState = await makeLoginState(PEPPER, NOW, 'app');
const kvApp = env();
res = await handleKingsChatCallback(
  callbackRequest({ code: 'GOOD-CODE', origin: appState }),
  kvApp,
  { now: NOW, fetchFn: kingsChatFetch({ accessToken: kingsChatToken(goodClaims()) }) },
);
assert.match(location(res), /^testimoniesofpraise:\/\/kingschat\?kingschat=ok&handoff=[a-f0-9]{32}$/);

// A check value with a target we did not issue is refused.
resetCertCache();
const badTarget = `${NOW}.${randomUUID().replace(/-/g, '')}.other.${'a'.repeat(64)}`;
res = await handleKingsChatCallback(callbackRequest({ code: 'GOOD-CODE', origin: badTarget }), env(), { now: NOW, fetchFn: kingsChatFetch() });
assert.match(location(res), /kingschat=invalid$/);

// Redirects only go to the site's own address.
assert.equal(siteRedirect('x', SITE), `${SITE}/#/signin?kingschat=x`);
assert.equal(siteRedirect('ok', `${SITE}/`, 'abc'), `${SITE}/#/signin?kingschat=ok&handoff=abc`);

console.log('kingschat sign-in tests passed');
