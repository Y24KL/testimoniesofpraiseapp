import type { DocumentData, DocumentSnapshot, Timestamp } from 'firebase/firestore';
import type { Testimony } from './types';

export function fmtDate(ts?: Timestamp | null): string {
  if (!ts) return '';
  return ts.toDate().toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const isHls = (url: string) => /\.m3u8(\?|$)/i.test(url);
export const isHttpUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

/** "1:05:30" | "12:40" | "95" -> seconds */
export function parseDuration(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function fmtDuration(sec: number): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(s).padStart(2, '0')}`;
}

export function testimonyFromDoc(d: DocumentSnapshot<DocumentData>): Testimony {
  const x = d.data() ?? {};
  return {
    id: d.id,
    title: x.title ?? '',
    description: x.description ?? '',
    authorName: x.authorName ?? '',
    category: x.category ?? '',
    keywords: Array.isArray(x.keywords) ? x.keywords : [],
    thumbnail: x.thumbnail ?? '',
    videoUrl: x.videoUrl ?? '',
    duration: typeof x.duration === 'number' ? x.duration : 0,
    isPublished: x.isPublished === true,
    isFeatured: x.isFeatured === true,
    isDownloadable: x.isDownloadable === true,
    notifyOnPublish: x.notifyOnPublish !== false,
    createdAt: x.createdAt,
    publishedAt: x.publishedAt,
    updatedAt: x.updatedAt,
  };
}

/** Reads a video file's length in the browser so admins don't have to type it. */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    const url = URL.createObjectURL(file);
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : 0);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    v.src = url;
  });
}

export const CATEGORIES = ['Healing', 'Deliverance', 'Salvation', 'Provision', 'Family & Marriage', 'Career & Business', 'Protection', 'Miracles', 'Other'];

/** Matches youtu.be/<id>, youtube.com/watch?v=<id>, /live/<id>, /embed/<id>, and shorts/<id>. */
const YT_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/|shorts\/))([A-Za-z0-9_-]{11})/;
export function parseYouTubeId(url: string): string | null {
  const m = url.trim().match(YT_RE);
  return m ? m[1] : null;
}
export const isYouTubeUrl = (url: string) => parseYouTubeId(url) !== null;
