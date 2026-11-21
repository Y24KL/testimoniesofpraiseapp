# T.O.P. promo — design reference

Everything here is taken from the repository; nothing was restyled for the promo.

## Colour (from `src/constants/theme.ts`, mirrored in `web/src/theme.ts`)
| Token | Hex | Use in the promo |
|---|---|---|
| `bg` | `#12001C` | Base background of every scene |
| `primary` | `#4B006E` | Large background glows |
| `primaryDark` | `#2E0044` | Gradient depth |
| `primaryLight` | `#7A1FA2` | Upper-left glow, phone halo |
| `accent` (brand gold) | `#F5C542` | Kickers, highlight rings, gold headline words, particles |
| `accentDeep` / gold gradient | `#FFE08A → #F5C542 → #D99A1E` | `gradients.gold`; headline accent words and CTA button |
| `onAccent` | `#2A0040` | Text on the gold button |
| `textMuted` | `#CDBBDD` | Sub-headlines |
| `live` | `#FF3B4E` | LIVE pill only |

## Type
Plus Jakarta Sans (the website loads it in `web/index.html`), weights 500–800, files in `assets/fonts/`
(SIL Open Font License, from Google Fonts). Headlines 64–80 px / 800, kickers 22 px / 800 with wide tracking,
sub-lines 32 px / 500, captions 36 px / 600 on a dark pill.

## Logo
`assets/brand/logo.png` = `web/public/logo.png` (600×431, the logo shown on the website and the download landing page).
Used unaltered: no recolour, no stretch; scaled uniformly with clear space, a soft gold drop-glow and a light sweep
masked to the logo's own alpha.

## App visuals
All phone screens are real device captures of the current app (from `brag-output/work-vertical/`), status bar removed:
Home, Testimonies, Watch Live, Listen, Praxiom. The account holder's first name was painted out of the Home greeting
and the Menu was cropped below the profile card, so no personal data appears. Cards floating beside the phone are
crops of those same captures (Read testimonies banner, "We're not live yet", TOP Radio card, Explore grid, menu rows).

## Motion language
- Deep purple glows that drift slowly; gold dust particles rising (echoes the musical-note motif of the download landing page).
- One shared phone that glides between sides (right → left → right) instead of hard cuts, so the app stays the hero.
- Cards "lift out" of the phone with a gentle overshoot (easeBack), text columns rise 40 px and fade.
- Gold light streaks only on the four big transitions (logo, Live, "and more", CTA).
- Tilt kept to ≤10° so the UI stays readable.

## Canvas
1920×1080, 16:9, 30 fps. Titles inside a 150 px side margin; captions centred 46 px from the bottom.
