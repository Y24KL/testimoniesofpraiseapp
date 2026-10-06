THIS UPDATE (full replace, same as previous full updates)

A) New "Data" page in the left menu:
   - Download everything: one JSON file with every testimony, submission, notification,
     sponsorship, push token, and analytics event (NOT admin accounts, NOT live chat, NOT live
     viewer presence — identity data and transient data are deliberately excluded).
   - Reset everything: permanently deletes all of the above, PLUS live chat and live viewer
     records, and puts the live stream back to offline. Admin accounts are NEVER touched — you
     cannot lock yourself out this way. Requires typing "DELETE EVERYTHING" to confirm. This is
     irreversible and makes no backup — download the data first if you want one.

B) Live stream page now shows "👁 X watching now" next to LIVE NOW, counting app users who have
   the Live tab open while the stream is live (a lightweight heartbeat from the app, refreshed
   every 20s; counts someone from the moment they open that tab, not from confirmed playback).

STEPS
1. Copy everything in this zip into your top-admin folder, choosing Replace. Does NOT touch your
   .firebaserc or web/.env.
2. REQUIRED: deploy the updated rules (new liveViewers rules, and admins can now delete analytics
   events and any push token — needed for the reset tool to work):
     firebase deploy --only firestore
3. Restart: cd web && npm run dev
