THIS UPDATE (full src/config replace, same as previous full updates)

A) Removed: KingsChat sign-in entirely (button, modal, AuthContext method, config). You asked to
   drop it and focus on Google + email instead.

B) iOS: Google sign-in is now Android-only (hidden on iOS) until the iOS Google OAuth client is
   set up. iOS users see Email sign-in only for now — Google will reappear there automatically
   once EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is filled in and you rebuild (no further code change
   needed when you're ready for that).

C) New: live viewer tracking. While the Live tab is open AND the stream is live, the app sends a
   lightweight "I'm watching" heartbeat (src/hooks/useLiveViewer.ts) that the admin portal counts
   to show "X watching now". Opening the Live tab while live counts as watching immediately, by
   design — it doesn't check whether the video is actually playing.

STEPS
1. No new packages beyond what earlier updates already added.
2. Copy 'src', app.config.ts, eas.json, index.ts, metro.config.js, package.json, tsconfig.json,
   README.md, docs/, backend-reference/ into your project, choosing Replace. Do NOT let this
   touch: assets/, .env, google-services.json, GoogleService-Info.plist, top-admin/, android/, ios/
   — none of those are in this zip.
3. Merge any new lines from .env.example into your real .env (nothing new this round, but it's
   included for completeness/reference).
4. REQUIRED: deploy the updated Firestore rules — see the matching admin portal update.
5. Reload (press r) if testing the development build. Rebuild (npm run build:android:apk or
   build:android:dev) if testing a preview/production/dev-client APK, since KingsChat removal and
   the iOS Google-gating are JS-only changes that WOULD show up on reload for a dev client, but a
   standalone preview/production APK needs a fresh build either way to pick up any code change.
