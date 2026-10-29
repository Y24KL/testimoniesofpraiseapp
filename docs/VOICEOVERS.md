# Voiceovers (ElevenLabs)

All spoken narration in the app comes from ElevenLabs. No other speech provider is used.

## Where things live

| What | Where |
|---|---|
| Approved script, version, voice, captions, audio URL | `src/voiceover/manifest.ts` (one entry per narration) |
| Voice and model settings | `VOICEOVER_CONFIG` in `src/voiceover/manifest.ts` |
| Drafts generated for listening | `voiceover-drafts/` (git-ignored, never shipped) |
| Playback rules (once per visit, no interruption of radio, etc.) | `src/voiceover/logic.ts` |
| Playback provider, mute, sign-out and background cleanup | `src/voiceover/VoiceoverProvider.tsx` |
| Welcome tour steps (on-screen descriptions and destinations) | `src/voiceover/tutorial.ts` |
| Tour card on screen | `src/voiceover/TutorialOverlay.tsx` |
| Feature narration on the six destinations | `useFeatureVoiceover(...)` in the screen files |
| Tests | `tests/voiceover.test.mjs` (`npm run test:voiceover`, see package.json) |

## Adding an approved script

1. In `src/voiceover/manifest.ts`, find the entry (for example `feature.sponsor`).
2. Paste the approved text into `script`, set `captions` if they should differ from the script, and set `status: 'approved'`.
3. Bump `version` (2, 3, …) whenever the wording changes. The cache key includes the version, so listeners never hear old audio.
4. Run `npm run voiceovers:plan` to see what would be generated. This makes no API calls.
5. Run `npm run voiceovers:generate`. Drafts are written to `voiceover-drafts/`. Existing drafts are kept; regenerate one with `npm run voiceovers:generate -- --force --id=feature.sponsor`.
6. Listen to the draft and approve it.
7. Upload the approved mp3 to the CDN used for other media (Bunny), and set `asset: { url: 'https://…' }` and `status: 'generated'` in the manifest.
8. Test on a device: open the screen, check the audio, and check that it can be stopped.

Until step 7, the app shows the caption text only. Nothing is played as if it were final.

## Voice

The default voice is Brian ("Deep, Resonant and Comforting"), set in `VOICEOVER_CONFIG.voiceId`. Any voice ID from the ElevenLabs library can be used. Set `voiceId` on an entry to use a different voice for that one narration.

Model: `eleven_multilingual_v2` (listed as available by ElevenLabs `/v1/models`). Check current pricing and the commercial licence for your plan before publishing audio.

## Keys and secrets

- `ELEVENLABS_API_KEY` lives in `.env.local` (git-ignored). It's read only by the generator script on your computer.
- Do not add the key with an `EXPO_PUBLIC_` prefix. Anything with that prefix is bundled into the app.
- The mobile app and the website never call ElevenLabs directly. Only pre-generated audio files are played.

## Behaviour

- Narration starts only on a deliberate action: a feature screen being opened, or a tour step being chosen.
- It doesn't start while TOP Radio or a testimony is playing, and it never talks over the welcome tour.
- Narration stops when the user signs out, when the app leaves the foreground, or when the tour is skipped or finished.
- If audio is missing, the screen still works; the caption text is shown where available.

## Not yet built

- **Web:** the tour and narration are not implemented for the website yet.
- **Replay from Settings/Help:** the tour can only start for a brand-new account.
- **Cross-device tour state:** completion is stored on the device only. The remote record is a separate step.
- **Dynamic speech (assistant responses):** no endpoint yet. It needs a server-side ElevenLabs call with limits.
- **Background music:** not included. It needs a licence before any track is used.
