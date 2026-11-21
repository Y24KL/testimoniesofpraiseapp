import { auth } from './firebase';

/**
 * Content interest tags. Same list, same order, as top-admin/worker/src/tags.js CONTENT_TAGS, the app's
 * INTEREST_TAGS and the Firestore rules (checked by tests/contentTags.test.mjs).
 */
export const CONTENT_TAGS = ['healing', 'salvation', 'deliverance', 'miracles', 'finances', 'family', 'marriage', 'youth', 'faith', 'hope', 'worship', 'missions'] as const;
export type ContentTag = (typeof CONTENT_TAGS)[number];
export const MAX_TAGS = 5;
export const SUGGEST_BATCH = 8;

export const TAG_LABELS: Record<ContentTag, string> = {
  healing: 'Healing',
  salvation: 'Salvation',
  deliverance: 'Deliverance',
  miracles: 'Miracles',
  finances: 'Financial breakthrough',
  family: 'Family & children',
  marriage: 'Marriage',
  youth: 'Youth & students',
  faith: 'Faith',
  hope: 'Hope & encouragement',
  worship: 'Worship',
  missions: 'Missions & outreach',
};

export type TaggableType = 'testimony' | 'written' | 'article' | 'lyrical' | 'loveworld';

/** Keeps known tags only, once each, at most MAX_TAGS. */
export function sanitizeTags(input: unknown): ContentTag[] {
  if (!Array.isArray(input)) return [];
  const out: ContentTag[] = [];
  for (const t of input) {
    if (typeof t === 'string' && (CONTENT_TAGS as readonly string[]).includes(t) && !out.includes(t as ContentTag)) out.push(t as ContentTag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export interface TagSource {
  contentType: TaggableType;
  title: string;
  description?: string;
  category?: string;
  keywords?: string[];
  excerpt?: string;
}

export interface TagSuggestion {
  tags: ContentTag[];
  source: 'praxiom' | 'keywords';
}

const WORKER_URL = (import.meta.env.VITE_WORKER_URL || import.meta.env.VITE_PUSH_URL || 'https://top-push-relay.gtrusouth116.workers.dev').replace(/\/$/, '');

/**
 * Asks the Worker for tag suggestions (Praxiom, with a keyword fallback on the server). Sends public content
 * text only. At most SUGGEST_BATCH items per call.
 */
export async function suggestTags(items: TagSource[]): Promise<{ results: TagSuggestion[]; ai: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('You are signed out.');
  const token = await user.getIdToken();
  const res = await fetch(`${WORKER_URL}/api/ai/suggest-tags`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: items.slice(0, SUGGEST_BATCH) }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `Tag suggestions failed (${res.status}).`);
  const results = (Array.isArray(j.results) ? j.results : []).map((r: { tags?: unknown; source?: string }) => ({
    tags: sanitizeTags(r?.tags),
    source: r?.source === 'praxiom' ? 'praxiom' : 'keywords',
  })) as TagSuggestion[];
  return { results, ai: typeof j.ai === 'string' ? j.ai : 'unknown' };
}
