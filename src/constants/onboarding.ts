/**
 * ONBOARDING MEDIA: the one place that decides what shows behind the Welcome screen.
 *
 * Set it with environment variables (eas.json `env`, or .env for local builds):
 *   EXPO_PUBLIC_ONBOARDING_MEDIA_TYPE   'image' | 'video'   (optional: guessed from the URL)
 *   EXPO_PUBLIC_ONBOARDING_MEDIA_URL    https URL of the image or video (MP4/H.264 or HLS .m3u8)
 *   EXPO_PUBLIC_ONBOARDING_POSTER_URL   optional still image shown while a video loads, on
 *                                       metered data, with reduce-motion, or if the video fails
 *   EXPO_PUBLIC_ONBOARDING_OVERLAY      optional 0..1 darkness of the readability overlay (0.55)
 *
 * Or change it without a new build by creating the Firestore document `settings/onboarding`
 * with fields { mediaType, mediaUrl, posterUrl, overlayOpacity }. The app uses the last value it
 * fetched immediately and refreshes it in the background (see useOnboardingMedia).
 *
 * With no URL configured the screen shows the branded purple/gold background. No placeholder
 * link is hard-coded on purpose. See docs/ONBOARDING_MEDIA.md.
 */
export type OnboardingMediaType = 'image' | 'video' | 'none';

export interface OnboardingMedia {
  type: OnboardingMediaType;
  url: string;
  posterUrl?: string;
  /** 0..1 */
  overlayOpacity: number;
}

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|m3u8)(\?|#|$)/i;

export function resolveOnboardingMedia(raw: {
  type?: string | null;
  url?: string | null;
  posterUrl?: string | null;
  overlayOpacity?: number | string | null;
}): OnboardingMedia {
  const url = (raw.url ?? '').trim();
  const posterUrl = (raw.posterUrl ?? '').trim() || undefined;
  const declared = (raw.type ?? '').trim().toLowerCase();
  const opacity = Number(raw.overlayOpacity);
  const overlayOpacity = Number.isFinite(opacity) && raw.overlayOpacity !== '' && raw.overlayOpacity != null ? Math.min(1, Math.max(0, opacity)) : 0.55;
  if (!/^https?:\/\//i.test(url)) {
    return { type: posterUrl ? 'image' : 'none', url: posterUrl ?? '', overlayOpacity };
  }
  const type: OnboardingMediaType = declared === 'video' || declared === 'image' ? declared : VIDEO_EXT.test(url) ? 'video' : 'image';
  return { type, url, posterUrl, overlayOpacity };
}

export const ONBOARDING_MEDIA: OnboardingMedia = resolveOnboardingMedia({
  type: process.env.EXPO_PUBLIC_ONBOARDING_MEDIA_TYPE,
  url: process.env.EXPO_PUBLIC_ONBOARDING_MEDIA_URL,
  posterUrl: process.env.EXPO_PUBLIC_ONBOARDING_POSTER_URL,
  overlayOpacity: process.env.EXPO_PUBLIC_ONBOARDING_OVERLAY,
});
