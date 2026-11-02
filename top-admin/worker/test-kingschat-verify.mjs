import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyKingsChatToken, resetCertCache } from './src/kingschatVerify.js';

const CLIENT_ID = 'f9f8da46-de8a-4f57-aa96-ab8fb2f83926';
const NOW = Date.parse('2026-11-03T12:00:00Z');
const KID = 'test-kid-1';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = publicKey.export({ type: 'spki', format: 'pem' });

const b64url = (input) => Buffer.from(input).toString('base64url');

function makeToken(claims, { kid = KID, key = privateKey, alg = 'RS256' } = {}) {
  const header = b64url(JSON.stringify({ alg, kid }));
  const payload = b64url(JSON.stringify(claims));
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), key).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

const goodClaims = { iss: 'kingschat', acid: CLIENT_ID, sub: 'kc-user-42', exp: NOW + 60_000 };

// Stands in for GET https://connect.kingsch.at/oauth2/certs
function certsFetch(certificates = [{ kid: KID, pem_certificate: pem }]) {
  return async () => ({ ok: true, json: async () => ({ certificates }) });
}

async function expectReject(promise, message) {
  await assert.rejects(promise, (err) => {
    assert.match(err.message, message);
    return true;
  });
}

// Valid token: resolves with the KingsChat user ID.
resetCertCache();
let sub = await verifyKingsChatToken(makeToken(goodClaims), { clientId: CLIENT_ID, fetchFn: certsFetch(), now: NOW });
assert.equal(sub, 'kc-user-42');

// The certificate list is cached: a second token does not fetch again.
let fetches = 0;
const countingFetch = async (...args) => {
  fetches += 1;
  return certsFetch()(...args);
};
sub = await verifyKingsChatToken(makeToken(goodClaims), { clientId: CLIENT_ID, fetchFn: countingFetch, now: NOW });
assert.equal(sub, 'kc-user-42');
assert.equal(fetches, 0, 'cached certificates should not be fetched again');

// Token for another application is rejected.
resetCertCache();
await expectReject(
  verifyKingsChatToken(makeToken({ ...goodClaims, acid: 'someone-else' }), { clientId: CLIENT_ID, fetchFn: certsFetch(), now: NOW }),
  /another application/,
);

// Expired token (exp in milliseconds) is rejected.
resetCertCache();
await expectReject(
  verifyKingsChatToken(makeToken({ ...goodClaims, exp: NOW - 1 }), { clientId: CLIENT_ID, fetchFn: certsFetch(), now: NOW }),
  /expired/,
);

// Wrong issuer is rejected.
resetCertCache();
await expectReject(
  verifyKingsChatToken(makeToken({ ...goodClaims, iss: 'someone' }), { clientId: CLIENT_ID, fetchFn: certsFetch(), now: NOW }),
  /issuer/,
);

// A payload changed after signing fails the signature check.
resetCertCache();
const real = makeToken(goodClaims);
const [h, , s] = real.split('.');
const forged = `${h}.${b64url(JSON.stringify({ ...goodClaims, sub: 'someone-else' }))}.${s}`;
await expectReject(
  verifyKingsChatToken(forged, { clientId: CLIENT_ID, fetchFn: certsFetch(), now: NOW }),
  /signature/,
);

// A token signed by a key KingsChat does not publish is rejected (unknown kid).
resetCertCache();
await expectReject(
  verifyKingsChatToken(makeToken(goodClaims, { kid: 'unknown-kid' }), { clientId: CLIENT_ID, fetchFn: certsFetch(), now: NOW }),
  /Unknown signing key/,
);

// Non-RS256 tokens are refused before any key is used.
resetCertCache();
await expectReject(
  verifyKingsChatToken(makeToken(goodClaims, { alg: 'HS256' }), { clientId: CLIENT_ID, fetchFn: certsFetch(), now: NOW }),
  /Unsupported token header/,
);

console.log('kingschat token verification tests passed');
