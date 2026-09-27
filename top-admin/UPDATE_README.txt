TESTIMONIES OF PRAISE — ADMIN PORTAL UPDATE
Adds: YouTube live-stream support with a moderation-ready live chat panel, and a
Sponsorships page for reviewing bank-transfer receipts submitted from the app.

This is a FULL replace, EXCEPT your .firebaserc and web/.env — neither is included here,
so your project ID and Firebase keys are untouched either way.

STEPS

1. Copy everything from this zip into your top-admin folder, choosing "Replace" for every
   file it asks about. This replaces firebase.json, firestore.rules, firestore.indexes.json,
   README.md, and the whole web/ and worker/ and later-v2/ folders.
   It will NOT touch .firebaserc or web/.env, since those aren't in this zip.

2. Deploy the updated rules — REQUIRED, or the new chat and sponsorship pages will show
   permission errors:
     firebase deploy --only firestore

3. Restart the portal:
     cd web
     npm run dev

WHAT'S NEW
- Live page: the stream link field now accepts YouTube as well as HLS .m3u8 (this part may
  already be on your machine from an earlier update — this zip supersedes it either way).
- Live page, while a stream is live: a "Live chat" panel appears showing every message in
  real time, with a Delete button on each one, and a "Reported" tab for messages users have
  flagged from the app.
- New "Sponsorships" page in the left menu: shows each bank-transfer submission with its
  receipt photo, amount and note, with Approve / Reject buttons.

A NOTE ON THE BANK DETAILS
The bank account shown on the app's Sponsor screen is NOT set here — it's set in the mobile
app's .env (EXPO_PUBLIC_BANK_NAME / ACCOUNT_NAME / ACCOUNT_NUMBER). See the mobile app
update's instructions for that.
