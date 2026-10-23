/**
 * ONBOARDING MEDIA (website): the one place that decides what shows behind the Welcome page.
 *
 * Set at build time (Render > Environment, or web/.env):
 *   VITE_ONBOARDING_MEDIA_TYPE   'image' | 'video'  (optional: guessed from the URL)
 *   VITE_ONBOARDING_MEDIA_URL    https URL of the image or video (MP4/H.264 recommended; .m3u8 works)
 *   VITE_ONBOARDING_POSTER_URL   optional still image for videos (loading, reduce-motion, data saver, failure)
 *   VITE_ONBOARDING_OVERLAY      optional 0..1 darkness of the readability overlay (0.55)
 *
 * Or without a rebuild: Firestore document `settings/onboarding` { mediaType, mediaUrl, posterUrl,
 * overlayOpacity }, shared with the mobile app. See docs/ONBOARDING_MEDIA.md.
 * No URL configured = branded purple/gold background (no placeholder link on purpose).
 */
export type OnboardingMediaType = 'image' | 'video' | 'none';

export interface OnboardingMedia {
  type: OnboardingMediaType;
  url: string;
  posterUrl?: string;
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
  const n = Number(raw.overlayOpacity);
  const overlayOpacity = raw.overlayOpacity != null && raw.overlayOpacity !== '' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.55;
  if (!/^https?:\/\//i.test(url)) return { type: posterUrl ? 'image' : 'none', url: posterUrl ?? '', overlayOpacity };
  const type: OnboardingMediaType = declared === 'video' || declared === 'image' ? declared : VIDEO_EXT.test(url) ? 'video' : 'image';
  return { type, url, posterUrl, overlayOpacity };
}

export const ONBOARDING_MEDIA = resolveOnboardingMedia({
  type: import.meta.env.VITE_ONBOARDING_MEDIA_TYPE as string | undefined,
  url: import.meta.env.VITE_ONBOARDING_MEDIA_URL as string | undefined,
  posterUrl: import.meta.env.VITE_ONBOARDING_POSTER_URL as string | undefined,
  overlayOpacity: import.meta.env.VITE_ONBOARDING_OVERLAY as string | undefined,
});
