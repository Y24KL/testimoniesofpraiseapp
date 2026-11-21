# QA report

## Output verified (ffprobe / ffmpeg on the final file)
| Check | Result |
|---|---|
| Container / codecs | MP4, H.264 (yuv420p, CRF 16) + AAC 256 kb/s 48 kHz |
| Resolution / aspect | 1920×1080, 16:9 landscape |
| Frame rate / frames | 30 fps, 2,235 frames = 74.5 s (video and audio both 74.500 s) |
| Black frames | Only 0–0.27 s (intentional fade from black) |
| Chunk seams (rendered in 4 parallel parts) | Frames on both sides of 19 s, 38 s, 57 s checked visually: continuous |
| Loudness | −13.9 LUFS integrated, narration ≈ 12–14 dB above the ducked music bed |
| QR code | Decoded from a frame of the final MP4 → `https://web.lwappstore.com/share/lW-APP-Y26-PJ8225` (matches `STORE_URL` in `web/src/pages/DownloadLandingPage.tsx`) |
| Captions | 23 cues, ≤58 characters, same text as `voiceover-lines.json`; burned-in and `captions.srt` come from the same `timeline.json` |
| Frames reviewed | Stills at 2.8, 7, 11, 16, 21.5, 26.5, 34.5, 40, 46.5, 52.5, 60.5, 65.5, 70, 71 s and seam frames; text inside safe margins, nothing overlapping the captions |
| Privacy | Account holder's name painted out of the Home greeting; menu cropped below the profile card; no admin screens, emails, tokens or bank details appear |
| Production code | Untouched; all work is in `promo-assets/top-app-launch/` |

## Known limitations — please review
1. **I could not listen to the audio.** This environment has no speakers and no speech-recognition model, so pronunciation
   (especially "Praxiom", spelled "Praxium" for the TTS, and "LoveWorld") and the music/voice balance were checked by
   numbers only. Please listen before publishing.
2. **Voice is a neural TTS (Kokoro, US-English male `am_michael`)**, not a human or ElevenLabs read; no West African-accented
   voice was available offline. ElevenLabs (the app's provider) was blocked by the network here and had no key.
   To swap the voice, follow `voiceover-script.md` → "Replacing the voice"; the edit re-times itself.
3. **CTA links not opened live**: the network here blocks `web.lwappstore.com` and `testimoniesofpraiseapp.com`.
   Both come from the shipped download landing page. Please open both once before release.
4. **Radio is off air in production** (`docs/REDESIGN_2026.md`), so the Listen scene shows the real "off air" screen and the
   narration says "when the radio is on air". "24/7", "500+ testimonies" and the Wednesday radio slot were left out as unverified.
5. **Typing in the Praxiom input (43–50 s) is illustrative**: the screen is real and the text is the app's own quick prompt
   ("Help me find a testimony."), but it's overlaid; no assistant answer is shown or invented.
6. App screens are stills from a real device, animated in a phone frame. There's no screen recording of real scrolling or playback,
   because the app couldn't be run here (no device, emulator or credentials).
7. "Free" on the LoveWorld App Store is taken from the landing page copy ("Download the app for free").
