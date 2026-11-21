# Storyboard and feature evidence

## Feature evidence matrix

| Message in the promo | Evidence | State | Shown? |
|---|---|---|---|
| Watch video testimonies (Healing, Deliverance, Miracles…) | `src/screens/TestimoniesScreen.tsx`, `TestimonyDetailsScreen.tsx`; device capture shows these category labels | Implemented | Yes |
| Read written testimonies | `src/screens/WrittenTestimoniesScreen.tsx`, `WrittenTestimonyScreen.tsx`; "Read testimonies" banner in capture | Implemented | Yes |
| Live broadcast + live chat | `src/screens/LiveScreen.tsx` renders `<LiveChat>` when a session exists; menu row "Livestream & Live Chat" | Implemented | Yes |
| "Not live yet? Watch while you wait" | Live screen capture (offline state) | Implemented | Yes |
| Radio keeps playing with screen locked | `src/audio/`, `app.config.ts` `supportsBackgroundPlayback: true`; Listen screen copy | Implemented, **but radio is off air in production** (`docs/REDESIGN_2026.md` §Manual steps 4) | Yes, worded "when the radio is on air" |
| Audio testimonies | Listen screen | Implemented, none published yet | Not claimed |
| Praxiom AI assistant | `src/screens/AssistantScreen.tsx` (quick prompt "Help me find a testimony."), Assistant tab capture | Implemented | Yes |
| Offline downloads | `src/downloads/`, `DownloadButton.tsx` (only where admin set `isDownloadable`; HLS can't be saved) | Implemented, admin-gated | Yes, "save testimonies to watch offline" |
| LoveWorld Singers worship videos | `LoveworldSingersScreen.tsx`; menu row | Implemented | Yes |
| Lyrical Analysis ("meaning behind the songs") | `LyricalAnalysisScreen.tsx`; menu row | Implemented (shows "Coming soon" when empty) | Yes |
| Share your testimony | `ShareTestimonyScreen.tsx` → `repo.submitTestimony` | Implemented | Yes |
| Feature your choir/group | `ChoirFeatureScreen.tsx`, `ChoirRequestScreen.tsx` | Implemented | Omitted (time) |
| Sponsor | `SponsorScreen.tsx` (shows bank details) | Implemented | Omitted (bank details on screen) |
| Notifications | `src/notifications/`; server relay needs redeploy per docs | Partial | Omitted |
| "24/7" radio, "500+ testimonies" | Menu badge / previous brag copy; not verifiable from data | Unverified | Omitted |
| Wednesday 1 PM GMT+1 LoveWorld Radio slot | `docs/PHASE0_AUDIT.md`: "not in the repository… pending confirmation" | Unverified | Omitted |
| Admin portal | `top-admin/` | Admin only | Not shown |
| Download destination | `web/src/pages/DownloadLandingPage.tsx`: `STORE_URL = https://web.lwappstore.com/share/lW-APP-Y26-PJ8225`, `WEB_URL = https://testimoniesofpraiseapp.com` | Configured in shipped code | Yes (button, QR, URL) |

## Scene table (timecodes in seconds)

| Time | Purpose | Voiceover | On-screen copy | Visual / motion | Asset |
|---|---|---|---|---|---|
| 0–4 | Hook | Every testimony carries a story. | "Every testimony / carries a story." | Fade up from black; word-by-word blur-in; real testimony thumbnails drift in soft focus; gold dust | thumb1–6 |
| 4–9 | Hook 2 | A moment when God showed up… and a song made all the difference. | Same words, gold second line | Musical notes rise (landing-page motif) | — |
| 9–13 | Brand reveal | This is the Testimonies of Praise app. | Logo, "TESTIMONIES OF PRAISE", "The T.O.P. app" | Light streak + whoosh; logo de-blurs and scales in, light sweep, shimmer chord | logo.png |
| 13–18 | Watch | Watch powerful testimonies of healing, deliverance and miracles… | "Powerful testimonies." + chips Healing / Deliverance / Miracles timed to the words | Phone glides in from right with Home screen | home.png |
| 18–24.6 | Real stories | …real stories from people whose lives were touched by the songs of the LoveWorld Singers. | "Lives touched by the songs of the LoveWorld Singers." | Phone crossfades to Testimonies list; three thumbnails fan out of the phone | testimonies.png, thumbs |
| 24.6–29 | Read | Prefer to read? Written testimonies are right there too. | "Prefer to read?" | The real "Read testimonies" banner lifts out of the screen | read-banner.png |
| 29–37.4 | Live | Join the live broadcast… Not live yet? Watch a testimony while you wait. | "Watch live. Chat as it happens." + LIVE pill | Streak; phone glides left to Watch Live; "Livestream & Live Chat" row, then "We're not live yet" card | live.png, row-live, live-wait |
| 37.4–43 | Listen | When the radio is on air, keep listening, even with your screen locked. | "Keep listening." | Listen screen; TOP Radio card lifts out; gold equaliser | listen.png, radio-card |
| 43–50.4 | Praxiom | Ask Praxiom, your AI assistant… | "Ask Praxiom." | Phone glides right to Praxiom; the quick-prompt text types into the real input field (illustrative interaction) | assistant.png |
| 50.4–55 | Offline | Save testimonies to watch offline, wherever you are. | "Watch offline." | Home screen; gold ring on the Downloads tab; Explore grid card with ring on "Saved" | home.png, explore-grid |
| 55–62.8 | More | Worship with the LoveWorld Singers, discover the meaning behind the songs, and share your own testimony. | "Worship. Discover. Share." (each word lights with the VO) | Phone exits; real menu rows slide in one per clause | row-singers, row-lyrical, row-share |
| 62.8–67.4 | Payoff | Because no one ever praised God and went away empty. | Same line, gold second half | Slow-drifting mosaic of real testimony thumbnails under a dark scrim | thumbs |
| 67.4–74.5 | CTA | Download Testimonies of Praise, free on the LoveWorld App Store. | Logo, "Download free today.", gold "LoveWorld App Store" button, "testimoniesofpraiseapp.com", QR "Scan to download" | Streak + shimmer; QR pops in; music fades; fade to black in the last 0.7 s | logo.png, qr-lwappstore.png |
