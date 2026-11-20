# T.O.P. 2.0: Phase 1 status

Date: 2026-11-18. Builds on `docs/PHASE0_AUDIT.md`. Nothing here is deployed. Everything below is tested locally.

## Verification (run on 2026-11-18)

| Suite | Result |
|---|---|
| `npm run typecheck` (app) | Passes |
| `top-admin/web` `tsc --noEmit` | Passes |
| App unit suites: voiceover, profile validation, comment text, choir request, feedback, discovery | Pass |
| `npm run test:rules` (Firestore emulator, production rules file) | Passes: comments 20, profile 17, choir 21, lyrical 13, feedback 24, notifications 22, engine 25 |
| Worker `npm test`: relay, CORS, auth, AI, Praxiom client, Praxiom on Praxiom, engine policy (32), engine end to end (23) | Passes |
| `wrangler deploy --dry-run` | Builds. Lists the `PRAXIOM_GATE` Durable Object binding and the 15-minute cron trigger |

## What is implemented

**Safety and rules**
- `pushTokens` accepts only known fields, with types and bounds (audit S2). Engine collections accept no client writes, except the admin's approve and cancel on queue entries, and the kill switch.
- `analyticsEvents` is validated (audit S3).
- Personal discovery: `user_activity` (owner write, owner read and delete, fixed fields) and `users/{uid}/private/discovery` (owner only, allowlisted tags).

**Praxiom client** (`top-admin/worker/src/praxiom.js`, `praxiomGate.js`, `praxiomPolicy.js`)
- Account-wide concurrency gate: 2 chat requests in progress, held in a Durable Object with lease expiry.
- Bounded retries for transient failures (429 and 503), honouring `Retry-After`. Never retried: 402, 401, timeouts, and the gate's own busy error.
- Optional `Idempotency-Key` per logical request.
- `structured.js`: model output is parsed and checked against a schema in code.

**Notification engine** (`top-admin/worker/src/engine/`, run by the cron trigger)
- Detection: new testimonies, articles, lyrical analyses (by status), and live broadcasts (one per session).
- Queue: every candidate becomes an entry that waits for admin approval. The entry id is the dedupe key, and it is created atomically, so the same event cannot be queued twice.
- Copy: deterministic templates. AI copy is validated by `copy.js` (no links, no urgency, no overclaims, numbers must come from the source, must name the content) but is **not yet proposed by any code path**.
- Delivery: one record per person per entry. A person who has been sent, capped, or found without a device is never sent the same entry again. Quiet hours defer; caps are per person per day.
- Dead tokens are removed on a `DeviceNotRegistered` ticket or receipt.
- Receipts are read on each run, and a delivery is recorded only once all its tickets have receipts.
- Kill switch: `settings/notifications.enabled` is read at the start of each run and again before every entry. Missing or false means nothing runs. Each category can be switched off.
- First run only sets the cursor, so existing content is never announced.
- A lock document stops overlapping runs.

**Admin Portal**: a Notification centre page (`top-admin/web/src/pages/NotificationCentre.tsx`). It holds the kill switch, quiet hours, daily caps, category switches, the approval queue, and delivery history.

**App**
- Push registration sends only the seven known preference keys.
- Viewing a testimony records a minimal `view` event, unless the person has opted out.
- `src/discovery/` holds the rules, the activity writer, and the interests and opt-out service.

## Decisions taken in this build

- **Engine runs on the Worker**, on a 2-minute cron, with no Blaze upgrade (decision D1, recommended).
- **Admin approval is required for every notification** (decision D4, recommended).
- **Engine identity changed from Phase 0's recommendation.** Phase 0 proposed a scoped system uid (S6). This build uses the Worker's existing service account, through an OAuth token (`googleAuth.js`). Like the Firebase Admin SDK, it bypasses rules. The reasons: the secret is already in the Worker, a custom-token route would need a Web API key that isn't configured, and all client access to engine collections is still denied by rules. The engine code is the only writer. If you want stricter isolation, a scoped identity can replace it later.
- **Quiet-hours default** when unset: 22:00 to 07:00 local time. **Daily cap** when unset: 3 per person.
- **Lyrical analyses** are sent under the `announcements` category.

## Deployment order (not yet run)

1. **Rules.** Confirm which rules file is deployed (audit S4). Then `firebase deploy --only firestore:rules` from `top-admin`.
2. **Indexes.** `firebase deploy --only firestore:indexes`. The engine needs the two composite indexes added in `firebase.indexes.json`. Queries will fail until they build.
3. **Worker.** From `top-admin/worker`: `npm test`, then `npm run deploy`. The first deploy creates the `PraxiomConcurrencyGate` class (migration `praxiom-gate-v1`). Check that Durable Objects are available on your Cloudflare plan. No new secrets are needed beyond `FIREBASE_SERVICE_ACCOUNT` and `FIREBASE_PROJECT_ID`, which already exist.
4. **Stay off until verified.** `settings/notifications` is created with `enabled: false` by the Notification centre. Turn the engine on only after a staging test.
5. **Staging test.** Publish a test testimony. Confirm it appears in the queue as pending and nothing is sent. Approve it. Confirm delivery to a test device only. Turn the engine off and confirm nothing sends.

The app build with these changes needs a new release. Until it ships, the old app keeps working: the new token fields are optional, and the rules accept the old shape.

## Known limits

- **AI copy is not wired.** The validator exists and is tested. No call to Praxiom is made from the engine yet, so every message uses the template.
- **Scale.** Each entry loads all devices in its category (up to 5,000) and writes one record per person. This is fine at current size. It will need paging and batching before the audience grows much larger.
- **Lock is not atomic.** Expiry takeover is a read-then-write. Two runs starting at the same instant could both proceed. Per-person records still prevent duplicate sends, but the lock should become a transaction later.
- **Counters are read in full** each run (users with a send in the last 24 hours).
- **Receipts** are read in batches of 300 per run.
- **No retention job yet.** Queue, delivery and activity records are kept indefinitely. The Phase 0 retention policy still needs a scheduled cleanup.
- **Personalisation UI is not built.** There are no Home discovery sections, no interests screen, and no opt-out or "clear my history" control in the app. The services and rules for these exist.
- **Wednesday LoveWorld Radio** is not in the repo. It needs your confirmed schedule.

## Still open from Phase 0

- **S1**: the hardcoded OTP pepper fallback is unchanged. Set the `OTP_PEPPER` secret first, then remove the fallback.
- **S4**: the two rules files still differ. Confirm the deployed one before merging.
- **Praxiom**: live checks of the tool-call shape, `json_schema`, and streaming with tools still need a test key.
- **Praxiom concurrency limit**: the support request must come from the account owner.
