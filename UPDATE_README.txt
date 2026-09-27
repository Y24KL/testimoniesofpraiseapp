TESTIMONIES OF PRAISE — MOBILE APP UPDATE
Adds: YouTube live streaming, live chat during a stream, a first-time welcome screen,
email verification (link-based), and a Sponsor / bank-transfer screen with receipt upload.

This is a FULL replace of your project's code, EXCEPT your assets, .env, google-services.json,
GoogleService-Info.plist, and top-admin — none of those are touched or included here.

STEPS

1. Install the three new packages this update needs:
     npx expo install react-native-webview expo-image-picker expo-clipboard

2. Copy everything from this zip EXCEPT the 'assets' folder (you don't have one here — keep
   your existing assets folder untouched) into your project, choosing "Replace" for every
   file it asks about. That means replacing:
     app.config.ts, eas.json, index.ts, metro.config.js, package.json, tsconfig.json,
     README.md, docs/, backend-reference/, and the whole src/ folder.
   Do NOT let this touch: assets/, .env, google-services.json, GoogleService-Info.plist,
   top-admin/, android/, ios/ — none of those are in this zip, so a normal folder copy
   won't remove them either way.

3. Open your .env and add these new lines (see .env.example in this zip for the full list
   with comments):

     EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=
     EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
     EXPO_PUBLIC_BANK_NAME=Parallex Bank
     EXPO_PUBLIC_BANK_ACCOUNT_NAME=Testimonies of Praise
     EXPO_PUBLIC_BANK_ACCOUNT_NUMBER=0000000000

   - The Cloudinary two lines: reuse the SAME cloud name + unsigned upload preset you set up
     for the admin portal (top-admin/web/.env's VITE_CLOUDINARY_*) — same values, just with
     the EXPO_PUBLIC_ prefix instead of VITE_. Without these, the Sponsor screen's upload
     button is disabled with a message saying so; nothing else breaks.
   - The three BANK_ lines: replace with the REAL Parallex account name and number before
     anyone uses this for real. Right now they show placeholder text.

4. This update adds a native module (react-native-webview), so a reload isn't enough —
   rebuild and reinstall:
     npm run build:android:dev
   then install the new APK on your phone the same way as before (uninstall the old one first
   if you hit "invalid package" again).

5. Restart the dev server:
     npx expo start --dev-client -c

WHAT'S NEW, IN THE APP
- Live tab: YouTube links now play (as well as HLS .m3u8, as before), and a live chat box
  appears under the stream while it's live. Long-press any message to report it.
- New accounts see a one-time welcome screen right after signing up.
- Password accounts see a banner reminding them to verify their email, with Resend and
  "I've verified" buttons, until they tap the link Firebase emails them.
- Profile → "Sponsor Testimonies of Praise": shows the bank details (with copy buttons),
  lets someone attach a receipt photo and submit it.

REQUIRES ON THE FIREBASE SIDE
- The updated Firestore rules (from the admin portal package) must be deployed, or the new
  chat and sponsorship features will show a permissions error. See the admin portal update.
