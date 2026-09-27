# Testimonies of Praise: mobile app (Android + iOS)

React Native + Expo (SDK 54) + TypeScript. One codebase, native UI, no WebView.
Auth: Google + Email/Password only. Data: your EXISTING backend (Firebase by default, REST optional).

> **Read `docs/SETUP.md` first.** It lists exactly what you must configure (Firebase keys, Google OAuth
> IDs, collection names, logo/colors) and what could not be verified when this project was generated.

## Quick start
```bash
npm install
cp .env.example .env        # fill in Firebase + Google values
npm run typecheck           # should pass
npx eas-cli login && npx eas-cli init     # writes your EAS project id
npm run build:android:dev   # dev build (Google sign-in + push don't work in Expo Go)
npm run start               # then open the dev build on your phone
```

## Structure
```
src/
  api/            repository interface + Firestore & REST implementations + field normalisers
  auth/           AuthContext (Firebase Auth: email/password, Google credential, reset, delete)
  components/     TopBar, BottomNavigation, TestimonyCard, VideoCard, DownloadButton,
                  LoadingSpinner, LoadingPraise, SkeletonCard, EmptyState, ErrorState, PrimaryButton,
                  GoogleButton, NotificationCard, LiveCard, TestimonySubmissionForm, ...
  screens/        Welcome, EmailAuth, ForgotPassword, NotificationPrimer, Home, Testimonies,
                  TestimonyDetails, Live, Downloads, ShareTestimony,
                  Notifications, NotificationSettings, Profile, Search
  navigation/     root stack (auth / onboarding / main), tabs, deep-link config
  downloads/      offline downloads (progress, cancel, retry, duplicates, storage checks, persistence)
  video/          expo-video player (HLS/MP4, resume, error state, local files)
  notifications/  permission, token registration, tap routing (cold start + foreground)
  offline/ storage/ analytics/ hooks/ context/ utils/ constants/ types/
backend-reference/  Firestore rules, indexes and push Cloud Functions to MERGE into your backend
docs/SETUP.md       configuration + release checklist
```

## Requirements coverage
| Area | Status |
|---|---|
| Google + Email/Password auth, forgot password, session persistence, logout | Implemented (needs your Firebase + OAuth config) |
| Home, Testimonies, Details, Live, Downloads, Profile, Search | Implemented (Resources live on the website only) |
| Share Your Testimony | Implemented, **confirm the submission collection/fields match the website** |
| Live stream from Admin-controlled config (real-time), LIVE NOW / offline states | Implemented, **confirm the live doc path/fields** |
| Downloads gated by `isDownloadable`, progress/cancel/retry, offline playback | Implemented. HLS (.m3u8) videos can't be saved offline (many segments) |
| Offline banner, cached metadata, downloads open offline | Implemented |
| Push notifications (Expo Push -> FCM/APNs), preferences, tap -> exact screen | App side implemented; **server side is in `backend-reference/` and must be deployed** |
| Deep links `testimoniesofpraise://testimony/{id}`, `live` | Implemented |
| Analytics (app open, video play/complete, downloads, notification opens) | Implemented; Admin Portal must read `analyticsEvents` to display it |
| APK / AAB / TestFlight config | `app.config.ts` + `eas.json` ready; **builds must be run by you** (needs your Expo/Apple/Google accounts) |
