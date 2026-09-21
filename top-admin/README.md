# Testimonies of Praise: App Admin Portal (FREE launch edition)

A web dashboard for running the **mobile app** at **$0 and no credit card**, until you upgrade to
version 2.0. Staff publish testimonies, control the live stream, review submissions and send
announcements. The app updates within seconds.

```
Admin Portal (web/) ──▶ Firebase FREE plan (Auth + Firestore) ◀── Mobile app
       │                                                            ▲
       ├─▶ Cloudinary (free) ........ hosts uploaded videos/images ─┘ (links)
       └─▶ Push relay (worker/, free Cloudflare Worker) ─▶ Expo push ─▶ phones
```

## What is free, and what changed from the original plan
| Need | Free-mode solution | Limits to know |
|---|---|---|
| Login, database | Firebase **Spark** plan (no card): Authentication + Firestore | Firestore: 50,000 reads and 20,000 writes per day. If you hit a cap, that service pauses until the next day. |
| Videos and thumbnails | **Cloudinary** free plan (no card), uploaded from the portal, or paste any link | 25 monthly credits shared by storage + bandwidth (video bandwidth 1 GB per credit); videos up to 100 MB each. |
| Push notifications | **Cloudflare Worker** relay (free, no card) + Expo's free push service | Worker: 100,000 requests/day. Pushes only go out when sent **from the portal**. |
| Hosting the portal | Firebase Hosting (free) or just run it on your computer | |
| ~~Firebase Storage / Cloud Functions~~ | **Not used.** Both need the paid Blaze plan. | Kept in `later-v2/` for version 2.0. |

> **Honest note on video:** free video hosting is the weak point. Cloudinary's free allowance is roughly 25 GB
> of viewing per month in total, so around 250 views of a 100 MB video. That's fine to launch with a small
> congregation, but plan to move videos to a proper host (or Firebase Storage on Blaze) for 2.0.

## Setup (about 45 minutes)

### 1. Create the Firebase project (free)
1. https://console.firebase.google.com → **Add project** (e.g. `testimonies-of-praise-app`). **Stay on the Spark plan. Do NOT upgrade.**
2. **Authentication → Get started → Sign-in method:** enable **Email/Password** and **Google**.
3. **Firestore Database → Create database →** production mode, pick a region close to your users.
4. Project settings (gear) → **Your apps → Add app → Web (`</>`).** Copy the config. Also **Add app → Android** with package `com.testimoniesofpraise.app` and put its `google-services.json` in the mobile app folder.
   (Skip "Storage": it needs a paid plan.)

### 2. Deploy the database rules
```bash
npm install -g firebase-tools
firebase login
copy .firebaserc.example .firebaserc     # put your project ID inside
firebase deploy --only firestore
```

### 3. Create your admin login
1. **Authentication → Users → Add user** (your email + a strong password). Copy the **User UID**.
2. **Firestore Database → Start collection** `admins`, Document ID = that UID, one field `email` (string).

### 4. Cloudinary (video/image uploads)  *optional but recommended*
1. Sign up free at https://cloudinary.com (no card). On the dashboard note your **Cloud name**.
2. **Settings → Upload → Upload presets → Add upload preset.** Set **Signing mode = Unsigned**. Under upload restrictions allow only images and videos and set a max file size (video 100 MB). Save and note the **preset name**.
3. You'll paste both into `web/.env` in step 6.
Without this step the portal still works: admins paste video and image links instead.

> The preset is visible inside the portal's code, so anyone who found it could upload files into your account.
> Restricting formats and sizes in the preset limits abuse. Running the portal only on your own computer
> (step 6) avoids it entirely.

### 5. Push relay  *optional but recommended*
Without it, publishing still works and the item appears in the app's Notifications list, but **no push** is sent to phones.
1. Sign up free at https://dash.cloudflare.com (no card needed).
2. Open `worker/wrangler.toml` and set `FIREBASE_PROJECT_ID`, and in `ALLOWED_ORIGINS` your portal addresses (`http://localhost:5173` plus `https://YOUR-PROJECT-ID.web.app` if you host it).
3. Deploy:
   ```bash
   cd worker
   npm install
   npx wrangler login
   npx wrangler deploy
   ```
   It prints a link like `https://top-push-relay.YOURNAME.workers.dev`. That is your `VITE_PUSH_URL`.
4. **Android push credentials (free):** Firebase → Project settings → **Service accounts → Generate new private key**, then upload that file to Expo with `eas credentials` (Android → Google Service Account → FCM V1). Test on a real phone.

### 6. Run the portal
```bash
cd web
copy .env.example .env
notepad .env       # fill the 6 VITE_FIREBASE_* values, plus the Cloudinary and VITE_PUSH_URL lines if you did steps 4-5
npm install
npm run dev        # http://localhost:5173
```
To let your team use it from anywhere (free):
```bash
npm run build
cd ..
firebase deploy --only hosting      # https://YOUR-PROJECT-ID.web.app  (add this address to ALLOWED_ORIGINS and redeploy the worker)
```

### 7. Connect the mobile app
In the app's `.env` fill the `EXPO_PUBLIC_FIREBASE_*` values with the same project's web config. Copy the two files
in `mobile-app-updates/src/` over the same paths in the app (bug fixes + an optional switch `EXPO_PUBLIC_ANALYTICS=off`).
Restart with `npx expo start --dev-client -c`.

## How publishing works in free mode
| In the portal | In the app |
|---|---|
| Publish a testimony | Appears immediately. The portal sends **one** push (duplicate-protected) and adds it to the Notifications list. |
| Unpublish / delete | Disappears from the app |
| GO LIVE / END STREAM | Live tab flips instantly; going live sends one push |
| Announcement | Notifications list + push |
| Someone shares a testimony in the app | Appears in **Submissions**; nothing is public until you publish it |

Pushes are sent by the portal, so **editing data directly in the Firebase console sends no push**. Publish from the portal.

## Staying inside the free limits
- Firestore reads come from people opening the app (about 20-30 reads per open). Roughly **1,500-2,000 app opens per day** is the comfortable ceiling before the 50,000 read cap. The app caches the first page, so people still see recent content if the cap is hit.
- Analytics events cost writes. Set `EXPO_PUBLIC_ANALYTICS=off` in the app to stop them if you get close to 20,000 writes/day.
- Watch usage in Firebase → Firestore → Usage. If you outgrow it, that's the signal for version 2.0.

## Data model (Firestore)
`testimonies`, `settings/live`, `notifications`, `testimonySubmissions`, `pushTokens/{token}`, `analyticsEvents`, `admins/{uid}`.
Field lists are in `firestore.rules` and the types in `web/src/types.ts`.

## Security notes
- App users only read **published** testimonies. Drafts, submissions, device tokens and analytics are admin-only.
- Admin = a document at `admins/{uid}`, which no browser or app can create.
- The push relay holds no secrets and only works for signed-in admins (it reads the device list with the caller's own token; Firestore refuses anyone else).
- Firebase web keys are meant to be public; the rules protect the data. Keep the admin list short.

## Not tested against live services
The portal, the relay logic (automated offline test: `cd worker && node test.mjs`) and the app all compile and pass their checks, but I couldn't
run them against your real Firebase, Cloudinary or Cloudflare accounts. Try every page on a test project first.

## Version 2.0 upgrade path
See `later-v2/README.md` (Firebase Storage + Cloud Functions on the Blaze plan).
