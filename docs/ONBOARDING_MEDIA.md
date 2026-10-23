# Onboarding media (Welcome screen image or video)

The Welcome screen (mobile app and website) can show **either a still image or a video** behind the
logo and the Get started / Continue with Google / Sign in actions. You choose the media; nothing else
in the UI needs to change.

If nothing is configured, the screen shows the branded purple/gold background. No placeholder link is
hard-coded.

## Option A: build-time setting (simplest)

| Platform | Where | Variables |
|---|---|---|
| Android + iOS | `eas.json` → `build.preview.env` and `build.production.env` (already present, empty), or `.env` for local builds | `EXPO_PUBLIC_ONBOARDING_MEDIA_URL`, optional `EXPO_PUBLIC_ONBOARDING_MEDIA_TYPE`, `EXPO_PUBLIC_ONBOARDING_POSTER_URL`, `EXPO_PUBLIC_ONBOARDING_OVERLAY` |
| Website | Render → the web service → Environment (or `web/.env`), then redeploy | `VITE_ONBOARDING_MEDIA_URL`, optional `VITE_ONBOARDING_MEDIA_TYPE`, `VITE_ONBOARDING_POSTER_URL`, `VITE_ONBOARDING_OVERLAY` |

- `..._MEDIA_URL`: `https://` link to the image (JPG/WebP/PNG) or video (MP4 H.264, or HLS `.m3u8`).
- `..._MEDIA_TYPE`: `image` or `video`. Optional: guessed from the extension (`.mp4 .m4v .mov .webm .m3u8` = video).
- `..._POSTER_URL`: still image for videos. Shown while the video loads, when the visitor has
  reduce-motion or data-saver on (they can tap ▶ to play), and if the video fails.
- `..._OVERLAY`: `0`–`1`, how dark the readability overlay is (default `0.55`).

Mobile changes need a new EAS build (or an EAS Update if you use it). Web changes need a redeploy.

## Option B: change it without a rebuild (Firestore)

Create the document **`settings/onboarding`** in the Firebase console:

```
mediaType:      "video"            // or "image"
mediaUrl:       "https://…/intro.mp4"
posterUrl:      "https://…/intro-poster.jpg"   // optional
overlayOpacity: 0.55                // optional
```

The Welcome screen is shown before sign-in, so this document must be publicly readable. The updated
rules in `top-admin/firestore.rules` (and `backend-reference/firestore.rules`) add exactly that rule
(`allow read: if true; allow write: if isAdmin();`) — deploy them with
`firebase deploy --only firestore:rules` from `top-admin/`.

The app shows the last value it fetched immediately and refreshes it in the background, so a change
appears on the next launch (immediately if no media was configured before).

## Recommendations

- Host media on the existing Bunny CDN (video) or Cloudinary (images), never inside the app bundle.
- Video: 8–20 s loop, MP4 H.264 + AAC, 720p, ≤ 3–4 MB. It plays **muted** (browsers and iOS only
  allow muted autoplay); visitors can unmute with the speaker button.
- Image: portrait-friendly, ~1200×1800, WebP/JPG ≤ 300 KB. Keep the subject in the top half: the
  bottom half sits under the text.
- Cloudinary tip: `…/upload/f_auto,q_auto,w_1200/…` serves an optimised format automatically.

## Where the code lives

- Mobile: `src/constants/onboarding.ts` (config), `src/hooks/useOnboardingMedia.ts`,
  `src/components/OnboardingBackdrop.tsx`, `src/screens/WelcomeScreen.tsx`
- Web: `web/src/config/onboarding.ts`, `web/src/components/OnboardingBackdrop.tsx`,
  `web/src/pages/WelcomePage.tsx`
