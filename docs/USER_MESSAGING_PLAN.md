# User Communication & Support: design and build order

Date: 2026-11-21. Builds on the notification engine (`top-admin/worker/src/notify`) and the Praxiom plan.

## 1. What exists (audited)

| Record | Collection | Person field | Who can change it today |
|---|---|---|---|
| Choir/group feature request | `choirFeatureRequests` | `submittedBy` | admins: `status`, `reviewedAt`, `reviewedBy` only |
| Sponsorship | `sponsorships` | `uid` | admins (any field); owner reads |
| Testimony submission | `testimonySubmissions` | `userId` (+ `userEmail`) | admins |
| Feedback | `appFeedback` | `userId` | admins: status only |
| Content report | `contentReports` | `reporterUid` | admins: status only |
| Comment | `…/comments/{uid}` | document id | owner / moderators |
| Profile | `users/{uid}` | `fullName`, `title`, `church`, `zone` | owner |

Email is not stored in Firestore; it lives in Firebase Auth and is looked up by the Worker (service account).

## 2. Data model

`supportThreads/{threadId}`: `uid`, `subject`, `category`, `related {type, id, label}`, `status`
(`awaiting_user` · `awaiting_admin` · `resolved`), `createdBy`, `createdAt`, `updatedAt`, `lastMessageAt`,
`lastMessagePreview`, `lastSender` (`admin`/`user`), `unreadForUser`, `unreadForAdmin`, `correction`
(`{ state: 'requested' | 'received', fields[] }`, optional).

`supportThreads/{threadId}/messages/{messageId}`: `senderType` (`admin`/`user`), `senderUid`, `body`,
`action { label, route | url }` (admin only), `createdAt`, `readAt`, `delivery { status, campaignId }`.
Admin message ids are a client-supplied idempotency key, so a retried send never duplicates.

## 3. Who writes what

| Action | Path | Why |
|---|---|---|
| Admin starts a thread / sends a message | Worker `POST /api/support/send` (admin verified) | privileged create + push in one place |
| Push for a new admin message | notification engine campaign, `audienceUids: [uid]`, category `messages`, urgent lane | reuses devices, retries, receipts; generic lock-screen text |
| User replies | client batch: message + thread counters, strict rules | owner only, `senderType == 'user'`, server time |
| Read receipts | client: user marks admin messages read; admin marks thread read | rules allow only those fields |
| Resolve / reopen | admin client, status only | |
| User correction (choir link, receipt) | Worker `POST /api/support/correction` (owner verified) | original records stay locked; history kept |
| User search by email | Worker `POST /api/support/users` (admin) via Auth lookup | email is not in Firestore |

## 4. Build order

- **M1 Messaging backbone:** data model, rules + tests, Worker endpoints, push via the engine, admin
  **User Communication** (search, conversations with tabs, composer with action button and preview,
  contextual **Message** buttons on choir requests, sponsorships, submissions, feedback, reports), app and
  website **Messages** inbox with replies and deep links from the push.
- **M2 Corrections:** choir revision (new link / details) and replacement sponsorship receipt, as
  revisions linked to the original; "Correction received — ready for review" in the portal.
- **M3 Templates and Praxiom:** built-in and custom templates; Praxiom rewrite/draft from the record's
  facts only, always reviewed before sending.
