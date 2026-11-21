# Storyboard and feature evidence

## Feature evidence matrix

| Message in the promo | Evidence | State | Shown? |
|---|---|---|---|
| Watch video testimonies (Healing, Deliverance, Miracles…) | `src/screens/TestimoniesScreen.tsx`, `TestimonyDetailsScreen.tsx`; device capture shows these category labels | Implemented | Yes |
| Read written testimonies | `src/screens/WrittenTestimoniesScreen.tsx`, `WrittenTestimonyScreen.tsx`; device screenshot supplied by the owner | Implemented | Yes |
| Live broadcast + live chat | `src/screens/LiveScreen.tsx` renders `<LiveChat>` when a session exists; menu row "Livestream & Live Chat" | Implemented | Yes |
| "Not live yet? Watch while you wait" | Live screen capture (offline state) | Implemented | Yes |
| Radio keeps playing with screen locked | `src/audio/`, `app.config.ts` `supportsBackgroundPlayback: true`; Listen screen copy | Implemented, **but radio is off air in production** (`docs/REDESIGN_2026.md` §Manual steps 4) | Yes, worded "when the radio is on air" |
| Audio testimonies | Listen screen | Implemented, none published yet | Not claimed |
| Praxiom AI assistant | `src/screens/AssistantScreen.tsx` (quick prompt "Help me find a testimony."), Assistant tab capture | Implemented | Yes |
| Offline downloads | `src/downloads/`, `DownloadButton.tsx` (only where admin set `isDownloadable`; HLS can't be saved) | Implemented, admin-gated | Yes, "save testimonies to watch offline" |
| LoveWorld Singers worship videos | `LoveworldSingersScreen.tsx`; device screenshot supplied by the owner (Dearest Shepherd by Eli-J) | Implemented | Yes |
| Lyrical Analysis ("meaning behind the songs") | `LyricalAnalysisScreen.tsx`; menu row | Implemented (shows "Coming soon" when empty) | Yes |
| Share your testimony | `ShareTestimonyScreen.tsx` → `repo.submitTestimony` | Implemented | Yes |
| Feature your choir/group | `ChoirFeatureScreen.tsx`, `ChoirRequestScreen.tsx` | Implemented | Omitted (time) |
| Sponsor | `SponsorScreen.tsx` (shows bank details) | Implemented | Omitted (bank details on screen) |
| Notifications | `src/notifications/`; server relay needs redeploy per docs | Partial | Omitted |
| "24/7" radio, "500+ testimonies" | Menu badge / previous brag copy; not verifiable from data | Unverified | Omitted |
| Wednesday 1 PM GMT+1 LoveWorld Radio slot | `docs/PHASE0_AUDIT.md`: "not in the repository… pending confirmation" | Unverified | Omitted |
| Admin portal | `top-admin/` | Admin only | Not shown |
| LoveWorld AppStore logo | `https://web.lwappstore.com/images/logo-for-appstore.jpg` (the store site's own header logo, 512×512), saved as `assets/brand/lw-appstore-logo.jpg` | Official | Yes |
| Download destination | `web/src/pages/DownloadLandingPage.tsx`: `STORE_URL = https://web.lwappstore.com/share/lW-APP-Y26-PJ8225`, `WEB_URL = https://testimoniesofpraiseapp.com` | Configured in shipped code | Yes (button, QR, URL) |

## Scene table (timecodes in seconds)

| Time | Purpose | Voiceover | On-screen copy | Visual / motion | Asset |
|---|---|---|---|---|---|
| 0–3.7 | Hook | Every testimony carries a story. | "Every testimony / carries a story." | Fade up from black; word-by-word blur-in; real testimony thumbnails drift in soft focus; gold dust | thumb1–6 |
| 3.7–8.6 | Hook 2 | A moment when God showed up, and a song made all the difference. | Same words | Musical notes rise (landing-page motif) | — |
| 8.6–12.2 | Brand reveal | This is the Testimonies of Praise app. | Logo, "TESTIMONIES OF PRAISE", "The T.O.P. app" | Light streak + whoosh; logo de-blurs and scales in, light sweep, shimmer chord | logo.png |
| 12.2–17 | Watch | Watch powerful testimonies of healing, deliverance, and miracles. | "Powerful testimonies." + chips timed to the words | Realistic phone (titanium rim, Dynamic Island, status bar) glides in with Home | home.png |
| 17–23.4 | Real stories | Real stories, from people whose lives were touched by the songs of the LoveWorld Singers. | "Lives touched by the songs of the LoveWorld Singers." | Phone shows Testimonies list; three thumbnails fan out | testimonies.png, thumbs |
| 23.4–27.6 | Written testimonies | Prefer to read? Written testimonies are right there too. | "Prefer to read?" | Phone shows the real Written testimonies screen; its first card lifts out | written.png, written-card.png |
| 27.6–35.3 | Live | Join the live broadcast, and chat… Not live yet? Watch a testimony while you wait. | "Watch live. Chat as it happens." + LIVE pill | Streak; phone glides left to Watch Live; "Livestream & Live Chat" row, then "We're not live yet" card | live.png, row-live, live-wait |
| 35.3–40.6 | Listen | When the radio is on air, keep listening, even with your screen locked. | "Keep listening." | Listen screen; TOP Radio card lifts out; gold equaliser | listen.png, radio-card |
| 40.6–45.7 | Praxiom | Ask Praxiom to help you find a testimony, or find your way around. | "Ask Praxiom." | Phone glides right to Praxiom; the app's quick prompt types into the real input (illustrative) | assistant.png |
| 45.7–49.8 | Offline | Save testimonies to watch offline, wherever you are. | "Watch offline." | Home screen; ring on Downloads tab; Explore grid card with ring on "Saved" | home.png, explore-grid |
| 49.8–57.4 | Worship / discover / share | Worship with the LoveWorld Singers, discover the meaning behind the songs, and share your own testimony. | "Worship. Discover. Share." lighting with the VO | Phone shows the real LoveWorld Singers video screen (Dearest Shepherd by Eli-J, Download / Share); Lyrical Analysis and Share Testimony rows slide in on their words | singers.png, row-lyrical, row-share |
| 57.2–63.3 | Payoff | No one ever praised God and went away empty. He always blesses you for praising Him. | Same words, three lines (brand line from the download landing page) | Slow-drifting mosaic of testimony thumbnails under a dark scrim | thumbs |
| 63.3–68.1 | CTA | Download Testimonies of Praise, free on the LoveWorld App Store. | Logo, "Download free today.", "Download on the LoveWorld AppStore" badge with the store's official logo, website | Streak + shimmer; badge and QR pop in | logo.png, lw-appstore-logo.jpg, qr-lwappstore.png |
| 68.1–71.9 | Scan | Just scan the QR code to download the app. | "Scan the QR code to download the app" | QR pulses inside a glowing gold ring | qr-lwappstore.png |
| 71.9–75 | Close | Thank you, and God bless you. | Logo + "Thank you, and God bless you." | Shimmer; logo sweep; fade to black | logo.png |
