import type {
  WrittenTestimony,
  PreLiveMedia,
  AdotopocConfig,
  AppNotification,
  Article,
  AudioTestimony,
  LiveConfig,
  LiveSourceType,
  NotificationType,
  Promotion,
  RadioConfig,
  Testimony,
} from '@/types';
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
    // Every testimony is downloadable unless explicitly marked false
    isDownloadable: pick(r, ['isDownloadable', 'downloadable', 'allowDownload']) !== false,
  };
}

const NOTIF_TYPES: NotificationType[] = ['testimony', 'resource', 'live', 'announcement', 'featured', 'article', 'promotion', 'radio', 'written'];

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
  const isLive = pick(r, ['isLive', 'live', 'is_live', 'active']) === true && !!streamUrl;
  return {
    isLive,
    streamUrl,
    sourceType,
    sessionId: pick(r, ['sessionId', 'session_id']),
    title: pick(r, ['title']),
    thumbnail: pick(r, ['thumbnail', 'poster']),
    description: pick(r, ['description']),
    preLive: normalizePreLive(r, isLive),
  };
}

/** Pre-live media from settings/live (preLiveEnabled + preLiveUrl ...), or undefined when it must not play. */
function normalizePreLive(r: Raw, isLive: boolean): PreLiveMedia | undefined {
  if (isLive || pick(r, ['preLiveEnabled']) !== true) return undefined;
  const url = String(pick(r, ['preLiveUrl']) ?? '').trim();
  if (!/^https:\/\/\S+$/i.test(url)) return undefined;
  const sourceType: PreLiveMedia['sourceType'] = isYouTubeUrl(url) ? 'youtube' : isHls(url) ? 'hls' : 'file';
  return {
    url,
    sourceType,
    title: String(pick(r, ['preLiveTitle']) || 'Watch while you wait'),
    description: pick(r, ['preLiveDescription']) || undefined,
    thumbnail: pick(r, ['preLiveThumbnail']) || undefined,
  };
}

export function normalizePromotion(id: string, r: Raw): Promotion {
  return {
    id,
    title: String(pick(r, ['title']) ?? 'Promotion'),
    description: String(pick(r, ['description']) ?? ''),
    imageUrl: String(pick(r, ['imageUrl', 'image', 'bannerUrl']) ?? ''),
    category: pick(r, ['category']),
    destinationUrl: String(pick(r, ['destinationUrl', 'url', 'link']) ?? ''),
    target: pick(r, ['target']) === 'external' ? 'external' : 'internal',
    order: Number(pick(r, ['order']) ?? 0),
    isPublished: pick(r, ['isPublished', 'published']) !== false,
    createdAt: toIso(pick(r, ['createdAt', 'created_at'])),
  };
}

export function normalizeArticle(id: string, r: Raw): Article {
  return {
    id,
    title: String(pick(r, ['title']) ?? 'Untitled Article'),
    body: String(pick(r, ['body', 'content']) ?? ''),
    coverImageUrl: pick(r, ['coverImageUrl', 'coverImage', 'image', 'imageUrl']),
    category: pick(r, ['category']),
    author: pick(r, ['author', 'authorName']),
    isPublished: pick(r, ['isPublished', 'published']) !== false,
    publishedAt: toIso(pick(r, ['publishedAt', 'published_at', 'createdAt'])),
    createdAt: toIso(pick(r, ['createdAt', 'created_at'])),
  };
}


/** First ~220 characters of the testimony, cut at a word boundary. */
export function excerptOf(body: string, max = 220): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).trim()}…`;
}

export function normalizeWrittenTestimony(id: string, r: Raw): WrittenTestimony {
  const body = String(pick(r, ['body', 'testimony', 'content']) ?? '').replace(/\r\n/g, '\n').trim();
  return {
    id,
    title: String(pick(r, ['title']) ?? 'Testimony'),
    body,
    excerpt: String(pick(r, ['excerpt']) || excerptOf(body)),
    authorName: pick(r, ['authorName', 'fullName', 'author']) || undefined,
    churchZone: pick(r, ['churchZone', 'church']) || undefined,
    authorPhotoUrl: pick(r, ['authorPhotoUrl', 'photoUrl']) || undefined,
    category: pick(r, ['category']) || undefined,
    isPublished: pick(r, ['isPublished', 'published']) === true,
    publishedAt: toIso(pick(r, ['publishedAt', 'published_at', 'createdAt'])),
    createdAt: toIso(pick(r, ['createdAt', 'created_at'])),
  };
}

export function normalizeAudioTestimony(id: string, r: Raw): AudioTestimony {
  return {
    id,
    title: String(pick(r, ['title']) ?? 'Untitled Audio Testimony'),
    description: String(pick(r, ['description', 'summary']) ?? ''),
    audioUrl: String(pick(r, ['audioUrl', 'url', 'audio']) ?? ''),
    duration: toSeconds(pick(r, ['duration', 'durationSeconds'])),
    speaker: pick(r, ['speaker', 'testifier', 'author']),
    category: pick(r, ['category']),
    thumbnailUrl: pick(r, ['thumbnailUrl', 'thumbnail', 'image']),
    isPublished: pick(r, ['isPublished', 'published']) !== false,
    publishedAt: toIso(pick(r, ['publishedAt', 'published_at'])),
    createdAt: toIso(pick(r, ['createdAt', 'created_at'])),
  };
}

export function normalizeRadio(r: Raw | undefined | null): RadioConfig {
  if (!r) {
    return {
      isLive: false,
      streamUrl: '',
      currentProgramme: 'TOP Radio - Off Air',
    };
  }
  return {
    isLive: pick(r, ['isLive', 'live']) === true,
    streamUrl: String(pick(r, ['streamUrl', 'url', 'stream']) ?? ''),
    currentProgramme: String(pick(r, ['currentProgramme', 'title', 'programme']) ?? 'Live Radio Broadcast'),
    description: pick(r, ['description']),
    sessionId: pick(r, ['sessionId', 'session_id']),
  };
}

export function normalizeAdotopoc(r: Raw | undefined | null): AdotopocConfig {
  return {
    resourcePageUrl: String(pick(r ?? {}, ['resourcePageUrl']) ?? 'https://testimoniesofpraiseweb.onrender.com/adotopoc'),
    introVideoUrl: String(
      pick(r ?? {}, ['introVideoUrl']) ??
        'https://res.cloudinary.com/duw6xrnpn/video/upload/v1792135475/ADOTOP_LOGO_OUTRO_m1awjk.mp4',
    ),
    introEnabled: pick(r ?? {}, ['introEnabled']) !== false,
  };
}
