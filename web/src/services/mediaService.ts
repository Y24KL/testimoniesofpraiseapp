/**
 * Unified Media Service (Web PWA)
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
  quality?: 'auto' | 'high' | 'low';
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

export function isBunnyUrl(url: string | null | undefined): boolean {
  return identifyProvider(url) === 'bunny';
}

export function isCloudinaryUrl(url: string | null | undefined): boolean {
  return identifyProvider(url) === 'cloudinary';
}

export function isHlsUrl(url: string | null | undefined): boolean {
  return identifyProvider(url) === 'hls';
}

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

  if (provider === 'cloudinary' && options?.optimizeImage && trimmed.includes('/image/upload/')) {
    if (!trimmed.includes('/f_auto,q_auto/')) {
      return trimmed.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
    }
  }

  return trimmed;
}

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
