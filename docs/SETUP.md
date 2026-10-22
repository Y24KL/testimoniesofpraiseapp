# Setup, Security Architecture, and Production Deployment Guide

**Project:** Testimonies of Praise App & Admin Infrastructure  
**Revision:** Security & Reliability Upgrade (SDK 54 / Cloud Functions v2)

---

## 1. Security Upgrade Overview

This release upgrades the application security, email verification, session lifecycle, push notification reliability, Google Sign-in, and Bunny Storage management:

1. **Server-Validated Six-Digit Numeric OTP**:
   - Cryptographically secure 6-digit integer generation on the server (`crypto.randomInt`).
   - HMAC-SHA256 hashed storage with server-side pepper secret (never stored in client or client-readable documents).
   - 10-minute expiry, max 5 failed attempts per code (automatic lockout), 60-second resend cooldown, 5/hour rate-limit.
   - Enforced on all new registrations (Email/Password and Google) and fresh sign-in sessions after reinstallation.
2. **Fresh Sign-in & Device Trust Policy**:
   - Server-side trusted device tracking (`deviceTrust/{uid}_{installationId}`).
   - Automatically challenges fresh logins after uninstallation/reinstallation without breaking existing resumed sessions.
   - Complete account deletion workflow cleaning up device trust, push tokens, and Auth credentials.
3. **OS Push Notification Banner Fix**:
   - Foreground notification handler configured with `shouldShowBanner: true`, `shouldShowList: true`, `shouldPlaySound: true`, and `priority: AndroidNotificationPriority.HIGH`.
   - Android NotificationChannel `'default'` initialized with `AndroidImportance.HIGH`, vibration pattern, and light color.
   - Expo push message payload specifies `priority: 'high'` and `channelId: 'default'`.
   - Idempotent claim state and feed decoupling with `skipPush: true` preventing duplicate broadcasts.
4. **Google Sign-In Reliability**:
   - Fixed native callback scheme mismatch by registering `com.testimoniesofpraise.app` and reversed iOS client ID `com.googleusercontent.apps.754997860722-fjfanme5itf82ue8sbch2m8rjkuvqnpq` in `app.config.ts`.
   - Scoped iOS App Transport Security (`NSAllowsArbitraryLoadsInWebContent` & `NSAllowsArbitraryLoadsForMedia`).
5. **Bunny Storage & Media Manager Repair**:
   - Fixed corrupted environment variables in `top-admin/web/.env` by stripping stray citation text.
   - Added `Cache-Control: no-store` and dynamic CORS origin reflection to Cloudflare Worker status endpoint.
   - Upgraded `MediaManager.tsx` with typed error handling, "Last checked" timestamps, retry action, and accurate status indicators.

---

## 2. Server Secrets & Environment Configuration

### A. Firebase Cloud Functions (`backend-reference/functions`)
Configure the following secrets in Google Cloud / Firebase Secret Manager or Functions runtime environment:

```bash
cd backend-reference/functions

# 1. OTP Pepper Secret (Cryptographic HMAC pepper - at least 32 bytes)
firebase functions:secrets:set OTP_PEPPER

# 2. Email Provider Option A: Resend API (Recommended)
firebase functions:secrets:set RESEND_API_KEY
# Optional sender:
firebase functions:config:set mail.from="Testimonies of Praise <auth@testimoniesofpraise.org>"

# 3. Email Provider Option B: SMTP Transport (Alternative)
firebase functions:secrets:set SMTP_HOST="smtp.mailgun.org"
firebase functions:secrets:set SMTP_PORT="587"
firebase functions:secrets:set SMTP_USER="postmaster@yourdomain.com"
firebase functions:secrets:set SMTP_PASS="your-smtp-password"
```

### B. Cloudflare Worker Relay (`top-admin/worker`)
Configure the private Bunny Storage AccessKey in Cloudflare Worker secrets (never in `.env` or client files):

```bash
cd top-admin/worker

# Set Bunny Storage AccessKey as a Cloudflare Secret
npx wrangler secret put BUNNY_STORAGE_ACCESS_KEY
# Enter your Bunny.net Storage Password when prompted

# Deploy Worker
npx wrangler deploy
```

In `top-admin/worker/wrangler.toml`, ensure `ALLOWED_ORIGINS` includes your deployed admin portal and web domain:
```toml
ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:5174,https://testimoniesofpraiseweb.onrender.com"
```

### C. Admin Portal Environment (`top-admin/web/.env`)
```ini
VITE_FIREBASE_API_KEY=AIzaSyAg_3WiDv4LL2BWceIxcyx-GqXuef8VlD4
VITE_FIREBASE_AUTH_DOMAIN=testimoniesofpraiseapp.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=testimoniesofpraiseapp
VITE_FIREBASE_STORAGE_BUCKET=testimoniesofpraiseapp.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=754997860722
VITE_FIREBASE_APP_ID=1:754997860722:web:acff003464bb7aec7265eb

# Cloudflare Worker URL (Handles Bunny uploads and push notifications)
VITE_WORKER_URL=https://top-push-relay.gtrusouth116.workers.dev

# Cloudinary (Images and thumbnails)
VITE_CLOUDINARY_CLOUD_NAME=duw6xrnpn
VITE_CLOUDINARY_UPLOAD_PRESET=top_receipts
```

---

## 3. Backend Deployment Instructions

Deploy the upgraded Cloud Functions, Firestore Security Rules, and Storage Security Rules:

```bash
# 1. Build and deploy Cloud Functions
cd backend-reference/functions
npm run build
firebase deploy --only functions

# 2. Deploy Firestore Rules and Indexes
cd ../..
firebase deploy --only firestore:rules,firestore:indexes

# 3. Deploy Storage Rules
firebase deploy --only storage:rules
```

---

## 4. Native App Rebuild Requirement (Google Sign-In)

> [!IMPORTANT]
> **A NEW NATIVE BUILD IS REQUIRED.**
> Because `app.config.ts` was updated to register the native OAuth redirect schemes (`com.testimoniesofpraise.app` and the reversed iOS client ID `com.googleusercontent.apps...`), existing installed binaries cannot route Google OAuth callbacks without re-building. A JavaScript-only OTA update cannot add native intent filters or URL types to an already installed app.

### Google Cloud Console Verification Checklist
In Google Cloud Console > APIs & Services > Credentials (under project `testimoniesofpraiseapp`):
1. **Android Client ID (`754997860722-9r59ln2nl6gp62btdmh0gmib46rb27tj`)**:
   - Package name: `com.testimoniesofpraise.app`
   - SHA-1 Certificate Fingerprints:
     - Development/debug key: `01:63:58:A6:55:BE:5B:15:EA:92:A4:D2:57:38:14:61:23:13:6A:1A`
     - EAS build signing key (run `eas credentials` to retrieve fingerprint)
     - Google Play App Signing key (from Google Play Console > App Integrity)
2. **iOS Client ID (`754997860722-fjfanme5itf82ue8sbch2m8rjkuvqnpq`)**:
   - Bundle identifier: `com.testimoniesofpraise.app`
3. **Web Client ID (`754997860722-9m136c2lt98vej9d0roi6jel53i3887l`)**:
   - Authorized redirect URIs must include:
     - `https://auth.expo.io/@y24kl/testimonies-of-praise` (if using Expo proxy)
     - `com.testimoniesofpraise.app:/oauthredirect`

### Build Commands
```bash
# Sideloadable Android APK preview:
eas build --profile preview --platform android

# Production App Bundle (AAB):
eas build --profile production --platform android

# Production iOS (TestFlight):
eas build --profile production --platform ios
```

---

## 5. Push Notification Setup & Verification

1. **Android FCM V1**:
   - Generate a private key JSON from Firebase Console > Project Settings > Service accounts > Generate new private key.
   - Upload to EAS: `eas credentials` > Android > Google Service Account Key (FCM V1).
2. **iOS APNs**:
   - In Apple Developer Portal, generate an APNs Auth Key (.p8).
   - Upload key ID, team ID, and .p8 file to EAS (`eas credentials` > iOS > Push Notifications).
3. **Diagnostic Test Push**:
   - Call the `sendTestPush` function with the device's registered token from an authorized admin account to verify that heads-up dropdown banners appear.

---

## 6. Production Security Checklist

- [x] OTP secrets (`OTP_PEPPER`) moved server-side; not accessible to client apps.
- [x] Single-use OTP codes expire in 10 minutes with max 5 failed attempts.
- [x] Unverified users denied write access to `testimonySubmissions`, `sponsorships`, `liveChat`.
- [x] `emailVerifications` and `deviceTrust` collections denied client read/write access.
- [x] Dual admin authentication supported (`admin` custom claim + `admins/{uid}` doc).
- [x] Push notifications use high priority (`priority: 'high'`) and high-importance channel.
- [x] Account deletion cleans up push tokens and device trust records before deleting Auth account.
- [x] Stray citations stripped from `.env` files.
- [x] Storage zones and pull zone URLs verified without exposing access keys in frontend.
