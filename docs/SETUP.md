# Setup, assumptions and release checklist

## 0. What was and wasn't verified
The site at https://testimoniesofpraiseweb.onrender.com is a client-rendered app. When this project was
generated only its HTML shell was readable, which exposed:
- primary purple `#4B006E` (its theme-color)  ✅ used as the brand primary
- the page title/tagline and its logo file name

NOT readable, so **not verified**: the full color palette, fonts, the real logo file, the backend
(Firebase vs REST), collection/field names, the Admin Portal's live-stream settings, and the
submission endpoint. Everything unverified is isolated in these places:

| To change | File |
|---|---|
| Colors / gradients / fonts | `src/constants/theme.ts` |
| Logo, icon, splash | `assets/logo.png`, `icon.png`, `adaptive-icon.png`, `splash.png` (placeholders now) |
| Collection + live doc names, REST endpoints | `.env` and `src/constants/config.ts` |
| Field-name mapping (title, videoUrl, isPublished ...) | `src/api/normalize.ts` |
| Submission payload | `firestoreRepository.submitTestimony` / `restRepository.submitTestimony` |

Tip: open the website with browser DevTools > Application/Network, or look at the Admin Portal source, and
copy the real Firebase config, collection names and live-stream document into `.env`.

## 1. Firebase (default backend mode)
1. Use the SAME Firebase project as the website. Add an **iOS** app and an **Android** app in Project settings.
2. Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) into the project root.
   (They are git-ignored; for EAS use file secrets: `eas secret:create --type file`.)
3. Put the **web app** config values in `.env` (`EXPO_PUBLIC_FIREBASE_*`).
4. Enable Authentication providers: Email/Password and Google.
5. Merge `backend-reference/firestore.rules` and `firestore.indexes.json` into your project **after comparing with
   what's deployed**. Admin custom claim name may differ in your portal.
6. If the backend is a REST API instead, set `EXPO_PUBLIC_BACKEND_MODE=rest`, `EXPO_PUBLIC_API_BASE_URL`, and adapt
   `CONFIG.rest` paths. **Auth still uses Firebase Auth** in this project.

## 2. Google sign-in
Create OAuth client IDs in Google Cloud (same project as Firebase):
- **Web** client (already exists if Firebase Google sign-in is enabled) -> `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- **Android** client: package `com.testimoniesofpraise.app` + SHA-1 of your signing key
  (`eas credentials` shows it; add BOTH the debug/dev key and the Play App Signing key) -> `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- **iOS** client: bundle id `com.testimoniesofpraise.app` -> `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

`app.config.ts` automatically registers the redirect schemes (package name and the reversed iOS client id).
Uses `expo-auth-session` (real Google OAuth, id token -> Firebase credential). It works in dev/production builds, not Expo Go.

## 3. Push notifications
- App side: Expo push tokens are saved to `pushTokens/{token}` with the user's notification preferences.
- Android: upload your FCM V1 service-account key to EAS (`eas credentials`). iOS: EAS can create the APNs key for you.
- Server: deploy `backend-reference/functions` (merge with your existing functions). It sends on testimony/resource
  publish, live start, and announcements, with duplicate protection (`pushSentAt`).
- Every push must carry `data: { type, contentId }`; tapping opens the exact screen.
- Simulators can't receive push; test on real devices.

## 4. Build
```bash
eas init                                  # sets EAS_PROJECT_ID (put it in .env / eas secrets)
eas build --profile development --platform all
eas build --profile preview    --platform android   # APK you can sideload
eas build --profile production --platform android   # AAB for Google Play
eas build --profile production --platform ios       # then: eas submit --platform ios  (TestFlight)
```
Update `eas.json > submit` with your App Store Connect app id. Bump `version` in `app.config.ts` for releases
(build numbers auto-increment).

## 5. Store-review items to handle
- **Account deletion** is built in (Profile > Delete Account), required by Apple and Google Play.
- **Apple guideline 4.8**: apps offering Google sign-in must also offer an equivalent privacy-preserving login.
  You asked for Google + email only. Email/password is your own account system, which many apps ship with, but
  review outcomes vary; if Apple objects, Sign in with Apple is the standard fix.
- Provide a Privacy Policy URL and complete the Play "Data safety" and App Store "Privacy" forms (email, name,
  push token, analytics events, user-submitted testimonies).
- Replace the Google "G" icon with Google's official asset; replace placeholder logo/icons.

## 6. Known limits / decisions
- **HLS videos can't be downloaded** for offline use (they're many segments). MP4/file resources can.
- Downloads are stored in the app's private storage (no storage permissions needed) and are deleted if the app is uninstalled.
- Firebase Auth's session is persisted with AsyncStorage (Firebase's supported RN approach).
- Deep links arriving while signed out are dropped (user lands on Welcome).
- Search is client-side over the newest 100 items; use server-side search if the catalogue grows large.
- Dark theme only (matches the site's purple/dark identity; add a light palette in `theme.ts` if the site has one).
- Expo SDK 54 is pinned (`expo-file-system/legacy` API, `expo-video`). Upgrade SDKs later with `npx expo install --fix`.
- Not device-tested: the project type-checks and bundles for Android and iOS with Metro, but has not been run on a phone.
