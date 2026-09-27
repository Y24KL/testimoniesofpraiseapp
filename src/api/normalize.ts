import type { AppNotification, LiveConfig, LiveSourceType, NotificationType, Testimony } from '@/types';
import { isYouTubeUrl } from '@/utils/youtube';
import { isHls } from '@/utils/format';

/**
 * The website's exact schema could not be inspected while this project was generated, so these
 * mappers accept several common field names. When you confirm the real schema, trim the alias lists.
 */
type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const pick = (r: Raw, keys: string[]): any => { // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const k of keys) if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k];
  return undefined;
};

export function toIso(v: any): string | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return new Date(v).toISOString();
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  if (typeof v._seconds === 'number') return new Date(v._seconds * 1000).toISOString();
  return null;
}

function toSeconds(v: any): number | undefined { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.includes(':')) {
    return v.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toKeywords(v: any, extra: (string | undefined)[]): string[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const base = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  return [...base, ...extra].filter(Boolean).map((s) => String(s).trim().toLowerCase());
}

const isPublished = (r: Raw): boolean => {
  const v = pick(r, ['isPublished', 'published']);
  if (typeof v === 'boolean') return v;
  if (r.status) return String(r.status).toLowerCase() === 'published';
  return true;
};

export function normalizeTestimony(id: string, r: Raw): Testimony {
  const authorName = pick(r, ['authorName', 'author', 'testifier', 'testifierName', 'name']);
  const category = pick(r, ['category', 'zone']);
  return {
    id,
    title: String(pick(r, ['title', 'name']) ?? 'Untitled testimony'),
    description: String(pick(r, ['description', 'summary', 'testimony', 'body']) ?? ''),
    authorName,
    thumbnail: pick(r, ['thumbnail', 'thumbnailUrl', 'thumb', 'image', 'imageUrl', 'poster']),
    videoUrl: String(pick(r, ['videoUrl', 'video_url', 'video', 'url', 'streamUrl']) ?? ''),
    duration: toSeconds(pick(r, ['duration', 'durationSeconds'])),
    category,
    keywords: toKeywords(r.keywords ?? r.tags, [category, authorName, r.title]),
    createdAt: toIso(pick(r, ['createdAt', 'created_at', 'date'])),
    publishedAt: toIso(pick(r, ['publishedAt', 'published_at'])),
    isPublished: isPublished(r),
    isFeatured: pick(r, ['isFeatured', 'featured']) === true,
    // Safe default: downloads are only offered when the admin explicitly allows them.
    isDownloadable: pick(r, ['isDownloadable', 'downloadable', 'allowDownload']) === true,
  };
}

const NOTIF_TYPES: NotificationType[] = ['testimony', 'resource', 'live', 'announcement', 'featured'];

export function normalizeNotification(id: string, r: Raw): AppNotification {
  const t = String(pick(r, ['type']) ?? 'announcement').toLowerCase() as NotificationType;
  return {
    id,
    title: String(pick(r, ['title']) ?? ''),
    message: String(pick(r, ['message', 'body']) ?? ''),
    type: NOTIF_TYPES.includes(t) ? t : 'announcement',
    contentId: pick(r, ['contentId', 'content_id']),
    createdAt: toIso(pick(r, ['createdAt', 'created_at'])),
    published: pick(r, ['published', 'isPublished']) !== false,
  };
}

export function normalizeLive(r: Raw | undefined | null): LiveConfig {
  if (!r) return { isLive: false };
  const streamUrl = pick(r, ['streamUrl', 'stream_url', 'hlsUrl', 'url', 'm3u8']);
  const declared = pick(r, ['sourceType', 'source_type']) as LiveSourceType | undefined;
  const sourceType: LiveSourceType =
    declared === 'hls' || declared === 'youtube'
      ? declared
      : !streamUrl
        ? 'unknown'
        : isYouTubeUrl(streamUrl)
          ? 'youtube'
          : isHls(streamUrl)
            ? 'hls'
            : 'unknown';
  return {
    isLive: pick(r, ['isLive', 'live', 'is_live', 'active']) === true && !!streamUrl,
    streamUrl,
    sourceType,
    sessionId: pick(r, ['sessionId', 'session_id']),
    title: pick(r, ['title']),
    thumbnail: pick(r, ['thumbnail', 'poster']),
    description: pick(r, ['description']),
  };
}
