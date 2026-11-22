# Feature video — voiceover added

**Output:** `feature-video-with-voiceover.mp4`, the supplied 60 s feature video (848×478, 30 fps) with narration
added. The picture is copied untouched; the video's own music is kept and ducked under the voice (about 12 dB below
it while he speaks, rising back between lines). Mix: −14 LUFS.

| File | What it is |
|---|---|
| `feature-video-with-voiceover.mp4` | Final video |
| `source/feature-video-original.mp4` | The video as supplied |
| `audio/voiceover.wav` | Narration alone, on the video's timeline |
| `audio/final-mix.wav` | Narration + ducked original music |
| `captions.srt` | Captions, word for word with the narration (not burned in) |
| `vo-lines.json` | Script and the scene window each line must fit |
| `tools/generate.py`, `tools/mix.py` | Regenerate the voice / rebuild the mix and video |

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
| 56.8s | Download free, and start your journey of praise. |

Lines match the on-screen headings: Experience the Power of True Praise · LoveWorld songs · Read Stories That Inspire
Faith · Listen everywhere you go · Stay Connected, Watch Live · Save Testimonies, Watch Offline · Outreach & Crusade
Resource Centre · Ask. Discover. Be Inspired (Praxiom) · A living expression of God's goodness · Start Your Journey of Praise.

## Rebuild
```bash
python3 tools/generate.py <kokoro_model_dir>   # kokoro-v1.0.onnx + voices-v1.0.bin
python3 tools/mix.py
```
