# Testimonies of Praise — Web & iOS PWA

A mobile-first Progressive Web App (PWA) built specifically for **iOS users** (iPhone & iPad via Safari/WebKit) and mobile web browsers. Visually and functionally identical to the Android application.

## Key Features & iOS Optimizations

1. **Exact Visual & UX Parity**:
   - Replicates the dark purple brand palette (`#12001C`, `#4B006E`, `#7A1FA2`, `#F5C542`).
   - Matching cards, hero banners, section headers, bottom tab navigation, shimmers, and status badges.
   - iOS elastic touch feedback (`-webkit-overflow-scrolling: touch`) and touch active states (`.touch-btn:active`).

2. **iOS Safari Safe Areas & Viewport**:
   - Integrated with `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
   - Prevents cutoffs on iPhone Dynamic Island, top notch, and the bottom Home Indicator bar.
   - Uses dynamic viewport units (`100dvh`) to prevent Safari URL bar jumpiness.

3. **Progressive Web App (PWA) & Home Screen Installation**:
   - Full `manifest.webmanifest`, `apple-touch-icon`, and `apple-mobile-web-app-capable` meta tags.
   - Integrated iOS **"Add to Home Screen"** walkthrough prompt that guides iPhone users on how to install the app directly to their Home Screen for a borderless, full-screen native experience.
   - Offline service worker (`sw.js`) caching app shell and static assets.

4. **Video Streaming & HLS (.m3u8)**:
   - Hardware-accelerated native HLS playback on iOS Safari (`application/vnd.apple.mpegurl`).
   - Seamless `hls.js` fallback for desktop and non-Safari browsers.
   - YouTube iframe player with origin security for YouTube streams.
   - LocalStorage playback position resumption (`top:playback:v1:{id}`).

5. **True Offline Downloads on Web**:
   - Downloads supported MP4 videos as Blobs stored in **IndexedDB** (`top_offline_db`).
   - Fully playable offline without network via `URL.createObjectURL`.
   - Complete download progress bar, storage size indicator, and deletion management.

6. **Full Firebase & Backend Parity**:
   - Authentication: Google Sign-In (`signInWithPopup` / `signInWithRedirect`), Email/Password with strong password validation, password reset, email verification banner.
   - Data: Real-time listener on `settings/live`, queries on `testimonies` and `notifications`.
   - Interactions: Real-time live chat (`liveChat/{sessionId}/messages`), live presence heartbeat (`liveViewers/{sessionId}/viewers/{uid}`), testimony submission (`testimonySubmissions`), sponsorship receipts upload to Cloudinary and `sponsorships` collection.

## Getting Started

### Development
From the root directory:
```bash
npm run web:dev
```
Or inside `web/`:
```bash
npm run dev
```

### Production Build
```bash
npm run web:build
```
The compiled output is located in `web/dist/`.

### Preview Production Build
```bash
npm run web:preview
```

## Deployment
The `web/dist` folder can be deployed to:
- Firebase Hosting (`firebase deploy --only hosting`)
- Vercel, Netlify, Render, or Cloudflare Pages
