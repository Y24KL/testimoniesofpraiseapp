# Notification system audit: root causes (2026-11-22)

Phase 0 of "Notification System 3.0". Everything below was checked against production on 2026-11-22
(read-only Firestore queries, Cloudflare API, Worker logs), not inferred from code alone.

## 1. Infrastructure facts

| Check | Result |
|---|---|
| Workers in the Cloudflare account | `top-push-relay` (notifications, AI, media, auth) and `mediablastnetworkweb` (unrelated website). **One notification engine.** |
| Deployed version vs repo | Live `2.11.0` = `top-admin/worker` at the latest worker commit (`b0ef681`). A stale local `worker-live/.wrangler` cache folder was deleted. |
| Cron | `*/2 * * * *`; runs complete with `Ok` and engine summaries in the logs. |
| Engine config (`settings/notificationEngine`) | enabled; `copyMode: review`; `targeting: everyone`; `aiCopy` default on. |
| Accounts vs devices | **13 user profiles, 5 registered devices** (all Android, one per person, none iOS, none with an FCM token). |
| Delivery today | 15 queued → 14 accepted by Expo → **14 receipts `ok`**; 1 `InvalidCredentials` (old build). |
| Delivery all time (sample) | 45 receipts `ok`, 7 `DeviceNotRegistered` (tokens removed), 15 `InvalidCredentials` (one wrong-project phone). |
| `notificationSettings/{uid}` docs | 0: the server uses the legacy `pushTokens.prefs` for everyone. |
| Private inbox `users/{uid}/notifications` | 0 docs; the public feed `notifications` has 14. |
| Campaigns awaiting approval | 0. No content campaign has been drafted by Praxiom yet (only announcements and live since Phase 3c, which are never drafted). |

## 2. Root causes, in order of impact

1. **Pushes reach phones but are not shown while the app is asleep (Android).** Expo delivers Android pushes as
   FCM *data* messages; `expo-notifications` must start the app to draw them (it reads `data.title` /
   `data.message`). Battery savers and auto-start limits (Tecno, Infinix, itel, Xiaomi, Samsung) keep the app
   asleep, so the notification appears only when the app is opened. Evidence: every recent push has an Expo
   receipt `ok`; users saw them only on opening the app. *Server fix deployed (2.11.0: FCM notification messages
   for phones that register an FCM token); needs the new APK to register those tokens.*
2. **Most accounts never registered a device (8 of 13).** The app registers only when permission is *already*
   granted and only when the signed-in user changes; permission is requested once, on the first-run primer.
   Anyone who skipped it, denied it, reinstalled, or hit a network error during registration is never registered,
   and failures are swallowed (`.catch(() => undefined)`), with no retry, no foreground re-check and no record.
3. **No device metadata.** Tokens carry no app version, timezone, permission state or channel version
   (`app=?`, `tz=?`), so neither admins nor the engine can tell which build or channel a phone has.
4. **The Android channel `default` cannot be repaired from code.** If a phone ever created or the user changed it
   to silent/low (the "silent notification" report), raising importance in code is ignored by Android. A new
   channel id is the only fix, and the server must use it only for builds that create it.
5. **Two preference stores.** The app saves preferences on each token (`pushTokens.prefs`); the engine prefers
   `notificationSettings/{uid}` (never written). Works today by accident; needs one source of truth.
6. **Two inboxes that never meet.** The app's Notifications screen reads the public `notifications` feed. The
   engine's per-person inbox `users/{uid}/notifications` is never shown (and never written, because the "app is
   open" signal `lastActiveAt` is never sent).
7. **No way to prove delivery end to end.** There is no admin "test to my device", no device list, and campaign
   counts stop at Expo acceptance; receipts are recorded per item but not surfaced.
8. **Praxiom has not run on real content.** Copy mode is `review`; drafting only happens for published content,
   and none has been published since Phase 3c. Targeting is set to `everyone`.
9. **iOS is unverified.** No iOS device has ever registered; APNs credentials on EAS have not been checked.
10. **Wrong-project build.** One phone keeps failing with `InvalidCredentials`; it is retired after 3 failures
    since 2.9.0.

## 3. What was ruled out

- Worker not running / cron not firing: runs every 2 minutes with clean logs.
- Expo or Google rejecting pushes: receipts are `ok`.
- Daily limit, quiet hours or targeting holding announcements: today's live/urgent sends were all sent
  immediately (`deferred` 0).
- A second engine or old Worker sending: only one notification Worker exists.
- Missing Firestore indexes for engine queries: every engine query ran today without index errors.

## 4. Fix plan (Notification System 3.0)

| Step | Scope | Needs APK |
|---|---|---|
| **A** Admin: **Send test to my device** + device list + failure classification + pipeline stages per campaign | admin, worker | no |
| **B** Registration rebuild: ask/resume permission, register on launch, foreground and permission change, retry with backoff, record app version, timezone, permission, channel; registration state on the device and in Firestore | app | yes |
| **C** Channel migration to a new high-importance channel, used by the server only for builds that create it | app, worker | yes |
| **D** One preference source (`notificationSettings/{uid}`), synced from the new settings screen, legacy prefs kept as fallback | app, worker, rules | yes |
| **E** Unified inbox: public feed + private inbox + support messages, read/unread, mark all read; `lastActiveAt` for the in-app channel | app, web, rules | yes |
| **F** Notification settings centre (master switch, categories incl. written/daily discovery, frequency 1/3/5, quiet hours, preferred time, digest, snooze, device health, diagnostics) | app, web | yes |
| **G** Praxiom planning: per-item analysis (category, audiences, individual vs digest), copy variants per interest group with one variant per person, automatic mode by default with template fallback, daily digest, continue-watching and live reminders | worker, admin | no (server) |
| **H** Observability: stage counters (opportunity → campaign → draft → audience → queued → accepted → receipt → opened → content opened), Praxiom vs template rates, filters | worker, admin, app | partly |

Physical-device tests (registration, foreground/background/terminated, multi-device, permission off/on) can only
be run by the team on real phones after the new APK; the admin test tool in step A makes each one observable.
