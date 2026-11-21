# Testimonies of Praise — landscape app promo

Final film: **`top-app-promo-landscape.mp4`** — 1920×1080, 16:9, 30 fps, 80.8 s, H.264 + AAC 48 kHz, captions burned in.

| File | What it is |
|---|---|
| `top-app-promo-landscape.mp4` | Final render |
| `captions.srt` | Caption file (same text and timing as the burned-in captions) |
| `audio/voiceover.wav` | Clean narration on the edit's timeline (48 kHz mono) |
| `audio/final-mix.wav` | Final mix: narration + ducked music + effects, −14 LUFS |
| `audio/sfx.wav`, `audio/vo-lines/` | Sound-design stem, one WAV per narration line |
| `voiceover-script.md` | Script, timings, pronunciation notes |
| `storyboard.md` | Feature evidence matrix + timecoded scene table |
| `DESIGN.md` | Brand + motion reference |
| `QA.md` | Checks performed and known limitations |
| `compose.html` | **Editable motion project** (HTML/CSS/JS, every frame is a function of time) |
| `timeline.json`, `voiceover-lines.json` | Data the composition and mix read |
| `tools/` | Voice generation, timeline/caption build, audio mix, frame renderer, assembly |
| `assets/` | Only the approved assets the edit uses (real app captures, logo, QR, fonts) |

## Editing
- **Copy, layout, motion:** edit `compose.html`. Preview a frame: `python3 -m http.server 8765` in this folder, open
  `http://127.0.0.1:8765/compose.html?t=21.5`, or `?play` for a real-time preview (no audio).
- **Narration text:** edit `voiceover-lines.json` (`text` = captions, `say` = what the TTS reads), then regenerate.
- **Timing:** `VO_START` in `tools/build_timeline.py`; scene timings live in `seek()` in `compose.html`.

## Rebuild from scratch
```bash
pip install kokoro-onnx soundfile          # + model files kokoro-v1.0.onnx, voices-v1.0.bin in <model_dir>
python3 tools/generate_voiceover.py <model_dir> am_michael 0.96
python3 tools/build_timeline.py
python3 tools/mix_audio.py
python3 -m http.server 8765 &              # serve this folder
NODE_PATH=$(npm root -g) node tools/render.mjs build/part_0.mp4 0 80.8   # needs Playwright + Chromium
tools/assemble.sh
```
Rendering can be split into parallel chunks (`... build/part_19.mp4 19 38` etc.); `assemble.sh` joins every `build/part_*.mp4`.

## Licensing
- Music: `assets/audio/tutorial-bed.mp3` from this repo — the team's own recording (`docs/VOICEOVERS.md`).
- Sound effects: synthesized from scratch in `tools/mix_audio.py`.
- Voice: Kokoro-82M, Apache-2.0.
- Font: Plus Jakarta Sans, SIL Open Font License.
- App screens, testimony thumbnails and logo: the project's own published content.

## QR code
`assets/brand/qr-lwappstore.png` encodes `https://web.lwappstore.com/share/lW-APP-Y26-PJ8225` (the `STORE_URL` in
`web/src/pages/DownloadLandingPage.tsx`). To point it elsewhere:
```bash
python3 -c "import qrcode; q=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=16, border=1); q.add_data('NEW_URL'); q.make(); q.make_image(fill_color=(18,0,28), back_color=(255,255,255)).save('assets/brand/qr-lwappstore.png')"
```
