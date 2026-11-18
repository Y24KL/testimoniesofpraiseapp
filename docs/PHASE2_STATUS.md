# T.O.P. 2.0: Phase 2 status (My T.O.P.)

Date: 2026-11-18. Builds on `docs/PHASE0_AUDIT.md` and `docs/PHASE1_STATUS.md`. Nothing here is deployed.

## Verification (run on 2026-11-18)

| Suite | Result |
|---|---|
| `npm run typecheck` (app) | Passes |
| `top-admin/web` `tsc --noEmit` | Passes |
| App unit suites: voiceover, profile validation, comment text, choir request, feedback, discovery, My T.O.P. rules | Pass |
| `npm run test:rules` (Firestore emulator, production rules) | Passes: comments 20, profile 17, choir 21, lyrical 13, feedback 24, notifications 22, engine 25, My T.O.P. 13 |
| Worker `npm test` | Passes (unchanged this phase) |

Not yet run: the screens on a device or simulator. The app build has been typechecked only. Check the My T.O.P. screen and the video resume on a real build before relying on them.

## What is implemented

**Data (users/{uid}/…, owner only, rules enforced)**
- `saved/{type_id}`: saved testimonies and lyrical analyses. The id must be canonical, the fields are fixed, and items are create-or-delete only.
- `collections/{id}`: named collections (1 to 60 characters, up to 200 items each). The creation time cannot change.
- `history/{type_id}`: one document per item, holding the position, duration, completed flag and time. Bounded numbers and fields.

**Behaviour**
- **Saved items**: Save or remove from any testimony or lyrical analysis, with the state shown on the button. Signed out, the button asks the person to sign in.
- **Collections**: create, open, remove items, delete (the saved items stay). Assign a saved item to collections from the Saved tab.
- **History**: a progress bar per item, "Continue at m:ss", "Finished", and removal.
- **Resume across devices**: the furthest of this device's position and the account's position wins. Near-start positions are ignored, and finished items start at the beginning. Pausing and finishing always save the exact position. Otherwise saves are at most every 15 seconds, or sooner after a 30-second move.
- **Sync**: all three lists are live (`onSnapshot`), so a change on one device appears on the others.
- **States**: loading (skeleton rows), empty (a message per tab), error (a message), and signed out (an explanation and no lists).
- **Account deletion**: the library and discovery data are removed before the account. Every query is scoped to the person.

**Downloads** keep their existing architecture. Nothing in `src/downloads` changed.

## Decisions taken

- **Two-way sync through the account.** On-device resume stays as it was, and the account adds to it. A person who never signs in loses nothing.
- **Account deletion clears the library first.** The rules stop allowing deletes once the account is gone, so cleanup has to come first. If Firebase then refuses the deletion (it can ask for a recent sign-in), the library has already been cleared while the account remains. The person has confirmed they want the account deleted, so this is accepted, but it is a real trade-off.
- **Saved items keep a snapshot** of title, subtitle and thumbnail, so My T.O.P. works without re-reading each item. A title that changes later will show the old text until it is saved again.
- **Limits**: 200 history entries (the oldest are pruned, and pruning runs every tenth write), 200 items per collection, 500 saved items loaded in one list.

## Known limits

- **Mobile only.** The website has no My T.O.P. yet. The rules and data are shared, so the web can be added without changing them.
- **Rename of a collection** is supported by the service but has no button in the screen yet.
- **Firestore's offline cache** on React Native is memory-only. Writes made offline are queued until the connection returns, but they are lost if the app is closed while offline.
- **Account-deletion cleanup is limited to 1,000 documents per list**. A person with more would keep the rest until a later pass. No such later pass exists yet.
- **Service calls are not tested against the emulator.** The rules are tested; the client functions are checked by the typechecker and the pure logic tests, not by round trips.
- **Phase 2 does not change the Home screen.** Personalised discovery is still the Phase 1 foundation with no Home sections built.

## Deployment

1. Deploy the Firestore rules (see `docs/PHASE1_STATUS.md`). The My T.O.P. rules are in the same file.
2. Build and release the app. Nothing server-side is needed for My T.O.P.
3. Check on a staging build: save an item, see it on a second device, start a video on one device and resume on the other, then delete a test account and confirm its library is gone.
