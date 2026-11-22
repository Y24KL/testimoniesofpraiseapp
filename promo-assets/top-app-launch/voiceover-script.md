# Voiceover script: T.O.P. app promo (76 s)

**Voice:** the app's own ElevenLabs narrator, "Brian" (deep, resonant, comforting), model `eleven_multilingual_v2` (`src/voiceover/manifest.ts`).
**Source:** every line is owner-approved wording, cut from the approved narration files already in `assets/voiceovers/`. No new speech was generated. `tools/edit.json` lists each cut, and `tools/align.py` gives the word timings.

| Time | Line | Source clip (in–out) |
|---|---|---|
| 0:01.0 | Through powerful, real-life testimonies, the programme reveals how these inspired songs have brought healing, hope, restoration, miracles, and transformation to countless lives around the world. | tutorial.intro.v2 (11.20–22.90) |
| 0:13.2 | In the past year alone, more than 500 life-changing testimonies have been shared, demonstrating the undeniable power of God's Word expressed through music. | tutorial.intro.v2 (23.20–32.45) |
| 0:23.3 | Welcome to Testimonies of Praise. | app.open.v1 |
| 0:27.4 | From here, you can discover featured content, explore the latest testimonies, find important announcements and access the major sections of the application. | tutorial.home.v1 (5.30–13.95) |
| 0:36.6 | Discover inspiring testimonies that share stories of faith, answered prayers, transformation, and God's goodness by listening to the Loveworld Singers. | tutorial.testimonies.v2 (full) |
| 0:45.1 | Whenever a broadcast is available, you can access it directly from this section and enjoy the experience in real time. | tutorial.live.v1 (6.10–13.00) |
| 0:52.4 | Hello, I'm Praxiom, your AI assistant here in the Testimonies of Praise app. | assistant.response.v3 (0–5.10) |
| 0:57.7 | It can find a moment inside a video, such as the part where someone prays, and open it for you. | tutorial.ai.v3 (4.80–10.40) |
| 1:03.7 | Everything is designed to help you stay connected and discover more of what Testimonies of Praise has to offer. | tutorial.home.v1 (19.05–25.05) |
| 1:10–1:16 | *(music only, CTA on screen)* | |

About 150 words.

## Pronunciation notes
Testimonies of Praise, T.O.P., Loveworld, Praxiom (PRAK-see-um), LMM TV, Loveworld XP. These are already correct in the approved recordings.

## Spoken CTA (optional, not yet recorded)
The approved recordings have no "download" line, so the CTA is on screen only. If you want it spoken, approve a line such as
*"Download Testimonies of Praise free on the Loveworld App Store."*
then add it to `src/voiceover/manifest.ts` and run `npm run voiceovers:generate`. Place it at 69.9 s in `tools/edit.json` and rebuild.
