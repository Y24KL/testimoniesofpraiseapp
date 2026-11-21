# Voiceover script — Testimonies of Praise app promo (75 s)

**Voice:** warm, mature male, conversational and sincere (not trailer-style).
**Rendered with:** Kokoro-82M neural TTS (Apache-2.0 open model, voice `am_michael`, speed 0.96) via `kokoro-onnx`.
ElevenLabs (the app's own voice provider, voice "Brian", see `docs/VOICEOVERS.md`) could not be reached from the
production environment and no API key was available. To swap in a recorded or ElevenLabs read, see "Replacing the voice".

**Word count:** 168 words · speech ≈ 63 s inside a 75 s edit.

**Captions = narration, word for word.** `voiceover-lines.json` holds one `text` per line, and that exact text is both what
the voice reads and what the captions show. Caption breaks are placed at the real pauses detected in each line's audio.

| # | Start | Line |
|---|---|---|
| L01 | 0:01.0 | Every testimony carries a story. |
| L02 | 0:03.8 | A moment when God showed up, and a song made all the difference. |
| L03 | 0:08.8 | This is the Testimonies of Praise app. |
| L04 | 0:12.3 | Watch powerful testimonies of healing, deliverance, and miracles. Real stories, from people whose lives were touched by the songs of the LoveWorld Singers. |
| L05 | 0:23.5 | Prefer to read? Written testimonies are right there too. |
| L06 | 0:27.6 | Join the live broadcast, and chat with others as it happens. Not live yet? Watch a testimony while you wait. |
| L07 | 0:35.4 | When the radio is on air, keep listening, even with your screen locked. |
| L08 | 0:40.5 | Ask Praxiom to help you find a testimony, or find your way around. |
| L09 | 0:45.9 | Save testimonies to watch offline, wherever you are. |
| L10 | 0:50.0 | Worship with the LoveWorld Singers, discover the meaning behind the songs, and share your own testimony. |
| L11 | 0:57.2 | No one ever praised God and went away empty. He always blesses you for praising Him. |
| L12 | 1:03.2 | Download Testimonies of Praise, free on the LoveWorld App Store. |
| L13 | 1:08.0 | Just scan the QR code to download the app. |
| L14 | 1:12.0 | Thank you, and God bless you. |

"No one ever praised God and went away empty. He always blesses you for praising Him." is the brand line from the download landing page
(`web/src/pages/DownloadLandingPage.tsx`).

## Pronunciation
- **Testimonies of Praise** — TES-ti-moh-neez of PRAYZ.
- **T.O.P.** — shown on screen only ("The T.O.P. app"); not spoken.
- **LoveWorld** — LUV-world, one word.
- **Praxiom** — PRAK-see-um. Said on its own, without "AI". The TTS is fed "Praxium" for the sound; the caption shows "Praxiom".
- **QR** — "Q. R.", letters.

## Replacing the voice
1. Record or generate one file per line, named `audio/vo-lines/L01.wav` … `L14.wav` (any sample rate).
2. Run `python3 tools/build_timeline.py` (re-times captions to the new audio; edit `VO_START` if a line got longer).
3. Run `python3 tools/mix_audio.py`, then render (see README.md).
