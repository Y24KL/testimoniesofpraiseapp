# Testimonies of Praise — App Store Submission Metadata

Use this as the single source of truth when filling out a store listing (Loveworld App Store,
Google Play, or the Apple App Store). Fields marked **[FILL IN]** need something only you have —
I either don't have access to it or it needs a decision only you can make.

## Basic info

| Field | Value |
|---|---|
| App name | Testimonies of Praise |
| Short tagline | Every testimony has a story. Share yours. |
| Category | Lifestyle / Christianity / Religion (pick whichever the store uses) |
| Package name (Android) | com.testimoniesofpraise.app |
| Bundle ID (iOS) | com.testimoniesofpraise.app |
| Current version | 1.0.0 |
| Content rating | Everyone / All ages (no violence, no mature content) |
| Contact email | **[FILL IN]** |
| Privacy policy URL | **[FILL IN]** — required by every store; see note below |
| Support URL / phone | **[FILL IN]** |

## Short description (≈80 characters)
> Watch, share, and be encouraged by real testimonies of people who listened to the Lovewold Singers.

## Full description

> Testimonies of Praise brings the global testimony community into your pocket. Watch inspiring
> testimonies from believers around the world, join us live as we share testimonies and praise God aas they happen, and share what
> God has done in your own life — all in one place.
>
> WHAT YOU CAN DO
> • Watch a growing library of testimonies, with new ones added regularly
> • Join live broadcasts and chat with others watching in real time
> • Share your own testimony directly from the app
> • Save testimonies to watch offline, anywhere
> • Get notified the moment a new testimony or live service goes up
> • Sow into the ministry through the Sponsor feature
>
> Nobody ever praises God and goes away empty, he always blesses those who praise him.

## What's new (this release)
> First release: watch and share testimonies, live streaming with chat, offline downloads, and
> account sign-in with Google, email, or KingsChat.

## Screenshots needed
**[FILL IN — none exist yet]**. Stores require actual screenshots taken from the app, sized per
store (Android: at minimum 2 phone screenshots, 320–3840px per side; iOS: per required device
size). Suggested screens to capture: Home, a Testimony playing, Live with chat visible, and the
Sponsor screen. I can help produce these once you can run the app in a simulator/emulator and send
me the raw captures, or once you have real phone screenshots.

## Icon & graphics
- App icon: `assets/icon.png` (1024×1024) — already the real logo you supplied.
- Feature graphic / promo image (Play Store wants 1024×500): **[FILL IN — not yet made]**.

## Permissions used, and why (needed for the store's "data safety" form)
| Permission | Why |
|---|---|
| Internet | Loads testimonies, live streams, chat |
| Notifications (POST_NOTIFICATIONS, Android 13+) | New testimony / live / announcement alerts |
| Photo library (read) | Attaching a profile picture or a sponsorship receipt |
| Camera roll / media (via image picker) | Same as above — the app does not use the camera directly unless the person chooses to take a photo from the picker |

## Data collected (for Play's "Data safety" and Apple's "App Privacy" forms)
| Data | Collected? | Purpose | Shared with third parties? |
|---|---|---|---|
| Email address | Yes (email/password or Google sign-in) | Account, sign-in | No |
| Name | Yes (optional, user-entered) | Personalization | No |
| Profile photo | Yes (optional, user-uploaded) | Shown on their profile | Stored via Cloudinary (a processor, not a third party the data is "shared" with in the marketing sense) |
| Push notification token | Yes | Delivering notifications | No |
| App usage (opens, plays, downloads) | Yes (anonymized to the account, not sold) | Understanding what's popular | No |
| Sponsorship / bank receipt image | Yes (only if the user submits one) | Manually verifying a bank transfer | No |
| KingsChat access token (if used) | Yes (only if the user signs in with KingsChat) | Linking that sign-in method | No — never sent anywhere except KingsChat itself and your own Firebase |

None of this data is sold. All of it lives in your own Firebase project.

## Privacy policy — you need a real one
Every store requires a working privacy policy URL before they'll accept the listing. This document
is not a privacy policy — it's a fact sheet to help you (or a lawyer, or a privacy-policy generator)
write one accurately, using the "Data collected" table above as the source of truth. **[FILL IN]**

## Age rating questionnaire notes
- No user-generated content beyond text (testimonies are admin-published; live chat is free text,
  moderated by admins — mention this in the content-moderation section of the questionnaire).
- No gambling, no violence, no mature themes.

## Sign-in methods offered
Google, Email/Password, KingsChat. (Note for Apple review: if Apple's guideline 4.8 is raised
because Google sign-in is offered without Sign in with Apple, see the note already in
`docs/SETUP.md` — Apple may ask for Sign in with Apple to be added.)

## Build artifacts to attach

| Platform | File | How to get it |
|---|---|---|
| Android | `.aab` (Play Store) | `npm run build:android:aab`, download from the EAS build page |
| Android | `.apk` (a store that wants a direct APK, e.g. Loveworld App Store may) | `npm run build:android:apk` |
| iOS | `.ipa` | `npm run build:ios:testflight` (needs the paid Apple account) |

**For the Loveworld App Store specifically:** I could not find a public developer portal or
submission API documentation for it to confirm their exact format requirements (APK vs AAB, any
required metadata fields beyond the usual). **[FILL IN once you have their submission
instructions]** — if you can share whatever page or email they gave you with their requirements,
I'll match this document to it exactly and adjust the build command if they need something
different from a standard Play Store AAB.

## Version history log (keep this updated for every release)
| Version | Version code | Date | Notes |
|---|---|---|---|
| 1.0.0 | 1 | — | First submission build |
