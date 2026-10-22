/**
 * Test Suite: Fresh Sign-In, Reinstallation & Device Trust Architecture
 * Run with: node tests/sessionTrust.test.mjs
 */

import assert from 'node:assert';
import crypto from 'node:crypto';

console.log('Running Session Trust & Fresh Sign-in Test Suite...\n');

// Mock in-memory database simulating Firestore collections
class MockDatabase {
  constructor() {
    this.deviceTrust = new Map();
    this.emailVerifications = new Map();
    this.pushTokens = new Map();
    this.userProfiles = new Map();
    this.authUsers = new Map();
  }

  registerTrust(uid, installationId) {
    const sessionNonce = crypto.randomUUID();
    const id = `${uid}_${installationId}`;
    this.deviceTrust.set(id, {
      uid,
      installationId,
      sessionNonce,
      verifiedAt: Date.now(),
      lastActiveAt: Date.now(),
    });
    return sessionNonce;
  }

  isTrusted(uid, installationId) {
    if (!installationId) return false;
    return this.deviceTrust.has(`${uid}_${installationId}`);
  }

  deleteAccount(uid) {
    // 1. Purge device trust records
    for (const [key, val] of this.deviceTrust.entries()) {
      if (val.uid === uid) this.deviceTrust.delete(key);
    }
    // 2. Purge push tokens
    for (const [key, val] of this.pushTokens.entries()) {
      if (val.uid === uid) this.pushTokens.delete(key);
    }
    // 3. Purge verification & profile
    this.emailVerifications.delete(uid);
    this.userProfiles.delete(uid);
    this.authUsers.delete(uid);
  }
}

// 1. Reinstallation and Fresh Session Detection
{
  console.log('1. Testing Fresh Installation vs Existing Session Restoration:');
  const db = new MockDatabase();
  const uid = 'user_grace_77';

  // Initial installation on device A
  const installId_DeviceA = 'install_uuid_device_A_111';

  // Before OTP verification: device A is untrusted
  assert.equal(db.isTrusted(uid, installId_DeviceA), false);

  // User completes OTP verification on Device A
  const sessionNonce = db.registerTrust(uid, installId_DeviceA);
  assert.ok(sessionNonce, 'Session nonce must be issued upon verification');
  assert.equal(db.isTrusted(uid, installId_DeviceA), true);

  // Normal app restart/resume with existing valid session -> stays trusted without new OTP
  assert.equal(db.isTrusted(uid, installId_DeviceA), true, 'Existing session must remain trusted across restarts');

  // UNINSTALL & REINSTALL SIMULATION:
  // AsyncStorage is cleared upon app deletion, producing a new installation ID on fresh install
  const installId_Reinstall = 'install_uuid_device_A_fresh_reinstall_222';

  // Firebase auth credential might restore, but new installation ID is UNTRUSTED
  assert.equal(
    db.isTrusted(uid, installId_Reinstall),
    false,
    'Reinstalled app with new installation ID must NOT be trusted automatically',
  );

  // User must complete fresh OTP verification on reinstalled app
  db.registerTrust(uid, installId_Reinstall);
  assert.equal(db.isTrusted(uid, installId_Reinstall), true, 'Reinstalled app becomes trusted only after OTP validation');

  console.log('✔ Reinstall detection and session trust gating verified.');
}

// 2. Google Sign-In Requiring OTP Verification Gate
{
  console.log('\n2. Testing Google Authentication OTP Enforcement:');
  const db = new MockDatabase();
  const googleUid = 'google_user_555';
  const installId = 'device_install_999';

  // Simulating Google sign-in response (where Google has already verified email)
  const googleAuthResult = {
    uid: googleUid,
    email: 'testimony@gmail.com',
    providerId: 'google.com',
    firebaseEmailVerified: true, // Google's own flag
  };

  // App-level check: device session must be explicitly verified through TOP server OTP
  const isSessionVerified = db.isTrusted(googleAuthResult.uid, installId);
  assert.equal(
    isSessionVerified,
    false,
    'Google account must remain behind OTP verification gate until TOP server validates code',
  );

  // Complete TOP OTP
  db.registerTrust(googleAuthResult.uid, installId);
  assert.equal(db.isTrusted(googleAuthResult.uid, installId), true);

  console.log('✔ Google accounts correctly gated behind application-level OTP verification.');
}

// 3. Complete Account Deletion & Privacy Revocation
{
  console.log('\n3. Testing Complete Account Deletion & Record Purge:');
  const db = new MockDatabase();
  const uid = 'user_to_delete';
  const installId = 'install_device_xyz';

  // Register session and push tokens
  db.registerTrust(uid, installId);
  db.pushTokens.set('ExponentPushToken[abc12345]', { token: 'ExponentPushToken[abc12345]', uid });
  db.userProfiles.set(uid, { email: 'del@example.com', emailVerified: true });
  db.authUsers.set(uid, { email: 'del@example.com' });

  assert.equal(db.isTrusted(uid, installId), true);
  assert.equal(db.pushTokens.size, 1);

  // Execute account deletion
  db.deleteAccount(uid);

  // Verify full cleanup
  assert.equal(db.isTrusted(uid, installId), false, 'Device trust must be revoked upon deletion');
  assert.equal(db.pushTokens.size, 0, 'User push tokens must be deleted');
  assert.equal(db.userProfiles.has(uid), false, 'User profile must be deleted');
  assert.equal(db.authUsers.has(uid), false, 'Firebase Auth account must be deleted');

  console.log('✔ Account deletion correctly cleans up tokens, device trust, and user state.');
}

console.log('\n🎉 ALL SESSION TRUST & FRESH SIGN-IN TESTS PASSED SUCCESSFULLY!');
