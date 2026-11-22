# Storyboard: 1920×1080, 30 fps, 76 s

| Time | Purpose | Voiceover | On-screen copy | Visual / motion | Evidence |
|---|---|---|---|---|---|
| 0:00–0:13 | Hook | "Through powerful, real-life testimonies…" | "Through powerful, real-life testimonies"; then *healing / hope / restoration / miracles / transformation* on each spoken word | A tilted, drifting wall of real testimony thumbnails, blurred and darkened; kinetic words un-blur on their timings; the last word is gold | Thumbnails from the app's Testimonies screen |
| 0:13–0:23 | Impact | "In the past year alone, more than 500…" | Count-up to **500+**: "life-changing testimonies shared"; "The power of God's Word, expressed through music." | Gold numeral counts up on "500" | Owner's approved narration (`tutorial.intro`) |
| 0:23–0:27 | Brand reveal | "Welcome to Testimonies of Praise." | Logo; "An LMM TV production in collaboration with Loveworld XP" | Logo scales in from blur, halo pulse, gold light sweep, low swell | `web/public/logo.png`, `tutorial.intro` script |
| 0:27–0:36 | Home | "From here, you can discover featured content…" | HOME, "Your starting point.", plus chips: Featured testimonies, The latest testimonies, Highlights & events, Every section, one tap away | Home screen in a tilted phone; each chip lands on its spoken word | `HomeScreen.tsx`, `PersonalHome.tsx` |
| 0:36–0:45 | Testimonies | "Discover inspiring testimonies…" | TESTIMONIES, "Stories of God's goodness.", plus Faith, Answered prayers, Transformation, Watch or read | Testimonies list in a phone; one real card lifts out toward the viewer | `TestimoniesScreen.tsx`, `WrittenTestimoniesScreen.tsx` |
| 0:45–0:52 | Live and radio | "Whenever a broadcast is available…" | LIVE badge, "Watch live. Listen anywhere.", "Live broadcasts and TOP Radio, right inside the app." | Live and Listen screens side by side; pulsing live badge | `LiveScreen.tsx`, `ListenScreen.tsx`, `src/audio/` |
| 0:52–1:03 | Praxiom | "Hello, I'm Praxiom… find a moment inside a video…" | "Ask. Find. Jump straight in.", "Your AI assistant, right inside the app.", "Moment in a video" card | Assistant screen; a scrub bar glides to a gold "Prayer" marker on "prays" | `AssistantScreen.tsx` (clips open `TestimonyDetails` at `startAt`), `scripts/clips/` |
| 1:03–1:10 | Payoff | "Everything is designed to help you stay connected…" | "Stay connected.", plus Live broadcasts, Video testimonies, TOP Radio, Offline downloads, Praxiom AI | Three phones fan out; chips cascade | Feature list matches the chips on the app's own Welcome screen |
| 1:10–1:16 | CTA | *(music)* | Logo, "Watch. Listen. Be encouraged.", "Download free on the Loveworld App Store", QR, web.lwappstore.com | Logo from blur, gold sweep, QR rises in, fade to black | Store URL from `DownloadLandingPage.tsx` and `ProfilePage.tsx` |

## Feature evidence matrix
| Feature / message | Evidence | State | Shown? |
|---|---|---|---|
| Video testimonies, browse and watch | `src/screens/TestimoniesScreen.tsx`, `TestimonyDetailsScreen.tsx`, `src/video/` | Implemented | Yes |
| Written testimonies (read, comment) | `WrittenTestimoniesScreen.tsx`, `WrittenTestimonyScreen.tsx`, comments rules tests | Implemented | Yes ("Watch or read") |
| Live broadcasts | `LiveScreen.tsx`, `settings/live` listener, `useLiveViewer.ts` | Implemented | Yes |
| TOP Radio / audio | `ListenScreen.tsx`, `src/audio/AudioPlayerContext.tsx` (background playback) | Implemented | Yes |
| Offline downloads | `DownloadsScreen.tsx`, `DownloadButton.tsx` (`isDownloadable`); README marks HLS as not downloadable | Implemented (MP4 only) | Chip only |
| Praxiom AI assistant, find moments in videos | `AssistantScreen.tsx` → `TestimonyDetails` `startAt`; `src/ai/`; `scripts/clips/analyze-clips.mjs` | Implemented | Yes |
| 500+ testimonies in the past year | Owner-approved narration in `src/voiceover/manifest.ts` | Owner claim | Yes, attributed to the approved script |
| Share your testimony, Sponsor, Choir feature, Lyrical analysis, Articles | Screens exist | Implemented | Omitted for pacing |
| App Store availability | `STORE_URL` in `DownloadLandingPage.tsx` (returns 302 when checked) | Verified link | Yes (QR + URL) |
| LoveWorld Radio broadcast time | Not in the repo | Unverified | Not shown |
