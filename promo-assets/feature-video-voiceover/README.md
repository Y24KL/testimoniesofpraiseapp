# Feature video — voiceover added

**Output:** `feature-video-with-voiceover.mp4`, 66 s, 848×478, 30 fps: the supplied feature video with narration,
plus a LoveWorld AppStore end card. The original picture runs unchanged to 59.5 s (where it began its fade to black),
then crossfades into the end card: "Download Free Today from the LoveWorld App Store", the official LoveWorld AppStore
logo on a "Download on the LoveWorld AppStore" badge, the QR code (→ `https://web.lwappstore.com/share/lW-APP-Y26-PJ8225`,
decoded from the final video), "Scan to download the T.O.P. app" and testimoniesofpraiseapp.com,
styled after the video's own scenes (lavender, deep purple, gold, Montserrat). Under the end card the original
music's closing section is crossfaded on and faded out. The picture holds on the end card to the last frame (no fade to black). the video's own music is kept and ducked under the voice (about 12 dB below
it while he speaks, rising back between lines). Mix: −14 LUFS.

| File | What it is |
|---|---|
| `feature-video-with-voiceover.mp4` | Final video |
| `source/feature-video-original.mp4` | The video as supplied |
| `audio/voiceover.wav` | Narration alone, on the video's timeline |
| `audio/final-mix.wav` | Narration + ducked original music |
| `captions.srt` | Captions, word for word with the narration (not burned in) |
| `vo-lines.json` | Script and the scene window each line must fit |
| `endcard/endcard.html` | Editable end card (HTML/CSS, `seek(t)`), with its fonts and images |
| `tools/generate.py`, `tools/render_endcard.mjs`, `tools/mix.py` | Regenerate the voice / render the end card / build the mix and final video |

Voice: Kokoro-82M (Apache-2.0), `am_michael`, speed 0.96 on every line, the same voice as the landscape promo.

## Script (each line starts as its scene settles)
| Start | Line |
|---|---|
| 0.5s | Welcome to Testimonies of Praise. |
| 3.8s | Experience the power of true praise, all in one place. |
| 10.8s | See how the songs of the LoveWorld Singers are changing lives. |
| 17.0s | Read stories that inspire faith, and stir your heart to praise. |
| 23.0s | Listen wherever you go. Audio keeps playing, even when your screen is locked. |
| 29.8s | Stay connected. Watch live, and enjoy testimonies while you wait. |
| 35.4s | Save your favourite testimonies, and watch them offline, anytime. |
| 41.0s | Find outreach and crusade resources, all in one place. |
| 46.9s | Ask Praxiom to help you discover testimonies, and find your way around. |
| 52.9s | Your story is a living expression of God's goodness. |
| 57.1s | Download Testimonies of Praise free from the LoveWorld App Store today. |
| 61.9s | Just scan the QR code to download the app. |

Lines match the on-screen headings: Experience the Power of True Praise · LoveWorld songs · Read Stories That Inspire
Faith · Listen everywhere you go · Stay Connected, Watch Live · Save Testimonies, Watch Offline · Outreach & Crusade
Resource Centre · Ask. Discover. Be Inspired (Praxiom) · A living expression of God's goodness · Start Your Journey of Praise.

## Rebuild
```bash
python3 tools/generate.py <kokoro_model_dir>   # kokoro-v1.0.onnx + voices-v1.0.bin
(cd endcard && python3 -m http.server 8766 &) ; NODE_PATH=$(npm root -g) node tools/render_endcard.mjs build/endcard.mp4 7.0
python3 tools/mix.py
```
