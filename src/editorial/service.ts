/**
 * Reads the editorial configuration and the items it points to. A featured item is shown only when it is still
 * published and readable; otherwise its slot is hidden. Nothing is generated to fill a slot.
 */
import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { sanitizeEditorial, type Editorial } from './rules';

export type FeaturedKind = 'testimony' | 'lyrical' | 'article' | 'choir';

export interface FeaturedItem {
  kind: FeaturedKind;
  id: string;
  title: string;
  subtitle: string;
  thumbnail?: string;
}

export function subscribeEditorial(next: (e: Editorial) => void, fail: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'settings', 'editorial'),
    (snap) => next(sanitizeEditorial(snap.exists() ? snap.data() : null)),
    fail,
  );
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** One featured item, or null when it is missing, unpublished, or not readable. */
export async function fetchFeatured(kind: FeaturedKind, id: string): Promise<FeaturedItem | null> {
  const collectionName = { testimony: 'testimonies', lyrical: 'lyricalAnalyses', article: 'articles', choir: 'featuredChoirs' }[kind];
  try {
    const snap = await getDoc(doc(db, collectionName, id));
    if (!snap.exists()) return null;
    const d = snap.data();
    if (kind === 'testimony' && d.isPublished !== true) return null;
    if (kind === 'article' && d.isPublished !== true) return null;
    if (kind === 'lyrical' && d.status !== 'published') return null;
    if (kind === 'choir' && d.isPublished !== true) return null;
    if (kind === 'choir') return { kind, id, title: str(d.groupName), subtitle: str(d.songTitle), thumbnail: str(d.thumbnail) || undefined };
    if (kind === 'lyrical') return { kind, id, title: str(d.title), subtitle: str(d.songTitle), thumbnail: str(d.thumbnailUrl) || undefined };
    if (kind === 'article') return { kind, id, title: str(d.title), subtitle: str(d.category), thumbnail: str(d.coverImageUrl) || undefined };
    return { kind, id, title: str(d.title), subtitle: str(d.authorName), thumbnail: str(d.thumbnail) || undefined };
  } catch {
    return null;
  }
}

/** Resolves a list of featured items, keeping the order the admin chose and dropping any that are gone. */
export async function fetchFeaturedList(kind: FeaturedKind, ids: string[]): Promise<FeaturedItem[]> {
  const found = await Promise.all(ids.map((id) => fetchFeatured(kind, id)));
  return found.filter((x): x is FeaturedItem => x !== null);
}
