# 2026 redesign, background audio, size reduction and Worker fix

## Architecture (as found)

| Target | Implementation | Folder |
|---|---|---|
| Android + iOS | One Expo SDK 54 / React Native 0.81 app (EAS builds, no committed native folders) | `src/`, `app.config.ts`, `eas.json` |
| Website | **Separate** Vite + React app (not React Native Web) | `web/` |
| Admin portal | Vite + React | `top-admin/web/` |
| Push / Bunny relay | Cloudflare Worker | `top-admin/worker/` |

So every visual change had to be made twice (mobile and web); tokens are mirrored in
`src/constants/theme.ts` and `web/src/theme.ts` + `web/src/index.css`.

## What changed

**Onboarding** — image *or* video background, configurable without touching the UI. See
[ONBOARDING_MEDIA.md](ONBOARDING_MEDIA.md).

**Home (mobile + web)** — greeting header; hero that shows the live broadcast when `settings/live`
says it is live, otherwise the featured testimony; an offline status row that offers TOP Radio only
when `settings/radio` says it is on air; Explore grid (Testimonies, Listen, Live, Articles,
ADOTOPOC, Events, Share, Saved with offline count); highlights; latest testimonies; audio
testimonies; articles; offline-saved summary; share/sponsor call to action. Sections with no data
are hidden; nothing is faked.

**Navigation** — new **Listen** tab (TOP Radio + audio testimonies). Mobile: 5 tabs. Web: hash
router (`/#/live`, `/#/testimony/<id>` …) so refresh, back and shared links work on any static host;
desktop sidebar ≥ 900 px; bottom nav on phones. Old links (`#live`, `#testimony/<id>`,
`testimoniesofpraise://radio`) still work.

**Auth** — redesigned sign-in / create-account (segmented control, inline errors, Enter submits on
web, Google on both). Logic, Firebase providers, OTP verification and session handling unchanged.
Web now completes a Google redirect sign-in (popup-blocked fallback) via `getRedirectResult`.

**Background audio** — one app-wide player (`src/audio/`, `web/src/audio/`) with a persistent
mini-player, bounded reconnects (3 tries) for the live radio, no autoplay, video pauses audio,
sign-out stops audio. Mobile reuses `expo-video` (no new media library) and now registers its
config plugin with `supportsBackgroundPlayback` — previously missing, so background audio could not
work on Android release builds.

**Admin** — Worker Status Error fixed (below).

## Measurements (same machine, production builds)

### Native JS + bundled assets (`npx expo export`, per platform)

| | Before | After |
|---|---|---|
| Android Hermes bundle | 5.03 MB | 4.74 MB |
| Android bundled assets | 5.32 MB (40 files) | 0.50 MB (22 files) |
| **Android total** | **10.35 MB** | **5.24 MB (−49%)** |
| **iOS total** | **10.34 MB** | **5.22 MB (−49%)** |

Main causes: `import { Ionicons } from '@expo/vector-icons'` bundled all 18 icon fonts (5 MB)
→ per-set import; 1.1 MB logo → 90 KB WebP; unused `kc34.png`, `expo-sharing` removed.
App icon / adaptive icon / splash sources palette-optimised (752/489/604 KB → 200/100/120 KB).

Not measured: the final APK/AAB/IPA. This machine has no Android SDK, no macOS and no EAS
credentials. Build settings that should shrink the real download further (unverified):
R8 + resource shrinking (`expo-build-properties`), preview APK limited to `armeabi-v7a,arm64-v8a`
(x86 is emulator-only). Production uses an AAB, so Google Play already sends each phone only its
own ABI and density — the AAB file size is not what users download. **Please test a preview APK
before release**, because R8 can expose missing keep rules.

### Website (`npm --prefix web run build`)

| | Before | After |
|---|---|---|
| `dist/` total | 4.64 MB | 1.93 MB |
| JS loaded on first visit | 1.53 MB (463 KB gzip) incl. hls.js | 0.88 MB (268 KB gzip) |
| hls.js (592 KB) | every visit | only when an HLS stream is played |
| public images | 3.1 MB | 0.34 MB |

Pages are code-split (largest page chunk 10 KB). The service worker (v2) no longer caches media,
range requests or cross-origin responses.

## TOP Admin "Worker Status Error"

Root cause (verified with curl and from a browser on `https://top-admin.onrender.com`):

1. The dashboard sent a `Cache-Control` **request** header, which forces a CORS preflight asking to
   allow `cache-control`. The deployed Worker only allows `Content-Type, Authorization`, so the
   browser blocked the request → "Network or CORS request failed". The origin itself *was* allowed.
2. The deployed Worker is not the code in this repo: every route, including `/upload/bunny`,
   returns `{"status":"ok"}`. Bunny uploads and the push relay are therefore not live either.
3. That stub also returns `Access-Control-Allow-Origin: https://top-admin.onrender.com` to any origin.

Fixes: the dashboard now sends a simple GET (`cache: 'no-store'`), reports an outdated relay
instead of blaming CORS, separates timeout / network / HTTP / invalid responses, shows "Unknown"
instead of "Missing" when status can't be read, and ignores rapid repeat refreshes. The Worker
uses an exact-match allowlist (no `*` fallback, no allow-all when `ALLOWED_ORIGINS` is empty),
tolerates spaces/trailing slashes, returns 403 to unknown-origin preflights, keeps CORS headers on
errors (top-level try/catch). CORS regression tests added to `top-admin/worker/test.mjs`.

**You must redeploy the Worker** (the repo change does not update Cloudflare):

```bash
cd top-admin/worker
npx wrangler login
npx wrangler secret put BUNNY_STORAGE_ACCESS_KEY   # if not already set
npx wrangler deploy
```

`ALLOWED_ORIGINS` is set in `wrangler.toml` `[vars]`
(`http://localhost:5173,https://testimoniesofpraiseweb.onrender.com,https://top-admin.onrender.com`)
and is applied by `wrangler deploy`. Or add repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`; `.github/workflows/deploy-worker.yml` then deploys and smoke-tests on every
push that touches `top-admin/worker/`. Verify afterwards:

```bash
curl -s -H "Origin: https://top-admin.onrender.com" https://top-push-relay.gtrusouth116.workers.dev/api/media/status
```

It should return JSON with `"providers"`, and the Media Manager should show real provider states.

## Manual steps still required

1. Redeploy the Cloudflare Worker (above).
2. Deploy Firestore rules (`settings/onboarding` public read) only if you want the no-rebuild
   onboarding option: `cd top-admin && firebase deploy --only firestore:rules`.
3. Set your onboarding image/video link ([ONBOARDING_MEDIA.md](ONBOARDING_MEDIA.md)).
4. TOP Radio: `settings/radio` does **not exist** in production and there are no published
   `audioTestimonies`, so Listen shows "off air" / "no audio yet" until the admin portal sets a
   radio stream URL and publishes audio. The main live-stream URL is not used as a radio fallback.
5. New EAS builds (`npm run build:android:apk` to test, then `build:android:aab` /
   `build:ios:testflight`): the expo-video background-audio plugin and R8 are native changes.
6. Web Google sign-in: make sure the Render domain is in Firebase Auth → Authorized domains.
   Safari blocks the redirect fallback across domains; the popup flow (default) works.
7. Android Google sign-in uses a custom-scheme redirect (`com.testimoniesofpraise.app:/oauthredirect`);
   newer Google Android OAuth clients need "Custom URI scheme" enabled in Google Cloud Console.
   This was not changed and could not be tested here.

## Verification status

| Check | Result |
|---|---|
| Mobile `tsc --noEmit` | pass |
| Web `tsc` + production build | pass |
| Admin `tsc` + production build | pass |
| Worker + repo tests (7 suites incl. new CORS tests) | pass |
| `expo prebuild` (Android): media-playback foreground service, permissions, R8 flags present | verified |
| iOS `UIBackgroundModes: audio` (via `expo config --type introspect`; prebuild needs macOS) | verified in config |
| Web onboarding: image, video (muted autoplay + loop + mute), broken URL → branded fallback | verified in browser |
| Web routes: refresh, back from deep link, legacy hash links, sign-in/up switching, validation | verified in browser |
| Web audio: HLS radio via hls.js, keeps playing across 3 page changes, Media Session metadata, mini player on all pages, stop, video pauses audio | verified in browser (with local sample data) |
| Mobile UI on a device/simulator, native background audio, lock-screen controls, Google sign-in, real sign-in on web | **not verified** (no device, emulator, credentials or test account here) |
| Lint | the repo has no lint setup |
