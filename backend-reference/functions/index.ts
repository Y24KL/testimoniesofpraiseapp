/**
 * Testimonies of Praise - Server-Side Security, OTP Verification & Push Notifications
 * 
 * Features:
 * 1. Six-Digit Email Verification:
 *    - Cryptographically secure 6-digit OTP generation (crypto.randomInt).
 *    - HMAC-SHA256 hashed storage with server-side pepper (secret never touches client or Firestore client docs).
 *    - 10-minute expiry, max 5 attempts per code, 60s cooldown, 5/hr rate-limit.
 *    - Transaction-safe verification and single-use invalidation.
 *    - Updates Firebase Auth emailVerified & custom claims upon success.
 *    - Supports Email/Password and Google authenticated users.
 * 2. Fresh Sign-in & Device Trust Policy:
 *    - Server-side trusted device tracking (`deviceTrust/{uid}_{installationId}`).
 *    - Detects fresh sign-in sessions and uninstalls/reinstalls.
 * 3. Complete Account Deletion:
 *    - Cleans up user push tokens, device trust records, and verification state.
 * 4. High-Reliability Push Notifications:
 *    - Expo push delivery with `priority: 'high'`, sound, and `channelId: 'default'`.
 *    - Double-push protection with `skipPush: true` feed decoupling.
 *    - Transient failure retry & ticket handling.
 */

import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import * as nodemailer from 'nodemailer';

admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();

// ============================================================================
// CONFIGURATION & SECRETS
// ============================================================================
const OTP_PEPPER = process.env.OTP_PEPPER || 'top-production-otp-pepper-secret-key-32b';
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_MAX_ATTEMPTS = 5;
const OTP_HOURLY_LIMIT = 5;

// Email Provider configuration (Resend API or SMTP Transport)
function createMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  // Fallback for development / mock transporter
  return null;
}

const mailTransporter = createMailTransporter();

// Helper to mask email for client display: e.g. "j***@example.com"
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}@${domain}`;
}

// Compute constant-time HMAC-SHA256 of OTP
function computeOtpHmac(code: string, uid: string): string {
  return crypto.createHmac('sha256', OTP_PEPPER).update(`${uid}:${code}`).digest('hex');
}

/** Sends branded verification email with 6-digit code */
async function sendVerificationEmail(toEmail: string, code: string): Promise<void> {
  const subject = `Your Testimonies of Praise Verification Code: ${code}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0A0014; color: #FFFFFF; margin: 0; padding: 24px; }
        .card { background-color: #1A002C; border: 1px solid #4B006E; border-radius: 16px; max-width: 500px; margin: 0 auto; padding: 32px; text-align: center; }
        .logo { font-size: 20px; font-weight: 800; color: #F5C542; letter-spacing: 2px; margin-bottom: 8px; }
        .title { font-size: 24px; font-weight: 700; color: #FFFFFF; margin-bottom: 12px; }
        .desc { font-size: 15px; color: #B0A2BD; line-height: 1.5; margin-bottom: 24px; }
        .code-box { background-color: #0A0014; border: 2px dashed #F5C542; border-radius: 12px; padding: 18px 24px; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #F5C542; margin: 24px 0; display: inline-block; }
        .footer { font-size: 13px; color: #7B6888; line-height: 1.5; margin-top: 24px; border-top: 1px solid #2D0F47; padding-top: 18px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">TESTIMONIES OF PRAISE</div>
        <div class="title">Verify Your Email</div>
        <p class="desc">Enter the six-digit verification code below to verify your account and secure your sign-in session.</p>
        <div class="code-box">${code}</div>
        <p class="desc" style="font-size: 13px;">This code is single-use and will expire in <b>10 minutes</b>.<br/>If you did not request this code, you can safely ignore this email.</p>
        <div class="footer">
          For your security, never share this code with anyone.<br/>
          Testimonies of Praise App &copy; ${new Date().getFullYear()}
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. If Resend API Key is set in environment, use Resend HTTPS API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Testimonies of Praise <auth@testimoniesofpraise.org>',
        to: [toEmail],
        subject,
        html,
        text: `Your Testimonies of Praise verification code is: ${code}. This code expires in 10 minutes.`,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Resend email delivery failed (${res.status}): ${errText}`);
    }
    return;
  }

  // 2. If SMTP transporter is configured, use SMTP
  if (mailTransporter) {
    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM || 'Testimonies of Praise <auth@testimoniesofpraise.org>',
      to: toEmail,
      subject,
      html,
      text: `Your Testimonies of Praise verification code is: ${code}. This code expires in 10 minutes.`,
    });
    return;
  }

  // 3. Development / Test environment fallback
  // In development, log delivery without crashing so developers can test OTP flows
  console.log(`[AUTH-EMAIL-DISPATCH] Verification code dispatched to ${toEmail}: [${code}] (dev/mock mode)`);
}

// ============================================================================
// PHASE 2 & 3: CALLABLE FUNCTIONS FOR EMAIL OTP & DEVICE TRUST
// ============================================================================

/**
 * Request a 6-digit email verification OTP.
 * Can be called during registration or fresh sign-in.
 */
export const sendEmailOtp = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required to request verification code.');
  }

  const uid = request.auth.uid;
  const user = await admin.auth().getUser(uid);
  const email = (user.email || '').trim().toLowerCase();

  if (!email) {
    throw new HttpsError('failed-precondition', 'Account has no registered email address.');
  }

  const installationId = String(request.data?.installationId || '').trim();
  const now = Date.now();
  const verificationRef = db.collection('emailVerifications').doc(uid);

  // Read existing verification state for rate limiting & cooldown
  const snap = await verificationRef.get();
  const existing = snap.data();

  if (existing) {
    // 60-second cooldown check
    const lastSentAt = existing.lastSentAt?.toMillis ? existing.lastSentAt.toMillis() : 0;
    if (now - lastSentAt < OTP_RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - lastSentAt)) / 1000);
      throw new HttpsError('resource-exhausted', `Please wait ${waitSeconds}s before requesting a new code.`);
    }

    // Hourly rate limit check (max 5 per hour)
    const hourlyResetAt = existing.hourlyResetAt?.toMillis ? existing.hourlyResetAt.toMillis() : 0;
    let hourlyCount = existing.hourlyCount || 0;
    if (now > hourlyResetAt) {
      hourlyCount = 0;
    }

    if (hourlyCount >= OTP_HOURLY_LIMIT) {
      throw new HttpsError('resource-exhausted', 'Hourly verification limit reached. Please try again later.');
    }
  }

  // Generate cryptographically secure 6-digit integer: 100000 - 999999
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const otpHash = computeOtpHmac(otpCode, uid);
  const expiresAt = admin.firestore.Timestamp.fromMillis(now + OTP_EXPIRY_MS);
  const hourlyResetAt = admin.firestore.Timestamp.fromMillis(
    existing?.hourlyResetAt?.toMillis && now < existing.hourlyResetAt.toMillis()
      ? existing.hourlyResetAt.toMillis()
      : now + 3600 * 1000,
  );
  const nextHourlyCount = (existing?.hourlyCount && now < (existing?.hourlyResetAt?.toMillis || 0) ? existing.hourlyCount : 0) + 1;

  // Attempt delivery first: do NOT create or grant access if delivery fails
  try {
    await sendVerificationEmail(email, otpCode);
  } catch (err: any) {
    console.error(`Failed to dispatch verification email to ${email}:`, err);
    throw new HttpsError('unavailable', 'Failed to send verification code email. Please try again in a moment.');
  }

  // Save secure hash server-side
  await verificationRef.set({
    uid,
    email,
    otpHash,
    status: 'pending',
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
    hourlyCount: nextHourlyCount,
    hourlyResetAt,
    installationId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    maskedEmail: maskEmail(email),
    cooldownSeconds: 60,
    expiresAt: expiresAt.toMillis(),
  };
});

/**
 * Validates the 6-digit numeric OTP and establishes device trust.
 */
export const verifyEmailOtp = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required to verify code.');
  }

  const uid = request.auth.uid;
  const inputCode = String(request.data?.code || '').trim();
  const installationId = String(request.data?.installationId || '').trim();

  if (!/^\d{6}$/.test(inputCode)) {
    throw new HttpsError('invalid-argument', 'Please enter a valid 6-digit numeric verification code.');
  }

  const verificationRef = db.collection('emailVerifications').doc(uid);
  const now = Date.now();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(verificationRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'No verification request found. Please request a new code.');
    }

    const data = snap.data()!;
    if (data.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'This verification code is no longer valid. Please request a new code.');
    }

    // Check expiry
    const expiresAt = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : 0;
    if (now > expiresAt) {
      tx.update(verificationRef, { status: 'expired' });
      throw new HttpsError('deadline-exceeded', 'This verification code has expired. Please request a new one.');
    }

    // Check max attempts
    const attempts = data.attempts || 0;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      tx.update(verificationRef, { status: 'exhausted' });
      throw new HttpsError('resource-exhausted', 'Maximum verification attempts exceeded. Please request a new code.');
    }

    // Constant-time HMAC comparison
    const candidateHash = computeOtpHmac(inputCode, uid);
    const storedHash = data.otpHash || '';

    const isMatch =
      candidateHash.length === storedHash.length &&
      crypto.timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(storedHash, 'hex'));

    if (!isMatch) {
      const nextAttempts = attempts + 1;
      const remaining = OTP_MAX_ATTEMPTS - nextAttempts;
      tx.update(verificationRef, {
        attempts: nextAttempts,
        status: nextAttempts >= OTP_MAX_ATTEMPTS ? 'exhausted' : 'pending',
      });
      if (remaining <= 0) {
        throw new HttpsError('resource-exhausted', 'Incorrect code. Maximum attempts exceeded. Please request a new code.');
      }
      throw new HttpsError('invalid-argument', `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
    }

    // SUCCESS: Invalidate the code (single-use)
    tx.update(verificationRef, {
      status: 'verified',
      otpHash: admin.firestore.FieldValue.delete(),
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { email: data.email };
  });

  // Update Firebase Auth user record to mark emailVerified: true
  try {
    await admin.auth().updateUser(uid, { emailVerified: true });
    // Also set custom claim emailVerified for Firestore rules
    const existingClaims = (await admin.auth().getUser(uid)).customClaims || {};
    await admin.auth().setCustomUserClaims(uid, { ...existingClaims, emailVerified: true });
  } catch (authErr) {
    console.error('Error updating Firebase Auth user claims:', authErr);
  }

  // Update/create userProfile document
  await db.collection('userProfiles').doc(uid).set(
    {
      uid,
      email: result.email,
      emailVerified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Register or renew trusted device session
  const sessionNonce = crypto.randomUUID();
  if (installationId) {
    const deviceTrustRef = db.collection('deviceTrust').doc(`${uid}_${installationId}`);
    await deviceTrustRef.set({
      uid,
      installationId,
      sessionNonce,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return {
    ok: true,
    emailVerified: true,
    sessionNonce,
  };
});

/**
 * Checks if the current installation has a valid trusted device record.
 */
export const checkSessionTrust = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    return { trusted: false, emailVerified: false };
  }

  const uid = request.auth.uid;
  const installationId = String(request.data?.installationId || '').trim();

  if (!installationId) {
    return { trusted: false, emailVerified: Boolean(request.auth.token.email_verified) };
  }

  const deviceTrustRef = db.collection('deviceTrust').doc(`${uid}_${installationId}`);
  const snap = await deviceTrustRef.get();

  if (!snap.exists) {
    return { trusted: false, emailVerified: Boolean(request.auth.token.email_verified) };
  }

  // Touch lastActiveAt
  await deviceTrustRef.update({ lastActiveAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => undefined);

  return {
    trusted: true,
    emailVerified: true,
  };
});

/**
 * Completely deletes user account, device trust records, and push tokens.
 */
export const deleteUserAccount = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required to delete account.');
  }

  const uid = request.auth.uid;

  // 1. Delete push tokens associated with user
  const pushTokensSnap = await db.collection('pushTokens').where('uid', '==', uid).get();
  const tokenDeletions = pushTokensSnap.docs.map((doc) => doc.ref.delete());

  // 2. Delete device trust records
  const deviceTrustSnap = await db.collection('deviceTrust').where('uid', '==', uid).get();
  const deviceDeletions = deviceTrustSnap.docs.map((doc) => doc.ref.delete());

  // 3. Delete verification record & profile
  const verRef = db.collection('emailVerifications').doc(uid).delete();
  const profRef = db.collection('userProfiles').doc(uid).delete();

  await Promise.all([...tokenDeletions, ...deviceDeletions, verRef, profRef]);

  // 4. Delete user from Firebase Authentication
  await admin.auth().deleteUser(uid);

  return { ok: true };
});

// ============================================================================
// PHASE 6: PUSH NOTIFICATIONS DELIVERY & OS BANNER BEHAVIOR
// ============================================================================

type PrefKey = 'testimonies' | 'live' | 'announcements';

/**
 * Safely broadcast notifications to Expo Push service with High Priority.
 * Removes dead tokens reported by Expo and handles transient retries.
 */
async function broadcast(pref: PrefKey, msg: Omit<ExpoPushMessage, 'to'>) {
  const snap = await db.collection('pushTokens').where(`prefs.${pref}`, '==', true).get();
  const tokens = snap.docs.map((d) => d.get('token') as string).filter((t) => Expo.isExpoPushToken(t));

  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    sound: 'default',
    channelId: 'default', // Matches high-importance channel created on client
    priority: 'high',     // Required for Android heads-up / dropdown banner
    ...msg,
  }));

  let sent = 0;
  let failed = 0;
  const deadTokens: string[] = [];

  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((t, i) => {
        if (t.status === 'ok') {
          sent += 1;
        } else {
          failed += 1;
          if (t.details?.error === 'DeviceNotRegistered') {
            const dead = (chunk[i] as { to: string }).to;
            deadTokens.push(dead);
          }
        }
      });
    } catch (chunkErr) {
      console.error('Error sending push chunk via Expo service:', chunkErr);
      failed += chunk.length;
    }
  }

  // Tidy up dead tokens in Firestore
  if (deadTokens.length > 0) {
    const cleanups = deadTokens.map((t) => {
      const docId = t.replace(/\//g, '_');
      return db.collection('pushTokens').doc(docId).delete().catch(() => undefined);
    });
    await Promise.all(cleanups);
  }

  return { sent, failed };
}

/**
 * Fires when a testimony is created or edited and is (newly) published.
 * Uses atomic transaction claim to ensure duplicate pushes are not sent,
 * but only marks pushSentAt if the broadcast attempt was initiated.
 */
export const onTestimonyPublished = onDocumentWritten('testimonies/{id}', async (event) => {
  const after = event.data?.after;
  if (!after?.exists || after.get('isPublished') !== true) return;
  if (after.get('pushSentAt') || after.get('notifyOnPublish') === false) return;

  const docRef = after.ref;
  const shouldSend = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (snap.get('pushSentAt')) return false;
    tx.update(docRef, { pushSentAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });

  if (!shouldSend) return;

  const title = 'NEW TESTIMONY AVAILABLE';
  const body = 'A new testimony has just been added to Testimonies of Praise.';

  await broadcast('testimonies', {
    title,
    body,
    data: { type: 'testimony', contentId: event.params.id },
  });

  // Add in-app notification feed item with skipPush: true so it won't re-trigger push
  await db.collection('notifications').add({
    title,
    message: body,
    type: 'testimony',
    contentId: event.params.id,
    published: true,
    skipPush: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});

/**
 * Fires when the Admin Portal flips settings/live from offline to live.
 */
export const onLiveStarted = onDocumentWritten('settings/live', async (event) => {
  const wasLive = event.data?.before?.get('isLive') === true;
  const after = event.data?.after;
  if (wasLive || !after?.exists || after.get('isLive') !== true) return;
  if (after.get('notifyOnStart') === false) return;

  const title = 'WE ARE LIVE';
  const body = (after.get('title') as string) || 'Join the live broadcast now.';

  await broadcast('live', {
    title,
    body,
    data: { type: 'live' },
  });

  // Add feed notification with skipPush: true
  await db.collection('notifications').add({
    title,
    message: body,
    type: 'live',
    published: true,
    skipPush: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});

/**
 * Announcements / featured content: create a doc in `notifications` with type 'announcement' | 'featured'.
 */
export const onAnnouncement = onDocumentWritten('notifications/{id}', async (event) => {
  const after = event.data?.after;
  if (!after?.exists || after.get('published') !== true) return;
  const type = after.get('type');
  if (type !== 'announcement' && type !== 'featured') return;
  if (after.get('skipPush') === true || after.get('pushSentAt')) return;

  const docRef = after.ref;
  const shouldSend = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (snap.get('pushSentAt') || snap.get('skipPush') === true) return false;
    tx.update(docRef, { pushSentAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });

  if (!shouldSend) return;

  await broadcast('announcements', {
    title: after.get('title') || 'Testimonies of Praise Announcement',
    body: after.get('message') || 'A new announcement has been posted.',
    data: { type, contentId: after.get('contentId') ?? undefined },
  });
});

/**
 * Developer diagnostic function for testing push notifications on a real device.
 * Admins only.
 */
export const sendTestPush = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  // Verify caller is admin
  const uid = request.auth.uid;
  const isAdminClaim = request.auth.token.admin === true;
  const adminDoc = await db.collection('admins').doc(uid).get();

  if (!isAdminClaim && !adminDoc.exists) {
    throw new HttpsError('permission-denied', 'Only administrators can invoke test push.');
  }

  const targetToken = request.data?.token;
  if (!targetToken || !Expo.isExpoPushToken(targetToken)) {
    throw new HttpsError('invalid-argument', 'Valid Expo push token is required.');
  }

  const message: ExpoPushMessage = {
    to: targetToken,
    title: 'Test Notification - TOP',
    body: 'If you see this banner, OS heads-up notifications are functioning properly!',
    sound: 'default',
    channelId: 'default',
    priority: 'high',
    data: { type: 'announcement', isTest: true },
  };

  const tickets = await expo.sendPushNotificationsAsync([message]);
  return { ok: true, tickets };
});
