/**
 * Test Suite: Server-Validated Six-Digit OTP Security & Rate Limiting
 * Run with: node tests/otpSecurity.test.mjs
 */

import assert from 'node:assert';
import crypto from 'node:crypto';

console.log('Running OTP Security & Verification Test Suite...\n');

const PEPPER = 'test-server-otp-pepper-secret-32b-length!!';

function computeOtpHmac(code, uid) {
  return crypto.createHmac('sha256', PEPPER).update(`${uid}:${code}`).digest('hex');
}

function verifyCodeConstantTime(candidateCode, uid, storedHash) {
  const candidateHash = computeOtpHmac(candidateCode, uid);
  if (candidateHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// 1. Six-digit numeric OTP generation tests
{
  console.log('1. Testing Cryptographic 6-Digit OTP Generation:');
  for (let i = 0; i < 50; i++) {
    const code = crypto.randomInt(100000, 1000000).toString();
    assert.equal(code.length, 6, 'Code must be exactly 6 characters');
    assert.ok(/^\d{6}$/.test(code), 'Code must contain only numeric digits');
    const num = Number(code);
    assert.ok(num >= 100000 && num <= 999999, 'Code must be in 100000..999999 range');
  }
  console.log('✔ 6-digit OTP generation satisfies length, numeric and entropy bounds.');
}

// 2. HMAC hashing & constant-time validation tests
{
  console.log('\n2. Testing HMAC Hashing & Timing-Safe Verification:');
  const uid = 'user_123';
  const code = '482910';
  const hash = computeOtpHmac(code, uid);

  // Correct code and uid matches
  assert.ok(verifyCodeConstantTime(code, uid, hash), 'Valid code and UID must verify successfully');

  // Wrong code rejected
  assert.ok(!verifyCodeConstantTime('482911', uid, hash), 'Incorrect code must fail verification');

  // Replay attempt with different UID rejected even with same code
  assert.ok(!verifyCodeConstantTime(code, 'other_user', hash), 'Code bound to user_123 must fail for other_user');

  console.log('✔ HMAC binding and constant-time validation passed.');
}

// 3. Expiry and Attempt Limitation State Machine
{
  console.log('\n3. Testing 10-Minute Expiry and Max 5 Attempts:');

  const createRecord = (opts = {}) => ({
    uid: 'user_abc',
    email: 'user@example.com',
    otpHash: computeOtpHmac('123456', 'user_abc'),
    createdAt: Date.now(),
    expiresAt: Date.now() + (opts.expired ? -1000 : 10 * 60 * 1000),
    attempts: opts.attempts || 0,
    maxAttempts: 5,
    status: opts.status || 'pending',
    lastSentAt: Date.now() - (opts.secondsSinceLastSend ? opts.secondsSinceLastSend * 1000 : 70000),
    hourlyCount: opts.hourlyCount || 1,
    hourlyResetAt: Date.now() + 3600 * 1000,
  });

  // Verification helper simulating Cloud Function transaction
  function simulateVerification(record, candidateCode) {
    const now = Date.now();
    if (record.status === 'exhausted' || record.attempts >= record.maxAttempts) {
      record.status = 'exhausted';
      return { ok: false, error: 'Max attempts exceeded' };
    }
    if (now > record.expiresAt) {
      record.status = 'expired';
      return { ok: false, error: 'Code has expired' };
    }
    if (record.status !== 'pending') {
      return { ok: false, error: 'Code is no longer valid' };
    }

    const match = verifyCodeConstantTime(candidateCode, record.uid, record.otpHash);
    if (!match) {
      record.attempts += 1;
      if (record.attempts >= record.maxAttempts) {
        record.status = 'exhausted';
      }
      return { ok: false, error: `Invalid code. ${record.maxAttempts - record.attempts} attempts remaining.` };
    }

    record.status = 'verified';
    delete record.otpHash; // single-use invalidation
    return { ok: true };
  }

  // Test expired code
  const expiredRec = createRecord({ expired: true });
  const expRes = simulateVerification(expiredRec, '123456');
  assert.equal(expRes.ok, false);
  assert.equal(expiredRec.status, 'expired');

  // Test incorrect attempts up to lockout (5 attempts)
  const attemptRec = createRecord();
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = simulateVerification(attemptRec, '000000');
    assert.equal(res.ok, false);
    assert.equal(attemptRec.attempts, attempt);
    assert.equal(attemptRec.status, 'pending');
  }
  // 5th attempt locks out
  const fifthRes = simulateVerification(attemptRec, '000000');
  assert.equal(fifthRes.ok, false);
  assert.equal(attemptRec.attempts, 5);
  assert.equal(attemptRec.status, 'exhausted');

  // 6th attempt rejected immediately due to exhaustion
  const sixthRes = simulateVerification(attemptRec, '123456');
  assert.equal(sixthRes.ok, false);
  assert.ok(sixthRes.error.includes('Max attempts exceeded'));

  // Test successful single-use verification
  const validRec = createRecord();
  const successRes = simulateVerification(validRec, '123456');
  assert.equal(successRes.ok, true);
  assert.equal(validRec.status, 'verified');
  assert.equal(validRec.otpHash, undefined, 'Hash must be deleted on verification');

  // Replay attempt fails immediately
  const replayRes = simulateVerification(validRec, '123456');
  assert.equal(replayRes.ok, false);

  console.log('✔ Expiry, attempt lockout (5 max), and single-use invalidation verified.');
}

// 4. Cooldown (60s) and Hourly Limits (5/hr)
{
  console.log('\n4. Testing 60s Cooldown and Hourly Limits:');

  function checkCanRequestNewOtp(record) {
    const now = Date.now();
    const cooldownMs = 60 * 1000;
    if (now - record.lastSentAt < cooldownMs) {
      const wait = Math.ceil((cooldownMs - (now - record.lastSentAt)) / 1000);
      return { allowed: false, error: `Cooldown active: wait ${wait}s` };
    }
    if (record.hourlyCount >= 5 && now < record.hourlyResetAt) {
      return { allowed: false, error: 'Hourly limit reached' };
    }
    return { allowed: true };
  }

  // Active cooldown (sent 20s ago)
  const cooldownRec = { lastSentAt: Date.now() - 20000, hourlyCount: 1, hourlyResetAt: Date.now() + 3600000 };
  assert.equal(checkCanRequestNewOtp(cooldownRec).allowed, false);

  // Past cooldown (sent 65s ago)
  const okRec = { lastSentAt: Date.now() - 65000, hourlyCount: 1, hourlyResetAt: Date.now() + 3600000 };
  assert.equal(checkCanRequestNewOtp(okRec).allowed, true);

  // Hourly limit reached (5 requests)
  const limitRec = { lastSentAt: Date.now() - 65000, hourlyCount: 5, hourlyResetAt: Date.now() + 3600000 };
  assert.equal(checkCanRequestNewOtp(limitRec).allowed, false);

  console.log('✔ 60-second resend cooldown and hourly rate-limiting verified.');
}

console.log('\n🎉 ALL OTP SECURITY TESTS PASSED SUCCESSFULLY!');
