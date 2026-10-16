# Multi-Cloud Media Infrastructure & Storage Guide

Testimonies of Praise (TOP) employs a specialized multi-cloud media architecture engineered for performance, affordability, security, and zero data loss:

1. **Bunny Storage & CDN**: Dedicated to **audio recordings, audio testimonies, podcasts, and large media files**.
2. **Cloudinary**: Dedicated to **images, thumbnails, article cover visuals, promotion banners, and sponsorship receipts**.
3. **Firebase**: Dedicated to **structured metadata (Firestore), authentication (Firebase Auth), real-time presence, and listener heartbeats**.
4. **HLS / Live Stream**: Dedicated to **TOP Radio live broadcast and video live streams** (`.m3u8`).

---

## 1. Security Architecture: Server-Side Secret Isolation

To safeguard your infrastructure and prevent quota abuse or credential extraction:
- **Client devices (Mobile & Web)** NEVER possess Bunny Storage AccessKeys or Cloudinary master API secrets.
- All Bunny Storage file uploads are executed **server-side** through the Cloudflare Worker relay (`top-admin/worker`).
- The worker verifies the caller's identity by validating their Firebase ID token against Firestore admin permissions (`verifyAdmin`).
- Non-admin callers or forged requests are rejected with `403 Forbidden` before any storage operation is attempted.

```
[Admin Browser]
      │
      │ 1. Upload file with Authorization: Bearer <FirebaseIdToken>
      ▼
[Cloudflare Worker Relay]
      │
      │ 2. Verify admin permissions against Firestore
      │ 3. Stream upload using BUNNY_STORAGE_ACCESS_KEY (kept on server)
      ▼
[Bunny Storage REST API] (storage.bunnycdn.com)
      │
      │ 4. File stored in Storage Zone
      ▼
[Bunny Global CDN / Pull Zone] (e.g. top-media.b-cdn.net)
      │
      │ 5. Returns public CDN URL to Admin
      ▼
[Firestore Metadata Document] (audioUrl: "https://top-media.b-cdn.net/...")
```

---

## 2. Setup & Configuration Instructions

### Step A: Bunny Storage & CDN Setup
1. Log in to [Bunny.net](https://bunny.net) and navigate to **Storage**.
2. Click **Add Storage Zone**:
   - Name: `top-media-storage`
   - Main Storage Region: Choose the closest region (e.g. Europe/Falkenstein or London).
3. Connect or create a **Pull Zone (CDN)**:
   - Hostname: `top-media.b-cdn.net` (or link your custom domain such as `media.testimoniesofpraise.org`).
4. Copy the **Password (AccessKey)** from **Storage > FTP & API Access**.
5. Set the secret in your Cloudflare Worker:
   ```bash
   cd top-admin/worker
   npx wrangler secret put BUNNY_STORAGE_ACCESS_KEY
   # Paste your storage zone password when prompted
   ```
6. In `top-admin/worker/wrangler.toml`, verify the public settings:
   ```toml
   [vars]
   FIREBASE_PROJECT_ID = "YOUR-FIREBASE-PROJECT-ID"
   ALLOWED_ORIGINS = "http://localhost:5173,https://YOUR-FIREBASE-PROJECT-ID.web.app"
   BUNNY_STORAGE_ZONE_NAME = "top-media-storage"
   BUNNY_STORAGE_ENDPOINT = "storage.bunnycdn.com"
   BUNNY_CDN_HOSTNAME = "top-media.b-cdn.net"
   ```
7. Deploy the worker:
   ```bash
   npx wrangler deploy
   ```

### Step B: Admin Portal Configuration
In `top-admin/web/.env`:
```ini
VITE_WORKER_URL=https://top-push-relay.yoursubdomain.workers.dev
VITE_CLOUDINARY_CLOUD_NAME=duw6xrnpn
VITE_CLOUDINARY_UPLOAD_PRESET=top_uploads
```

### Step C: Mobile & Web App Configuration
In root `.env` (mobile):
```ini
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=duw6xrnpn
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=top_uploads
EXPO_PUBLIC_BUNNY_CDN_HOSTNAME=top-media.b-cdn.net
```
In `web/.env` (web PWA):
```ini
VITE_CLOUDINARY_CLOUD_NAME=duw6xrnpn
VITE_CLOUDINARY_UPLOAD_PRESET=top_uploads
VITE_BUNNY_CDN_HOSTNAME=top-media.b-cdn.net
```

---

## 3. Admin Upload Management

In the Admin Portal (`top-admin/web`):
1. **TOP Radio & Audio Testimonies**:
   - Files uploaded via "Upload Audio File" automatically route to Bunny Storage.
   - The UI displays an instant provider badge (e.g. `[Bunny Storage (CDN)]` or `[Cloudinary]`).
2. **Testimonies Editor**:
   - Videos are routed to Bunny Storage if large or configured on the worker; falls back gracefully to Cloudinary if within limits.
   - Thumbnails route to Cloudinary.
3. **Articles & Promotions**:
   - Covers and event banners route to Cloudinary.
4. **Media & Storage Dashboard** (`/media`):
   - Real-time provider health status.
   - Interactive URL reachability tester (HTTP HEAD check).

---

## 4. Cross-Platform Playback Compatibility

- **Byte-Range Requests**: Bunny CDN natively outputs `Accept-Ranges: bytes` and `206 Partial Content`. This is required for scrubbing and smooth seeking on iOS Safari, iOS AVPlayer, and Android ExoPlayer.
- **Background Audio**: Audio playback uses `expo-video` with `staysActiveInBackground: true` on mobile and the HTML5 `MediaSession` API on web.
- **HLS Streams**: `.m3u8` streams (TOP Radio and live video) are automatically detected by `isHlsUrl()` and passed to HLS native players without mutation.
- **Existing Cloudinary URLs**: Existing links (such as the ADOTOPOC outro video and logos) continue to play seamlessly with 100% backward compatibility.

---

## 5. Migration Safeguards & Rollback Protocol

### Non-Destructive Guarantee
- **Never delete source files**: Files on Cloudinary or external hosts are NEVER deleted during migration.
- **Verification before update**: Before any Firestore document's URL is updated, a reachability check confirms that the file returns `HTTP 200 OK` on Bunny CDN.

### Step 1: Run Media Audit
Scan all Firestore collections to review hosting distribution:
```bash
node scripts/media-migration.mjs --audit
```

### Step 2: Verify Existing URLs
Verify that all current URLs are reachable:
```bash
node scripts/media-migration.mjs --verify
```

### Step 3: Dry-Run Simulation
Simulate migrating audio files to Bunny Storage without making any database changes:
```bash
node scripts/media-migration.mjs --migrate-audio --dry-run
```

### Step 4: Apply Migration with Automatic Snapshot
Executes the migration, creates a timestamped rollback snapshot in `backups/`, verifies each file, and updates Firestore records:
```bash
node scripts/media-migration.mjs --migrate-audio --apply
```

### Step 5: Rollback Steps (Emergency or Testing)
If you ever need to restore previous URLs, run the rollback command pointing to the snapshot:
```bash
node scripts/media-migration.mjs --rollback backups/pre-audio-migration-[TIMESTAMP].json
```
This restores all previous media URLs in a single batch.

---

## 6. Verification & Test Suite

The media infrastructure includes automated tests that can be run anytime:
```bash
# 1. Test worker media endpoints, authentication, and Bunny Storage PUT simulation:
cd top-admin/worker
node test-media.mjs
node test.mjs

# 2. Test unified media service, provider detection, and URL resolution:
cd ../..
node tests/mediaService.test.mjs
```
All test suites run with standard Node.js without requiring external test runners.
