# T.O.P. 2.0: Phase 1 status (part 1)

Date: 2026-11-18. Builds on `docs/PHASE0_AUDIT.md`.

This records what is implemented and tested now, what is not, and what must happen before anything is deployed.
Nothing here has been deployed. Tests run locally, and the Firestore rules run against the emulator.

## Implemented and tested

| Item | Where | Tests |
|---|---|---|
| Push-token rules (S2): allowlisted fields, Expo token format, typed preferences, bounded timezone and UTC offset, server timestamp | `top-admin/firestore.rules` (`validPushToken`) | `tests/notifications.rules.test.mjs` (13 cases) |
| Analytics rules (S3): snake_case event name, bounded params, own uid or null, server timestamp, no client reads | `top-admin/firestore.rules` (`analyticsEvents`) | `tests/notifications.rules.test.mjs` (9 cases) |
| App sends only the seven known preference keys, so a stray stored key cannot make token registration fail silently | `src/storage/prefs.ts` (`pushPrefsPayload`), `src/notifications/push.ts` | `npm run typecheck` |
| Praxiom account-wide concurrency gate (2 chats in progress), as a Durable Object, with lease expiry | `top-admin/worker/src/praxiomGate.js`, `wrangler.toml` | `test-engine.mjs` |
| Praxiom bounded retries (429 concurrency and rate limits, 429 capacity, 503), honouring `Retry-After`, never on 402, 401, timeouts or our own gate | `top-admin/worker/src/praxiomPolicy.js`, `src/praxiom.js` | `test-engine.mjs`, `test-praxiom.mjs` |
| Optional `Idempotency-Key` per logical chat request | `src/praxiom.js` | `test-engine.mjs` |
| Validated structured output (schema in code; unknown keys refused; bounded text) | `top-admin/worker/src/structured.js` | `test-engine.mjs` |
| Engine policy: quiet hours in local time (wrapping midnight), daily and per-category caps, kill switch that fails closed, duplicate keys, enqueue rules | `top-admin/worker/src/engine/policy.js` | `test-engine.mjs` |
| Audience selection: usable devices only, preference filter, token de-duplication, caps per person, quiet-hours deferral | `top-admin/worker/src/engine/audience.js` | `test-engine.mjs` |
| AI copy validation: schema, no links or emails, no urgency or overclaims, numbers must come from the facts, must name the content, no shouting | `top-admin/worker/src/engine/copy.js` | `test-engine.mjs` |

Results on 2026-11-18:
- `npm run test:rules`: all suites pass, including the 22 new notification cases.
- Worker `npm test` (now includes Praxiom and engine tests): passes.
- Root `npm run typecheck` and the app unit suites: pass.
- `wrangler deploy --dry-run`: bundles, and lists the `PRAXIOM_GATE` Durable Object binding.

## Not implemented yet (remaining Phase 1)

- **Engine wiring.** The cron scan of new content, the queue store with atomic `dedupeKey` writes, the send-time re-check of caps, the sender with bounded retries, receipt polling and invalid-token cleanup, and the Admin Portal kill switch. The pure logic exists and is tested; the Firestore and Worker wiring does not.
- **Activity and interests** (`user_activity`, `users/{uid}/private/discovery`) and the privacy controls.
- **Discovery sections** on Home.
- **Admin AI Control Centre** pages.
- **Security S1** (hardcoded OTP pepper fallback). Not changed: removing the fallback before the `OTP_PEPPER` secret is set would break sign-in codes.
- **S4** (two divergent Firestore rules files). Not merged: the deployed file has not been confirmed.

## Deployment steps (not yet run)

1. Confirm the Firestore rules file in use. Then deploy the rules from `top-admin` with `firebase deploy --only firestore:rules`, after the emulator suite passes.
2. Deploy the Worker from `top-admin/worker` with `npm test` first, then `npm run deploy`. The first deploy creates the `PraxiomConcurrencyGate` class from the migration tag `praxiom-gate-v1`. No new secrets are needed.
3. Until the Worker is deployed, the app keeps working: the new token fields are optional and the new rules accept the existing shape.
4. Verify on a staging project before production: a token registration from a device, an analytics event, and two concurrent assistant questions (the third should get a short "busy" message, not an error page).

## Decisions still open (from Phase 0)

D1 (engine in the Worker), D4 (admin approval of AI copy), the Wednesday LoveWorld Radio slot, and the Praxiom concurrency-limit support ticket. The engine wiring waits on D1 and D4.
