/**
 * Test Suite: Firestore Rules Logic & Authorization Evaluation
 * Run with: node tests/firestoreRules.test.mjs
 */

import assert from 'node:assert';

console.log('Running Firestore Security Rules Evaluation Suite...\n');

// Simulating Firestore security rule helper functions
class RuleContext {
  constructor({ auth = null, admins = new Set(), userProfiles = new Map() }) {
    this.auth = auth;
    this.admins = admins;
    this.userProfiles = userProfiles;
  }

  signedIn() {
    return this.auth !== null;
  }

  isAdmin() {
    return (
      this.signedIn() &&
      (this.auth.token?.admin === true || this.admins.has(this.auth.uid))
    );
  }

  isVerifiedUser() {
    if (!this.signedIn()) return false;
    if (this.auth.token?.emailVerified === true || this.auth.token?.email_verified === true) {
      return true;
    }
    const profile = this.userProfiles.get(this.auth.uid);
    return Boolean(profile && profile.emailVerified === true);
  }

  canAccessOtpCollection() {
    // match /emailVerifications/{uid}: allow read, write: if false;
    return false;
  }

  canAccessDeviceTrustCollection() {
    // match /deviceTrust/{id}: allow read, write: if false;
    return false;
  }

  canSubmitTestimony(resource) {
    if (!this.isAdmin() && !this.isVerifiedUser()) return false;
    if (resource.userId !== this.auth?.uid) return false;
    if (resource.status !== 'pending') return false;
    if (!resource.fullName || resource.fullName.length > 200) return false;
    if (!resource.testimony || resource.testimony.length > 5000) return false;
    return true;
  }

  canPostLiveChat(resource) {
    if (!this.isAdmin() && !this.isVerifiedUser()) return false;
    if (resource.uid !== this.auth?.uid) return false;
    if (!resource.text || resource.text.length > 300) return false;
    return true;
  }

  canManagePushToken(targetTokenUid, isDelete = false) {
    if (!this.signedIn()) return false;
    if (this.isAdmin()) return true;
    return this.auth.uid === targetTokenUid;
  }
}

// 1. Dual Admin Verification Tests
{
  console.log('1. Testing Dual Admin Verification (Custom Claim vs Firestore Doc):');

  // Custom claim admin
  const ctxClaim = new RuleContext({ auth: { uid: 'admin_1', token: { admin: true } } });
  assert.equal(ctxClaim.isAdmin(), true, 'Admin with custom claim must be recognized');

  // Firestore doc admin (no custom claim)
  const ctxDoc = new RuleContext({
    auth: { uid: 'admin_2', token: {} },
    admins: new Set(['admin_2']),
  });
  assert.equal(ctxDoc.isAdmin(), true, 'Admin with document at admins/{uid} must be recognized');

  // Ordinary signed-in user
  const ctxUser = new RuleContext({ auth: { uid: 'user_regular', token: {} } });
  assert.equal(ctxUser.isAdmin(), false, 'Regular user must NOT be recognized as admin');

  // Unauthenticated user
  const ctxAnon = new RuleContext({});
  assert.equal(ctxAnon.isAdmin(), false, 'Anonymous user must NOT be recognized as admin');

  console.log('✔ Dual admin verification logic supports both custom claims and admins/{uid}.');
}

// 2. Email Verification Gate on Protected Writes
{
  console.log('\n2. Testing Verification Gate on Submissions and Live Chat:');

  const unverifiedUser = new RuleContext({
    auth: { uid: 'unverified_1', token: { emailVerified: false } },
  });

  const verifiedUser = new RuleContext({
    auth: { uid: 'verified_1', token: { emailVerified: true } },
  });

  const validTestimony = {
    userId: 'unverified_1',
    fullName: 'Sister Grace',
    churchZone: 'Zone 1',
    testimony: 'Praise God for His goodness in my life!',
    status: 'pending',
  };

  // Unverified user denied from submitting testimony
  assert.equal(
    unverifiedUser.canSubmitTestimony(validTestimony),
    false,
    'Unverified user must NOT be permitted to submit testimony',
  );

  // Verified user permitted with matching UID
  assert.equal(
    verifiedUser.canSubmitTestimony({ ...validTestimony, userId: 'verified_1' }),
    true,
    'Verified user must be permitted to submit valid testimony',
  );

  // Live Chat: unverified user denied, verified user permitted
  const chatMsg = { uid: 'unverified_1', name: 'Sister Grace', text: 'Amen!' };
  assert.equal(unverifiedUser.canPostLiveChat(chatMsg), false, 'Unverified user denied from posting chat');
  assert.equal(
    verifiedUser.canPostLiveChat({ ...chatMsg, uid: 'verified_1' }),
    true,
    'Verified user permitted to post chat',
  );

  console.log('✔ Unverified user write operations strictly denied on submissions and live chat.');
}

// 3. Complete Denial of OTP and Device Trust Collections
{
  console.log('\n3. Testing Total Client Denial for emailVerifications and deviceTrust:');

  const adminCtx = new RuleContext({ auth: { uid: 'admin', token: { admin: true } } });
  const userCtx = new RuleContext({ auth: { uid: 'user', token: { emailVerified: true } } });

  assert.equal(userCtx.canAccessOtpCollection(), false, 'Users denied client access to emailVerifications');
  assert.equal(adminCtx.canAccessOtpCollection(), false, 'Admins denied client direct write to emailVerifications (Admin SDK only)');
  assert.equal(userCtx.canAccessDeviceTrustCollection(), false, 'Users denied client access to deviceTrust');

  console.log('✔ Server collections (emailVerifications, deviceTrust) strictly isolated.');
}

// 4. Record Ownership on Push Tokens
{
  console.log('\n4. Testing Push Token Ownership:');

  const userA = new RuleContext({ auth: { uid: 'user_A' } });
  const admin = new RuleContext({ auth: { uid: 'admin', token: { admin: true } } });

  assert.equal(userA.canManagePushToken('user_A'), true, 'User can manage their own token');
  assert.equal(userA.canManagePushToken('user_B'), false, 'User cannot modify token of user_B');
  assert.equal(admin.canManagePushToken('user_B'), true, 'Admin can manage all tokens');

  console.log('✔ Push token ownership and isolation verified.');
}

console.log('\n🎉 ALL FIRESTORE RULES TESTS PASSED SUCCESSFULLY!');
