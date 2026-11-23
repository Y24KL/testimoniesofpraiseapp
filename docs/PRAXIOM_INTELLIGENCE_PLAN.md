# Praxiom Intelligence Ecosystem: Phase 1 architecture and policy

Date: 2026-11-21. Builds on `PHASE0_AUDIT.md` and the Phase 1–4 status reports. This document is the Phase 1
deliverable of the "Praxiom AI Intelligence Ecosystem" brief: audit, data structures, policies, and the build
order. It records what exists, so later phases extend it rather than duplicate it.

## 1. What exists today (verified 2026-11-20/21)

### 1.1 Two worker lineages: the most important finding

| | Live in Cloudflare (`top-push-relay` 2.5.1) | Repo `top-admin/worker` (2.4.0) |
|---|---|---|
| Source | `top-admin/worker-live/src/index.js` (bundle downloaded from Cloudflare on 2026-11-20; no other source exists) | `top-admin/worker/src/*.js` |
| Notification engine | `src/notify/*`: campaigns → per-user queue → ledger, per-user settings, delivery windows, caps, quiet hours, in-app channel, receipts, **web push (VAPID)** | `src/engine/*`: cursor scan → admin approval queue → send. **Never deployed.** |
| Collections | `notificationCampaigns`, `notificationQueue`, `notificationLedger`, `notificationStats`, `notificationSettings/{uid}`, `settings/notificationEngine` (config), `users/{uid}/notifications` (inbox) | `notification_queue`, `notification_history`, `settings/notifications`, `settings/notificationEngine` (cursor) |
| Praxiom client | Older: no concurrency gate, no retries | Newer: Durable Object gate (2 in flight), bounded retries |
| Assistant tools | 3 (`search_testimonies`, `search_clips`, `open_screen`) | 7 (adds `search_lyrical`, `search_articles`, `get_live_status`, `list_recent`) |
| AI notification copy | None | `engine/copy.js`: schema + fact checks, template fallback |
| Endpoints | adds `/api/notifications/dispatch`, `/api/notifications/vapid-key`, event POST | — |

The admin **Notification Centre** reads the repo engine's collections, so it shows nothing for the live engine
("Last engine run: not yet"). Phase 1–4 status reports all say "nothing here is deployed" for the worker.

**Decision (recommended, see §8 B1):** one worker. Base it on the repo worker (newer assistant, Praxiom gate),
port the live `notify` engine into it as source modules, and retire `worker/src/engine` and the
`notification_queue` / `notification_history` collections. The live engine is running, already has
per-user settings, caps, ledger, receipts and web push, and is what phones currently receive.

### 1.2 Personalization data that already exists

| Data | Where | Used for ranking today? |
|---|---|---|
| Interests (10 allowlisted tags: healing, worship, family, finances, faith, youth, marriage, deliverance, hope, missions) + `optOut` | `users/{uid}/private/discovery` (owner only, rules-validated) | **No** |
| Activity events (`view`, `play`, `complete`, `save`, `open_notification`) | `user_activity` (create-only, 90-day intent) | **No** |
| Listening/viewing history with position, cross-device resume | `users/{uid}/history` | Shown in My T.O.P. only |
| Saved items and collections | `users/{uid}/saved`, `users/{uid}/collections` | Shown in My T.O.P. only |
| Per-user notification signals (`counts`, `opened`, `seen`) | `notificationSettings/{uid}.signals` (live engine) | Live engine relevance score only |
| Push tokens + legacy category prefs | `pushTokens/{token}` | Live engine falls back to these when no `notificationSettings` doc exists |
| Testimony embeddings | `testimonies.aiEmbedding` (bge-m3, 1024-d, vector index) | Search only |

### 1.3 Content metadata gap

Testimonies carry a free-text `category` and `keywords`. Interests are 10 fixed tags. **Nothing maps one to the
other**, so "recommended because you enjoy healing testimonies" cannot be computed reliably today. Articles and
lyrical analyses have no embeddings.

### 1.4 Home screens

- App (`src/screens/HomeScreen.tsx`): time-of-day greeting, live/featured hero, `DailyDiscovery` (editorial,
  same for everyone, by weekday), Explore, latest lists. No For You, no Continue.
- Web (`web/src/pages/HomePage.tsx`): greeting with first name, hero, latest lists. No daily discovery.
- My T.O.P. (`src/screens/MyTopScreen.tsx`): saved, collections, history (the "continue" data exists here).

## 2. Target architecture (the six responsibilities)

All six run inside the **one** Cloudflare Worker plus Firestore. No new backend service.

| # | Responsibility | Where | Deterministic or AI |
|---|---|---|---|
| 1 | **Praxiom AI**: writes notification copy per content item; optional re-rank of a candidate list | `worker/src/praxiom.js` + `notify/copy.js` (from `engine/copy.js`) | AI, always validated, template fallback |
| 2 | **Recommendation Engine**: retrieve, filter, rank, diversify | `worker/src/recommend/*` | Deterministic |
| 3 | **Notification Scheduler**: who, when, caps, cooldowns, quiet hours, dedupe | `worker/src/notify/engine` (ported live engine) | Deterministic |
| 4 | **Delivery Service**: Expo push, web push, in-app inbox, receipts, retries | `worker/src/notify/senders` (ported) | Deterministic |
| 5 | **Personalization Service**: builds profiles and For You lists | `worker/src/recommend/profile` (cron) | Deterministic |
| 6 | **Feedback and Analytics**: impressions, clicks, opens, completions → profile and stats | app writes events; worker aggregates into `notificationStats`, `recommendationStats` | Deterministic |

AI never decides eligibility, permissions, caps, timing or dedupe. It only proposes wording (and, optionally,
an order within an already-eligible list), and every output is checked in code.

## 3. Data model additions (backward compatible)

| Path | Writer | Reader | Shape | Retention |
|---|---|---|---|---|
| Content `tags: string[]` on `testimonies`, `writtenTestimonies`, `articles`, `lyricalAnalyses`, `loveworldVideos` | Admin editors (allowlisted tags; Praxiom may *suggest*, admin confirms) | Everyone (public fields) | Subset of the interest tag list | With the content |
| `users/{uid}/private/profile` | Worker only | Owner, admins (diagnostics) | `tagAffinity{tag:score}`, `typeAffinity{type:score}`, `evidence{tag:{events,days}}`, `lastActiveAt`, `updatedAt` | Rebuilt; deleted with account |
| `users/{uid}/private/forYou` | Worker only | Owner | `items[{type,id,reason}]` (≤20), `generatedAt`, `version` | Overwritten daily |
| `notificationSettings/{uid}` (extend live) | Owner (rules-validated) | Owner, worker | adds `personalization` (bool), `pausedUntil`, `preferredTime` (HH:MM), categories `writtenTestimonies`, `promotions`; `dailyMax` options 1/3/5 | Until deleted |
| `settings/praxiom` | Admins | Worker, admins | `mode` (`automatic`/`review`/`manual`), `aiCopy` (bool), `killSwitch`, `dailyCeiling` (≤5), `defaultQuietHours`, `categoryRules{}` | Permanent |
| `recommendation_events/{id}` | App (create-only) | Worker, admins | `surface`, `contentType`, `contentId`, `event` (`impression`/`click`/`complete`), `reason`, `ts`, `uid` | 30 days |
| `ai_requests/{id}` | Worker | Admins | `purpose`, `status`, `latencyMs`, `tokensIn/out`, `errorCode` (no content) | 30 days |

Rules: owner-only for `private/*` reads, worker-only writes (service account). `recommendation_events`
create-only with field allowlist, like `user_activity`.

## 4. Recommendation scoring (deterministic, explainable)

Candidates: published items from the last 120 days per type (bounded queries, cached per run), minus anything
deleted/unpublished, already completed, or shown in For You ≥3 times without a click.

```
score = 0.35·interest   (explicit tag ∩ content tags; 1.0 if any match)
      + 0.20·affinity    (learned tag/type affinity, only where evidence ≥ 3 events on ≥ 2 days)
      + 0.20·similarity  (bge-m3 cosine to the centroid of the user's last 5 completed testimonies; testimonies only)
      + 0.15·freshness   (exp(-age_days / 14))
      + 0.10·popularity  (log-scaled views, capped so it can never dominate)
      − exposure penalty (0.15 per prior unclicked impression in 14 days)
```

Diversity: max 2 items per tag and 3 per content type in a list of 10; slot 5 and 10 are **exploration** (best
item outside the user's top tags). Reasons are fixed codes rendered as short text: `interest:healing` →
"Because you enjoy healing testimonies"; `similar` → "Similar to what you watched"; `new_in:worship`;
`popular_new`; `explore` → "Something different for you".

Cold start / opt-out / Praxiom down: interests only, then freshness + popularity. Signed-out: editorial only.

## 5. Notification policy

| Rule | Default | Configurable by |
|---|---|---|
| Daily ceiling per person | **5** by default (decision 2026-11-21; options 1/3/5) | User (`dailyMax`), admin (`dailyCeiling`) |
| Quiet hours | **Off** by default (decision 2026-11-21); a person may turn them on (22:00–07:00 suggested) | User |
| Cooldown between non-urgent pushes | **None** for content sent on publish (decision 2026-11-21): one per person per run, extras on the next run (~2 min); time-slot campaigns keep 2 h | Admin |
| Dedupe | One per `(campaign, uid)`; one per `dedupeKey` per 35 days; never content already seen | Fixed |
| Targeting for content | Category on **and** (personalization off **or** relevance ≥ threshold) | Admin threshold |
| Live broadcasts | Immediate, outside the daily cap, max 2/day, still respect quiet hours | Admin |
| Urgent system notices | Admin-sent, bypass caps, still need admin action | Admin only |
| Paused / permission denied | No push; in-app inbox only | User / OS |
| Unopened ≠ disinterest | Affinity drops only after 5 unopened in a category within 14 days, floor 0.2 | Fixed |

Operating modes (`settings/praxiom.mode`): **automatic** (templated or validated AI copy sends after policy
checks), **review** (AI copy waits in the approval queue; template versions never wait), **manual** (no
automatic content pushes; admin sends). `killSwitch` stops all sends at once.

## 6. Privacy rules

- Praxiom receives content title, type, short description and public tags only. Never uid, name, email, token,
  history, or assistant chats.
- Assistant conversations are **never** a personalization or targeting signal.
- Interests are allowlisted tags only; no inferred sensitive characteristics.
- `optOut` (discovery) stops activity recording, profile building and For You (editorial shown instead).
- Account deletion removes `private/*`, `saved`, `collections`, `history`, `notificationSettings/{uid}`,
  `user_activity` and `recommendation_events` for the uid.
- Admin diagnostics show tags, scores and reason codes, not raw activity timelines.

## 7. Build order

| Phase | Scope | Depends on |
|---|---|---|
| **2a Worker consolidation** | Port live `notify` into repo worker; one worker, tests, deploy with Praxiom gate; Notification Centre reads live collections | B1 |
| **2b Content tags** | Tag field in admin editors, Praxiom tag suggestions, backfill tool | 2a |
| **2c Personalization** | Profile builder (cron), For You + Continue + Your Interests + new-in-your-categories on app and web home; impression/click events | 2b |
| **3 Intelligent notifications** | Praxiom copy (validated), relevance targeting, preferences UI (pause, preferred time, personalization, new categories), modes | 2a, 2c |
| **4 Praxiom Control Centre** | Overview, notification intelligence, approval, analytics, per-user diagnostics (admin) | 3 |
| **5 Optimisation** | Measure CTR/completion by reason, tune weights, load tests, privacy tests, failure drills | 4 |

## 7a. Phase 2a status (2026-11-21): one worker

- `top-admin/worker` is the only worker source (version 2.6.0). The live engine was extracted from the
  deployed bundle into `src/notify/{engine,firestoreStore,senders,index}.js`; the unused `src/engine` was
  removed (`copy.js` kept as `src/notify/copy.js` for Phase 3, `firestoreRest.js` moved to `src/`).
- A module-by-module comparison of the live bundle and the repo showed the repo is a superset apart from
  `notify` (other differences were bundler renames and the repo's newer assistant), so nothing live is lost.
- Endpoints: `POST /` (content events, admin only), `POST /api/notifications/dispatch`,
  `GET /api/notifications/vapid-key`, cron every 2 minutes. The Praxiom concurrency gate goes live with it.
- Tests: `test-notify.mjs` (14 end-to-end engine tests on an in-memory store), endpoint guards and the Expo
  sender in `test.mjs`; the old engine tests were split so the Praxiom and Firestore REST tests are kept.
- Firestore rules: the old engine collections are closed; admins read `notificationCampaigns`,
  `notificationQueue`, `notificationStats`, may switch `settings/notificationEngine` and cancel a campaign.
- Admin Notification Centre now shows the live engine (switch, today's counts, campaigns with cancel,
  time slots). The approval queue returns with review mode in Phase 4.
- Engine behaviour (updated 2026-11-21): a person gets at most one notification per run; extra published
  items follow on the next run (~2 minutes), or the next day if the daily limit (5) is reached.

## 7b. Phase 2b status (2026-11-21): content tags

- One list of 12 tags (the original 10 plus `salvation`, `miracles`) in four places kept identical by
  `tests/contentTags.test.mjs`: `worker/src/tags.js`, `web/src/tags.ts`, the app's `INTEREST_TAGS`, and the
  rules' `validContentTags()`.
- `tags: string[]` (≤ 5, allowlisted) on testimonies, written testimonies, articles, lyrical analyses and
  LoveWorld Singers videos; enforced in rules for create and update (`tests/contentTags.rules.test.mjs`).
- `POST /api/ai/suggest-tags` (admin only, 60/hour): one Praxiom call per batch of ≤ 8 items with public
  content text only; the answer is schema-checked against the list; keyword matcher as fallback per item.
- Admin: a tag picker with "Suggest tags" in all five editors; "Interest tags for existing content" on Data
  Management lists untagged items, suggests in batches of 8 and saves only rows the admin confirms.
- Worker 2.7.0 deployed; rules deployed.

## 7c. Phase 2c status (2026-11-21): personal home

- `POST /api/ai/home` (signed-in caller) returns Continue, For you, New in your interests, Featured you
  haven't seen, and the person's interests. Every read uses the **caller's token**, so the rules limit it
  to their own interests/history/activity and published content; nothing is written; assistant chats are
  never read. Content pool (published only) cached 30 minutes at the edge; each person's result cached
  5 minutes (pull-to-refresh may bypass once a minute). No KV writes.
- Scoring as in §4, without popularity (no view counts exist yet; "Featured" uses the editors' flag). Learned
  interests need ≥ 3 events on ≥ 2 days. Max 2 per topic and 3 per type; slots 5 and 10 explore. Exposure
  ("shown but not opened") is kept on the device and sent with the request.
- Continue lists unfinished items (≥ 10 s in) only if they are still published.
- Opt-out returns editorial sections only and ignores activity.
- App: `src/components/PersonalHome.tsx` on the home screen with an interests sheet (12 topics +
  personal-recommendations switch). Website: `web/src/components/PersonalHome.tsx` with a dialog.
  Both cache 6 hours per account and fall back silently to the rest of the home screen.
- New index: `user_activity (uid, ts desc)`. Worker 2.8.0. 17 tests in `test-recommend.mjs`.
- Not yet: popularity signal (needs view counts, Phase 5); Praxiom re-ranking (deterministic only for now).

## 8. Blockers and decisions

| # | Decision | Recommendation |
|---|---|---|
| **B1** | Which worker is the source of truth | Repo worker + ported live `notify`; retire repo `engine/` |
| **B2** | Firestore indexes in `firebase.indexes.json` are not deployed (only rules were published) | Deploy indexes with the CLI before 2a ships |
| **B3** | Default operating mode | **automatic** with templates (matches "send on publish"); AI copy in **review** until 50 approved without edits |
| **B4** | Praxiom concurrency (2 in flight per account) shared with the assistant | One copy call per content item, never per user; gate in the Worker |

## 7d. Phase 3a status (2026-11-21): priority lanes and token clean-up

- Every notification has a lane. **normal** counts toward the daily limit (5). **urgent** (admin-ticked
  announcements only) skips the daily limit; categories and a person's own quiet hours still apply.
  **live** broadcasts are outside the daily limit, at most 2 a day (a third is skipped as `live_cap`).
- Admin Announcements has an **Urgent** option with a stronger confirmation.
- A device that fails with `InvalidCredentials` (a build from another Expo project) gets `credFailures`
  counted on its token and is removed after 3; rules allow that field so the app can still refresh it.
- Worker 2.9.0; rules deployed; 22 engine tests, 23 notification rules tests.

## 7e. Phase 3c status (2026-11-21): Praxiom copy, modes, targeting

- On publish of content (testimony, written, article, lyrical, LoveWorld, choir) the Worker reads the item
  and asks Praxiom for one message (`src/notify/draft.js`), sending only the item's public fields. The draft
  must pass `validatePushCopy`: names the content, no number or sensitive word the content does not use,
  no links/emails/urgency, length limits. Otherwise the template is used and `draftError` is recorded.
- `settings/notificationEngine`: `copyMode` review (default) / automatic / manual; `aiCopy` (default on);
  `targeting` interested_first (default) / interested_only / everyone.
- Review: valid drafts wait as `awaiting_approval`; admins approve with the AI text, an edited text or the
  template (rules: only those fields, `dueAt` 0, server time, acting admin), or cancel. Approval triggers an
  immediate dispatch. Template-only notifications never wait.
- Targeting uses the item's tags and each person's chosen interests (`private/discovery`, batch-read).
  Non-matching people get it 3 hours later (or not at all with interested_only). No interests, opted out,
  untagged content, announcements and live broadcasts are never targeted.
- Worker 2.10.0, rules deployed; 12 new engine tests (34), 5 new rules tests (engine rules 26).
- Not yet: open rates per copy source (needs the open tracking from Phase 3b).
