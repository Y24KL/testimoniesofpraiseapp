# T.O.P. 2.0: Phase 4 status (community and editorial)

Date: 2026-11-18. Builds on Phases 0 to 3. Nothing here is deployed.

## Verification (run on 2026-11-18)

| Suite | Result |
|---|---|
| `npm run typecheck` (app) | Passes |
| `top-admin/web` `tsc --noEmit` | Passes |
| App unit suites, including new editorial and community rules (10) | Pass |
| `npm run test:rules` (9 suites), including community rules (10) | Passes |
| Worker `npm test` | Passes (unchanged) |

Not yet run: the Home section, the report flow and the admin pages on a device or in a browser.

## What is implemented

**Editorial (Home "Daily discovery")**
- One admin-written configuration document, `settings/editorial`: inspiration lines, radio programme entries, featured picks (a testimony, a lyrical analysis, an article), and community highlights (up to six published choirs).
- **Inspiration**: one line a day, in turn through the admin's list. Nothing is written by the system.
- **Radio**: the next confirmed programme within 7 days, shown with the admin's own zone label. A Wednesday 1 PM GMT+1 entry is 12:00 UTC, and a test checks the conversion. Unconfirmed entries are stored but never shown.
- **Featured items and highlights** are checked when they load. An item that is unpublished or missing is hidden, not replaced.
- An empty configuration shows nothing at all on Home.

**Reporting and moderation**
- Signed-in people can report a choir (the report button is on the featured choir screen). Reasons are fixed: inappropriate, misleading, hateful, spam, other. An optional note is up to 300 characters.
- One report per person per item. The report's id is canonical, so a second report is refused both by the client check and by the rules.
- Reporters can see their own reports. Admins see all of them, and can only change the status (open, reviewed, actioned, dismissed). Reports cannot be deleted.

**Admin Portal**
- **Daily discovery** page: edit the inspiration lines, radio entries, featured picks and highlights. The Wednesday radio entry is pre-filled from the brief with a warning to check it before saving.
- **Reports** page: filter by status, see the item and reason, and change the status.

## Decisions taken

- **The Wednesday programme is named "LoveWorld Radio"**, taken from the wording of the brief. The title is editable in the admin page. Please check it.
- **The engine does not announce featured choirs yet.** The Admin Portal already sends a push when a choir is featured, and the engine would send a second one. When the engine is switched on, its detection should replace the manual push, not run beside it.
- **Reports don't hide content.** An admin reviews a report and changes its status. Nothing is removed automatically, and the reporter is not told the outcome.

## Gaps against the spec (not built)

- **Community discovery beyond what exists.** Featured choirs are the only approved group listing. There are no group profile pages, no browsing of musical ministrations, and no new shareable testimony resources.
- **Report buttons on testimonies, comments and articles.** The report type is supported by the rules and the admin page, but the buttons are not on those screens yet. Comment items need their own UI for it.
- **Advanced personalisation.** Phase 2 and 3 provide the data (interests, activity, saved items) and the assistant's recommendations, but there are no "because you…" explanations on Home beyond the editorial slots.
- **Website.** The Daily discovery section and the report flow are mobile only.
- **Content on the Daily discovery slots is not logged or analysed.** There is no view count for featured picks.

## Deployment

1. Deploy the Firestore rules (`top-admin`, `firebase deploy --only firestore:rules`). The community blocks are in the same file as before.
2. No new indexes are needed for this phase.
3. Build and release the app.
4. On staging: save a daily discovery configuration with a radio entry marked confirmed, and check that Home shows it. Clear it and check that Home shows nothing new. Report a choir as a test user, check the admin Reports page shows it, and check a second report is refused.
