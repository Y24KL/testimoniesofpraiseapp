# QA report

## Output verified (ffprobe / ffmpeg on the final file)
| Check | Result |
|---|---|
| Container / codecs | MP4, H.264 (yuv420p, CRF 16) + AAC 256 kb/s 48 kHz |
| Resolution / aspect | 1920×1080, 16:9 landscape |
| Frame rate / frames | 30 fps, 2,424 frames = 80.8 s (video and audio both 80.800 s) |
| Black frames | Only 0–0.27 s (intentional fade from black) |
| Chunk seams (rendered in 4 parallel parts) | Frames on both sides of 19 s, 38 s, 57 s checked visually: continuous |
| Captions vs voice | Caption text is the narration script word for word; breaks snapped to detected pauses. 2,766 of 2,770 speech frames (20 ms) are under a caption; the 4 uncovered are breath edges |
| Loudness | −13.9 LUFS integrated (−1.4 dBTP), narration ≈ 12–14 dB above the ducked music bed |
| QR code | Decoded from a frame of the final MP4 → `https://web.lwappstore.com/share/lW-APP-Y26-PJ8225` (matches `STORE_URL` in `web/src/pages/DownloadLandingPage.tsx`) |
| Captions | 30 cues, ≤50 characters, never spanning two sentences; burned-in and `captions.srt` come from the same `timeline.json` |
| Frames reviewed | Stills at 15, 26.5, 33, 42.6, 47.5, 53, 55.5, 68, 72.5 s and seam frames; text inside safe margins, nothing overlapping the captions |
| LoveWorld AppStore logo | Downloaded from the store's own site header (`web.lwappstore.com/images/logo-for-appstore.jpg`), used unaltered |
| Privacy | Account holder's name painted out of the Home greeting; menu cropped below the profile card; no admin screens, emails, tokens or bank details appear |
| Production code | Untouched; all work is in `promo-assets/top-app-launch/` |

## Known limitations — please review
1. **I could not listen to the audio.** This environment has no speakers and no speech-recognition model, so pronunciation
   (especially "Praxiom", spelled "Praxium" for the TTS, and "LoveWorld") and the music/voice balance were checked by
   numbers only. Please listen before publishing.
2. **Voice is a neural TTS (Kokoro, US-English male `am_michael`)**, not a human or ElevenLabs read; no West African-accented
   voice was available offline. ElevenLabs (the app's provider) was blocked by the network here and had no key.
   To swap the voice, follow `voiceover-script.md` → "Replacing the voice"; the edit re-times itself.
3. **The share link opens the store's home page, not the T.O.P. listing.** `https://web.lwappstore.com/share/lW-APP-Y26-PJ8225`
   (from the download landing page, and what the QR encodes) redirected to `https://web.lwappstore.com/` when fetched here.
   It may need the LoveWorld AppStore app or a sign-in to open the listing; please test the QR on a phone. If you have a
   direct listing URL, replace `url` in the QR step (see README) and re-render. `testimoniesofpraiseapp.com` was not reachable from here.
4. **Radio scene.** The Wednesday 1 PM GMT+1 LoveWorld Radio slot was supplied by the owner (it is not in the repository).
   The phone shows the real Listen screen as captured, which says "TOP Radio is off air" and "No audio testimonies yet",
   while the narration invites people to listen to audio testimonies. Publish audio testimonies (or supply a newer Listen
   screenshot) so the screen matches. "24/7" and "500+ testimonies" were left out as unverified.
8. **Runtime is 80.8 s**, above the original 60–75 s brief, because the radio line (10.5 s) and the full brand line were added.
5. **Typing in the Praxiom input (41–46 s) is illustrative**: the screen is real and the text is the app's own quick prompt
   ("Help me find a testimony."), but it's overlaid; no assistant answer is shown or invented.
6. App screens are stills from a real device, animated inside a realistic phone built in CSS (not a photo of a physical phone). There's no screen recording of real scrolling or playback,
   because the app couldn't be run here (no device, emulator or credentials).
7. "Free" on the LoveWorld App Store is taken from the landing page copy ("Download the app for free").
