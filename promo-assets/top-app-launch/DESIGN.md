# T.O.P. promo: design reference

Everything here comes from the repository, not invented.

## Palette (`web/src/theme.ts`, mirrors `src/constants/theme.ts`)
| Token | Hex | Use in the promo |
|---|---|---|
| bg | `#12001C` | Canvas, vignette base |
| primary | `#4B006E` | Glow, phone frame |
| primaryDark | `#2E0044` | Gradients |
| primaryLight | `#7A1FA2` | Radial glow, scrub-bar gradient |
| accent (gold) | `#F5C542` | Eyebrows, chips, highlights |
| gold gradient | `#FFE08A → #F5C542 → #D99A1E` | Headline accents, CTA button (`gradients.gold`) |
| card / border | `#2A1240` / `#3A2253` | Chips, cards |
| textMuted / textSubtle | `#CDBBDD` / `#9C86B3` | Body copy |
| live | `#FF3B4E` | LIVE badge |

## Type
Plus Jakarta Sans, the web app's font (`web/index.html`), weights 500–800. It's embedded locally as `assets/fonts/PlusJakartaSans-var.woff2`, so renders don't depend on the network.

## Logo
`web/public/logo.png`, the official trumpets-and-flags crest, used unaltered. It's never recoloured, stretched or redrawn, and always shown on the dark purple field with generous clear space.

## UI treatment
- Real phone captures from the app (`brag-output/work-vertical/*.jpg`, 900×2000), with the phone's own status bar trimmed and replaced by a neutral "9:41" bar.
- Home greeting name replaced with "Friend" (privacy).
- Phone frame: 58 px radius, gold hairline edge, deep shadow, purple ambient glow, soft glass glare. The perspective tilt stays at 16° or less so the UI remains readable.
- Chips use the app's own pill style: card surface, gold dot, gold-tinted border.

## Motion
- Slow and confident: cubic ease-out entrances with a short rise and a little blur coming into focus. No spins or flips.
- Kinetic words land on the narrator's exact word timings, taken from forced alignment.
- Two gold light sweeps only: the logo reveal and the CTA.
- Ambient gold particles and a slowly breathing purple glow give continuity between scenes.
