# Voiceover script — Testimonies of Praise app promo (74.5 s)

**Voice:** warm, mature male, conversational and sincere (not trailer-style).
**Rendered with:** Kokoro-82M neural TTS (Apache-2.0 open model, voice `am_michael`, speed 0.92) via `kokoro-onnx`.
ElevenLabs (the app's own voice provider, voice "Brian", see `docs/VOICEOVERS.md`) could not be reached from the
production environment and no API key was available. To swap in a recorded or ElevenLabs read, see "Replacing the voice".

**Word count:** 156 words · speech ≈ 62 s inside a 74.5 s edit.

| # | Start | Line |
|---|---|---|
| L01 | 0:01.2 | Every testimony carries a story. |
| L02 | 0:04.0 | A moment when God showed up… and a song made all the difference. |
| L03 | 0:09.5 | This is the Testimonies of Praise app. |
| L04 | 0:13.3 | Watch powerful testimonies of healing, deliverance and miracles: real stories from people whose lives were touched by the songs of the LoveWorld Singers. |
| L05 | 0:24.8 | Prefer to read? Written testimonies are right there too. |
| L06 | 0:29.3 | Join the live broadcast and chat with others as it happens. Not live yet? Watch a testimony while you wait. |
| L07 | 0:37.5 | When the radio is on air, keep listening, even with your screen locked. |
| L08 | 0:43.0 | Ask Praxiom, your AI assistant, to help you find a testimony or find your way around. |
| L09 | 0:50.4 | Save testimonies to watch offline, wherever you are. |
| L10 | 0:55.0 | Worship with the LoveWorld Singers, discover the meaning behind the songs, and share your own testimony. |
| L11 | 1:02.9 | Because no one ever praised God and went away empty. |
| L12 | 1:07.6 | Download Testimonies of Praise, free on the LoveWorld App Store. |

L11 is the brand line from the download landing page (`web/src/pages/DownloadLandingPage.tsx`).

## Pronunciation
- **Testimonies of Praise** — TES-ti-moh-neez of PRAYZ.
- **T.O.P.** — shown on screen only ("The T.O.P. app"); not spoken, to avoid "tee-oh-pee" vs "top" ambiguity. Confirm the preferred spoken form before a human recording.
- **LoveWorld** — LUV-world, one word.
- **Praxiom** — PRAK-see-um (the TTS input is spelled "Praxium" to get this).
- **AI** — "A. I.", letters.

## Replacing the voice
1. Record or generate one file per line, named `audio/vo-lines/L01.wav` … `L12.wav` (any sample rate).
2. Run `python3 tools/build_timeline.py` (re-times captions to the new lengths; edit `VO_START` if a line got longer).
3. Run `python3 tools/mix_audio.py`, then render (see README.md).
