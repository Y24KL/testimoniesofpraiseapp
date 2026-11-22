# Testimonies of Praise: landscape app promo

1920×1080, 30 fps, 76 s, H.264 + AAC 48 kHz, with narration and captions. This is promo-only work: nothing in the app's build paths is touched.

## Files
| File | What |
|---|---|
| `top-app-promo-landscape.mp4` | Final video, captions burned in |
| `top-app-promo-landscape-nocaptions.mp4` | Clean version, for platforms that use `captions.srt` instead |
| `captions.srt` | Captions timed to the narration |
| `voiceover-script.md` | Narration, sources, pronunciation notes |
| `storyboard.md` | Timecoded scenes and the feature evidence matrix |
| `DESIGN.md` | Brand and motion reference |
| `QA.md` | Checks performed |
| `scene/` | The animation: `index.html` (layout) and `timeline.js` (deterministic timeline) |
| `tools/edit.json` | Narration edit list, music settings, duration |
| `tools/build_audio.py` | Builds the narration, mix, captions and word timings into `build/` |
| `tools/render.cjs` | Renders the frames with Playwright and encodes them with ffmpeg |
| `tools/align.py` | Forced alignment (pocketsphinx) of the approved scripts to the narration audio |
| `assets/` | Prepared UI captures, thumbnails, logo, font, QR |

## Rebuild
```bash
cd promo-assets/top-app-launch
pip install pocketsphinx          # only needed to re-run tools/align.py
python3 tools/build_audio.py      # build/voiceover.wav, build/mix.wav, captions.srt
node tools/render.cjs --stills 10,40   # quick look -> build/stills/
node tools/render.cjs             # full render (about 8 min)
node tools/render.cjs --no-captions
```
Needs Node with `playwright` (Chromium) and ffmpeg. To preview with sound, serve the folder and open `scene/index.html?play`, then click.

## Sources
- Narration: the app's approved ElevenLabs recordings in `assets/voiceovers/`.
- Music: `assets/audio/tutorial-bed.mp3`, the team's own recording (see `docs/VOICEOVERS.md`).
- Whooshes and swells: synthesised in `build_audio.py`.
- Screens: real app captures from `brag-output/work-vertical/`, with the account name and phone status bar removed.
