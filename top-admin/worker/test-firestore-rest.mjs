/**
 * Tests for the Firestore REST helpers (value encoding, preconditions, update masks) and the Google
 * service-account token used by the Worker. No network: fetch is replaced by fakes.
 *
 *   node test-firestore-rest.mjs
 */
import assert from 'node:assert/strict';
import { encodeValue, decodeValue, FirestoreRest } from './src/firestoreRest.js';
import { signAssertion, getGoogleAccessToken, clearGoogleTokenCache, GOOGLE_TOKEN_URL } from './src/googleAuth.js';
import { base64UrlFromBytes } from './src/firebaseCustomToken.js';

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};


const NOW = Date.UTC(2026, 10, 18, 12, 0);

// ---------------- Firestore REST encoding and service auth ----------------
await test('Firestore values round-trip through the REST encoding', async () => {
  const when = new Date(NOW);
  const data = { s: 'x', n: 5, f: 1.5, b: true, z: null, d: when, arr: ['a', 2], map: { k: false } };
  const back = decodeValue({ mapValue: { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encodeValue(v)])) } });
  assert.deepEqual(back, data);
});

await test('a create with a precondition returns false when the document exists', async () => {
  const replies = [new Response('{"error":{"status":"FAILED_PRECONDITION"}}', { status: 400 })];
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('oauth2')) return Response.json({ access_token: 'tok', expires_in: 3600 });
    return replies.shift();
  };
  const sa = await makeServiceAccount();
  clearGoogleTokenCache();
  const rest = new FirestoreRest({ serviceAccount: sa, projectId: 'demo-top', fetchFn });
  assert.equal(await rest.create('notification_queue/k1', { status: 'pending' }), false);
  const commit = calls.find((c) => c.url.endsWith(':commit'));
  const body = JSON.parse(commit.init.body);
  assert.deepEqual(body.writes[0].currentDocument, { exists: false }, 'precondition sent');
  assert.equal(commit.init.headers.Authorization, 'Bearer tok');
});

await test('an update sends an update mask and requires the document to exist', async () => {
  let body;
  const fetchFn = async (url, init) => {
    if (url.includes('oauth2')) return Response.json({ access_token: 'tok2', expires_in: 3600 });
    body = JSON.parse(init.body);
    return Response.json({});
  };
  const rest = new FirestoreRest({ serviceAccount: await makeServiceAccount(), projectId: 'demo-top', fetchFn, tokenFn: async () => 'tok2' });
  await rest.update('notification_queue/k2', { status: 'sent' });
  assert.deepEqual(body.writes[0].updateMask, { fieldPaths: ['status'] });
  assert.deepEqual(body.writes[0].currentDocument, { exists: true });
  assert.ok(body.writes[0].update.name.endsWith('/documents/notification_queue/k2'));
});

await test('the service-account assertion is a valid RS256 JWT for the Google token endpoint', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pem = await pemFromKey(pair.privateKey);
  const sa = JSON.stringify({ client_email: 'engine@demo-top.iam.gserviceaccount.com', private_key: pem });
  const jwt = await signAssertion(sa, 'https://www.googleapis.com/auth/datastore', NOW);
  const [h, p, s] = jwt.split('.');
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  assert.equal(claims.iss, 'engine@demo-top.iam.gserviceaccount.com');
  assert.equal(claims.aud, GOOGLE_TOKEN_URL);
  assert.equal(claims.exp - claims.iat, 3600);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, Buffer.from(s, 'base64url'), new TextEncoder().encode(`${h}.${p}`));
  assert.equal(ok, true, 'signature verifies');
});

await test('Google access tokens are cached until shortly before they expire', async () => {
  clearGoogleTokenCache();
  let exchanges = 0;
  const fetchFn = async () => {
    exchanges += 1;
    return Response.json({ access_token: `t${exchanges}`, expires_in: 3600 });
  };
  const sa = await makeServiceAccount();
  assert.equal(await getGoogleAccessToken(sa, 'scope-x', { fetchFn, now: NOW }), 't1');
  assert.equal(await getGoogleAccessToken(sa, 'scope-x', { fetchFn, now: NOW + 60 * 1000 }), 't1');
  assert.equal(await getGoogleAccessToken(sa, 'scope-x', { fetchFn, now: NOW + 3600 * 1000 }), 't2');
  assert.equal(exchanges, 2);
});

async function makeServiceAccount() {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  return JSON.stringify({ client_email: 'engine@demo-top.iam.gserviceaccount.com', private_key: await pemFromKey(pair.privateKey) });
}
async function pemFromKey(privateKey) {
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey));
  const b64 = Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n');
  return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`;
}

console.log(`\nfirestore REST and service auth: ${passed} tests passed`);
