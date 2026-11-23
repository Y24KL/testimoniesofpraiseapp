// Unit tests for push registration decisions (src/notifications/registrationRules.ts).
// Run: node --experimental-strip-types tests/pushRegistration.test.mjs   (npm run test:push-registration)
import assert from 'node:assert/strict';

const R = await import('../src/notifications/registrationRules.ts');

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`  ✔ ${name}`); };

const base = { status: 'undetermined', canAskAgain: true, primerSeen: true, askedForVersion: null, appVersion: '2.2.0' };

ok('asks automatically once per app version, after the first-run screen', () => {
  assert.equal(R.shouldAutoAskPermission(base), true);
  assert.equal(R.shouldAutoAskPermission({ ...base, askedForVersion: '2.2.0' }), false, 'not twice for the same version');
  assert.equal(R.shouldAutoAskPermission({ ...base, askedForVersion: '2.1.0' }), true, 'again after an update');
  assert.equal(R.shouldAutoAskPermission({ ...base, primerSeen: false }), false, 'never before the first-run screen');
});

ok('never asks when already allowed, or when Android will not show the prompt again', () => {
  assert.equal(R.shouldAutoAskPermission({ ...base, status: 'granted' }), false);
  assert.equal(R.shouldAutoAskPermission({ ...base, status: 'denied', canAskAgain: false }), false);
  assert.equal(R.shouldAutoAskPermission({ ...base, status: 'denied', canAskAgain: true }), true);
});

ok('permission state distinguishes "can still ask" from "blocked in settings"', () => {
  assert.equal(R.permissionState('undetermined', true), 'needs_permission');
  assert.equal(R.permissionState('denied', true), 'needs_permission');
  assert.equal(R.permissionState('denied', false), 'blocked');
  assert.equal(R.permissionState('granted', false), 'registering');
});

ok('unchanged registrations are written at most once a day; any change writes at once', () => {
  const sig = R.registrationSignature({ uid: 'u1', token: 'T', appVersion: '2.2.0', timeZone: 'Africa/Lagos', prefs: { live: true, testimonies: false } });
  const now = Date.UTC(2026, 10, 22, 12);
  const fresh = { ...R.EMPTY_RECORD, lastWrittenSignature: sig, lastSuccessAt: now - 3600_000 };
  assert.equal(R.shouldWrite(fresh, sig, now), false);
  assert.equal(R.shouldWrite({ ...fresh, lastSuccessAt: now - R.REFRESH_MS }, sig, now), true, 'daily refresh');
  const changed = R.registrationSignature({ uid: 'u1', token: 'T', appVersion: '2.2.0', timeZone: 'Africa/Lagos', prefs: { live: false, testimonies: false } });
  assert.notEqual(changed, sig);
  assert.equal(R.shouldWrite(fresh, changed, now), true, 'a preference change writes immediately');
  assert.equal(R.shouldWrite(R.EMPTY_RECORD, sig, now), true, 'first registration');
});

ok('signatures ignore preference order but include the account and both tokens', () => {
  const a = R.registrationSignature({ uid: 'u1', token: 'T', fcmToken: 'F', prefs: { a: true, b: false } });
  const b = R.registrationSignature({ uid: 'u1', token: 'T', fcmToken: 'F', prefs: { b: false, a: true } });
  assert.equal(a, b);
  assert.notEqual(a, R.registrationSignature({ uid: 'u2', token: 'T', fcmToken: 'F', prefs: { a: true, b: false } }));
  assert.notEqual(a, R.registrationSignature({ uid: 'u1', token: 'T', prefs: { a: true, b: false } }));
});

ok('retries back off (30 s, 2 min, 10 min) and then stop for the session', () => {
  assert.equal(R.nextRetryDelay(0), null);
  assert.equal(R.nextRetryDelay(1), 30_000);
  assert.equal(R.nextRetryDelay(2), 120_000);
  assert.equal(R.nextRetryDelay(3), 600_000);
  assert.equal(R.nextRetryDelay(4), null);
});

ok('errors become short codes; only network-type failures are retried automatically', () => {
  assert.equal(R.errorCode(new Error('Network request failed')), 'network');
  assert.equal(R.errorCode({ code: 'permission-denied', message: 'Missing or insufficient permissions.' }), 'firestore-permission-denied');
  assert.equal(R.errorCode({ code: 'missing-project-id', message: 'x' }), 'missing-project-id');
  assert.equal(R.errorCode('weird'), 'unknown');
  assert.equal(R.isRetryable('network'), true);
  assert.equal(R.isRetryable('missing-project-id'), false);
  assert.equal(R.isRetryable('firestore-permission-denied'), false);
});

ok('every state has a plain-language explanation', () => {
  for (const state of ['unsupported', 'needs_permission', 'blocked', 'registering', 'registered', 'error']) {
    assert.ok(R.explainRegistration({ ...R.EMPTY_RECORD, state, errorCode: 'network' }).length > 10, state);
  }
  assert.match(R.explainRegistration({ ...R.EMPTY_RECORD, state: 'blocked' }), /settings/);
});

console.log(`push registration rules: ${n} tests passed`);
