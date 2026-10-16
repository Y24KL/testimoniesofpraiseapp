/**
 * Unified Media Service (Mobile React Native / Expo)
 *
 * Implements provider detection, cross-platform playback URL resolution,
 * and routing between:
 * - Bunny Storage / CDN: Audio and large media files
 * - Cloudinary: Images, thumbnails, visual assets
 * - Firebase: Metadata and Firestore document storage
 * - HLS: Live streams and radio broadcasts
 */

export type MediaProvider = 'bunny' | 'cloudinary' | 'firebase' | 'hls' | 'external';
export type MediaType = 'audio' | 'image' | 'video' | 'large_file';

export interface PlaybackOptions {
  /** Optional quality preset (e.g. 'auto', 'high', 'low') */
  quality?: 'auto' | 'high' | 'low';
  /** For Cloudinary images: auto-format / auto-quality */
  optimizeImage?: boolean;
}

export interface MediaInfo {
  provider: MediaProvider;
  isHls: boolean;
  isStream: boolean;
  supportsByteRange: boolean;
}

/**
 * Detects the hosting provider of any given media URL.
 * Preserves full compatibility with existing Cloudinary, Firebase, and HLS URLs.
 */
export function identifyProvider(url: string | null | undefined): MediaProvider {
  if (!url || typeof url !== 'string') return 'external';
  const clean = url.trim().toLowerCase();

  // 1. HLS streams (.m3u8 or streaming endpoints)
  if (clean.includes('.m3u8') || clean.includes('/hls/')) {
    return 'hls';
  }

  // 2. Bunny Storage / Bunny CDN (b-cdn.net or custom CDN domain)
  if (
    clean.includes('.b-cdn.net') ||
    clean.includes('bunnycdn.com') ||
    clean.includes('storage.bunny') ||
    clean.includes('media.testimoniesofpraise.org')
  ) {
    return 'bunny';
  }

  // 3. Cloudinary (images, existing videos, receipts, banners)
  if (clean.includes('res.cloudinary.com') || clean.includes('cloudinary.com')) {
    return 'cloudinary';
  }

  // 4. Firebase Storage
  if (clean.includes('firebasestorage.googleapis.com')) {
    return 'firebase';
  }

  return 'external';
}

/**
 * Checks if a URL points to Bunny Storage / Bunny CDN
 */
export function isBunnyUrl(url: string | null | undefined): boolean {
  return identifyProvider(url) === 'bunny';
}

/**
 * Checks if a URL points to Cloudinary
 */
export function isCloudinaryUrl(url: string | null | undefined): boolean {
  return identifyProvider(url) === 'cloudinary';
}

/**
 * Checks if a URL is an HLS livestream or playlist
 */
export function isHlsUrl(url: string | null | undefined): boolean {
  return identifyProvider(url) === 'hls';
}

/**
 * Returns human-friendly provider name for display in UI badges
 */
export function getProviderDisplayName(provider: MediaProvider): string {
  switch (provider) {
    case 'bunny':
      return 'Bunny Storage (CDN)';
    case 'cloudinary':
      return 'Cloudinary';
    case 'firebase':
      return 'Firebase Storage';
    case 'hls':
      return 'Live Stream (HLS)';
    case 'external':
    default:
      return 'External Host';
  }
}

/**
 * Resolves a media URL for playback on mobile devices.
 * - Bunny CDN URLs: preserves standard byte-range playback for iOS/Android scrubbing.
 * - Cloudinary images: optimizes delivery when requested without breaking signatures.
 * - HLS streams: preserved untouched.
 * - Existing Cloudinary and Firebase URLs: preserved untouched with 100% backward compatibility.
 */
export function resolvePlaybackUrl(
  url: string | null | undefined,
  options?: PlaybackOptions,
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }

  const provider = identifyProvider(trimmed);

  // For Cloudinary image optimization:
  if (provider === 'cloudinary' && options?.optimizeImage && trimmed.includes('/image/upload/')) {
    // Avoid double transformation
    if (!trimmed.includes('/f_auto,q_auto/')) {
      return trimmed.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
    }
  }

  return trimmed;
}

/**
 * Returns media capability metadata for player configuration
 */
export function getMediaInfo(url: string | null | undefined): MediaInfo {
  const provider = identifyProvider(url);
  const isHls = provider === 'hls';

  return {
    provider,
    isHls,
    isStream: isHls,
    supportsByteRange: provider === 'bunny' || provider === 'cloudinary' || provider === 'firebase',
  };
}
