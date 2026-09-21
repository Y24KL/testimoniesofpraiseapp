# For version 2.0 (needs the paid Firebase Blaze plan)

These are ready to use when you upgrade. They are NOT part of the free launch.

- `functions/`: Cloud Functions that send push notifications automatically on the server (publish, go live, announcements) with duplicate protection. It replaces the Cloudflare relay.
- `storage.rules`: security rules for Firebase Storage (admin-only uploads).

## To switch
1. Upgrade the Firebase project to Blaze (and set a budget alert).
2. `firebase deploy --only functions` after copying `functions/` back to the project root and adding
   `"functions"` (and `"storage"`) entries back into `firebase.json`.
3. In `web/.env` **remove `VITE_PUSH_URL`**, otherwise the portal AND the functions would both send a push.
   (The functions and the portal both skip a testimony that already has `pushSentAt`, but live and announcement pushes would double.)
4. Re-add Firebase Storage upload code to the portal editor in place of `web/src/uploads.ts` (Cloudinary), or keep Cloudinary.
