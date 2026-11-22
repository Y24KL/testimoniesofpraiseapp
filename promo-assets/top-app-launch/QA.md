# QA: T.O.P. landscape promo

## Output checks (run on the rendered files)
| Check | Result |
|---|---|
| Resolution / aspect | 1920×1080, 16:9 (ffprobe) |
| Frame rate / frames | 30 fps, 2280 frames = 76.0 s, both versions |
| Codecs | H.264 High, yuv420p; AAC 256 kb/s, 48 kHz |
| Loudness | −15.8 LUFS integrated, −1.5 dBFS peak (ebur128) |
| Black frames | Only the planned 0.37 s fade-in at the start (blackdetect) |
| Narration placement | Silence gaps fall exactly between the lines in `tools/edit.json`; no clipped words. "time" and "offer" were cut off in an earlier build and fixed. |
| Captions | 29 cues generated from word-level forced alignment of the approved scripts; text matches the narration |
| QR code | Decoded from a frame of the final video: `https://web.lwappstore.com/share/lW-APP-Y26-PJ8225` (link returns 302 to the store) |
| Visual review | Contact sheet every 5 s plus full-size stills of every scene reviewed. Fixed: the pop-out card overlapped the headline, and the hook wall was too busy behind the words. |

## Content checks
- Every feature shown is in the evidence matrix (`storyboard.md`) as implemented in source.
- All narration is owner-approved wording, taken from existing approved recordings. Nothing was synthesised or invented.
- "500+ testimonies" comes from the owner's approved `tutorial.intro` script.
- No radio schedule, ratings, user counts or endorsements are shown.
- Privacy: the home-screen greeting name was replaced with "Friend". The phone's real status bar (time, battery, notification icons) was removed. No admin screens are shown. Testimony thumbnails and names are already-published public content.
- Music is the team's own `tutorial-bed.mp3`; the whooshes and swells were synthesised.

## Known limitations
- **Reference video not used.** I couldn't open the YouTube link: the environment blocks YouTube, and the request to allow it was declined. The visual direction follows the brand and the promo brief instead.
- **No spoken CTA.** No approved "download" narration exists, so the closing call to action is on screen only. See `voiceover-script.md` for adding one.
- **Older screen captures.** Screens come from the existing phone captures (Oct 2026 content). The app wasn't run with live data here, because there's no Firebase config in this environment. Live and TOP Radio are shown in their real offline state.
- **The voice isn't the default the promo brief asks for.** The brief defaults to a warm male voice with Nigerian/West African English delivery. This uses the app's established narrator ("Brian", ElevenLabs) for brand consistency and because no TTS key was available here.
