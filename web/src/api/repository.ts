import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as qLimit,
  startAfter,
  onSnapshot,
  addDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  AdotopocConfig,
  AppNotification,
  Article,
  AudioTestimony,
  LiveConfig,
  LiveSourceType,
  NotificationType,
  Page,
  Promotion,
  RadioConfig,
  Testimony,
} from '../types';

type Raw = Record<string, any>;

const pick = (r: Raw, keys: string[]): any => {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k];
  }
  return undefined;
};

export function toIso(v: any): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return new Date(v).toISOString();
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  if (typeof v._seconds === 'number') return new Date(v._seconds * 1000).toISOString();
  return null;
}

function toSeconds(v: any): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.includes(':')) {
    return v.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toKeywords(v: any, extra: (string | undefined)[]): string[] {
  const base = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  return [...base, ...extra].filter(Boolean).map((s) => String(s).trim().toLowerCase());
}

const isPublished = (r: Raw): boolean => {
  const v = pick(r, ['isPublished', 'published']);
  if (typeof v === 'boolean') return v;
  if (r.status) return String(r.status).toLowerCase() === 'published';
  return true;
};

export const isHls = (url?: string) => !!url && /\.m3u8(\?|$)/i.test(url);
export const isYouTubeUrl = (url?: string) =>
  !!url && /(youtube\.com|youtu\.be)/i.test(url);

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

export interface PageOptions {
  limit: number;
  cursor?: unknown;
  featuredOnly?: boolean;
}

export const repo = {
  async getTestimonies({ limit, cursor, featuredOnly }: PageOptions): Promise<Page<Testimony>> {
    const c: QueryConstraint[] = [where('isPublished', '==', true)];
    if (featuredOnly) c.push(where('isFeatured', '==', true));
    c.push(orderBy('createdAt', 'desc'));
    if (cursor) c.push(startAfter(cursor as QueryDocumentSnapshot));
    c.push(qLimit(limit));
    const snap = await getDocs(query(collection(db, 'testimonies'), ...c));
    return {
      items: snap.docs.map((d) => normalizeTestimony(d.id, d.data())),
      cursor: snap.docs[snap.docs.length - 1],
      hasMore: snap.docs.length === limit,
    };
  },

  async getTestimony(id: string): Promise<Testimony | null> {
    try {
      const s = await getDoc(doc(db, 'testimonies', id));
      if (!s.exists()) return null;
      const item = normalizeTestimony(s.id, s.data());
      return item.isPublished ? item : null;
    } catch (e: any) {
      if (e?.code === 'permission-denied') return null;
      throw e;
    }
  },

  async getNotifications(max = 50): Promise<AppNotification[]> {
    const snap = await getDocs(
      query(
        collection(db, 'notifications'),
        where('published', '==', true),
        orderBy('createdAt', 'desc'),
        qLimit(max),
      ),
    );
    return snap.docs.map((d) => normalizeNotification(d.id, d.data()));
  },

  subscribeLive(cb: (cfg: LiveConfig) => void, onError?: (err: Error) => void) {
    return onSnapshot(
      doc(db, 'settings', 'live'),
      (s) => cb(normalizeLive(s.exists() ? s.data() : null)),
      (e) => onError?.(e),
    );
  },

  async submitTestimony(input: {
    fullName: string;
    churchZone: string;
    testimony: string;
    userId?: string;
    userEmail?: string | null;
  }) {
    await addDoc(collection(db, 'testimonySubmissions'), {
      fullName: input.fullName,
      churchZone: input.churchZone,
      testimony: input.testimony,
      userId: input.userId ?? null,
      userEmail: input.userEmail ?? null,
      source: 'web-ios',
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  },

  async submitSponsorship(input: {
    uid?: string;
    userEmail?: string | null;
    amount?: string;
    note?: string;
    receiptUrl: string;
  }) {
    await addDoc(collection(db, 'sponsorships'), {
      uid: input.uid ?? null,
      userEmail: input.userEmail ?? null,
      amount: input.amount?.trim() || null,
      note: input.note?.trim() || null,
      receiptUrl: input.receiptUrl,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  },

  async recordEvent(event: string, params: Record<string, any> = {}, uid?: string) {
    await addDoc(collection(db, 'analyticsEvents'), {
      event,
      params,
      uid: uid ?? null,
      platform: 'web-ios',
      ts: serverTimestamp(),
    });
  },

  async getPromotions(): Promise<Promotion[]> {
    const snap = await getDocs(
      query(
        collection(db, 'promotions'),
        where('isPublished', '==', true),
        orderBy('order', 'asc'),
      ),
    );
    return snap.docs.map((d) => normalizePromotion(d.id, d.data()));
  },

  async getArticles(max = 20): Promise<Article[]> {
    const snap = await getDocs(
      query(
        collection(db, 'articles'),
        where('isPublished', '==', true),
        orderBy('createdAt', 'desc'),
        qLimit(max),
      ),
    );
    return snap.docs.map((d) => normalizeArticle(d.id, d.data()));
  },

  async getArticle(id: string): Promise<Article | null> {
    try {
      const s = await getDoc(doc(db, 'articles', id));
      if (!s.exists()) return null;
      const item = normalizeArticle(s.id, s.data());
      return item.isPublished ? item : null;
    } catch (e: any) {
      if (e?.code === 'permission-denied') return null;
      throw e;
    }
  },

  async getAudioTestimonies(max = 30): Promise<AudioTestimony[]> {
    const snap = await getDocs(
      query(
        collection(db, 'audioTestimonies'),
        where('isPublished', '==', true),
        orderBy('createdAt', 'desc'),
        qLimit(max),
      ),
    );
    return snap.docs.map((d) => normalizeAudioTestimony(d.id, d.data()));
  },

  async getRadioConfig(): Promise<RadioConfig> {
    const snap = await getDoc(doc(db, 'settings', 'radio'));
    return normalizeRadio(snap.exists() ? snap.data() : null);
  },

  subscribeRadio(cb: (cfg: RadioConfig) => void, onError?: (err: Error) => void) {
    return onSnapshot(
      doc(db, 'settings', 'radio'),
      (s) => cb(normalizeRadio(s.exists() ? s.data() : null)),
      (e) => onError?.(e),
    );
  },

  async getAdotopocConfig(): Promise<AdotopocConfig> {
    const snap = await getDoc(doc(db, 'settings', 'adotopoc'));
    return normalizeAdotopoc(snap.exists() ? snap.data() : null);
  },
};
