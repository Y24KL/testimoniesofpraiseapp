/**
 * Finds newly published content since the engine's cursor. The cursor only limits how much is scanned.
 * Correctness does not depend on it: every candidate is also protected by its queue key (enqueue.js), so a
 * re-scan after a failure cannot queue the same notification twice.
 *
 * On the first run the engine starts its cursor at "now" (see run.js), so the existing back catalogue is
 * never announced all at once.
 */
import { EVENT_TYPES } from './templates.js';

export const SCAN_LIMIT = 50;

const asDate = (value) => (value instanceof Date ? value : new Date(value));
const later = (a, b) => (a && a > b ? a : b);

/**
 * cursor: { testimonyAt, articleAt, lyricalAt: Date, liveSession: string|null }
 * Returns { candidates, cursor } where cursor is the advanced cursor to save.
 */
export async function detectCandidates(store, cursor) {
  const candidates = [];
  const next = { ...cursor };

  const testimonies = await store.query({
    collection: 'testimonies',
    filters: [{ field: 'publishedAt', op: 'GREATER_THAN', value: asDate(cursor.testimonyAt) }],
    orderBy: [{ field: 'publishedAt', direction: 'ASCENDING' }],
    limit: SCAN_LIMIT,
  });
  for (const { id, data } of testimonies) {
    if (!(data.publishedAt instanceof Date)) continue;
    next.testimonyAt = later(next.testimonyAt && asDate(next.testimonyAt), data.publishedAt);
    if (data.isPublished === true) candidates.push({ type: 'testimony', contentId: id, title: data.title, publishedAt: data.publishedAt });
  }

  const articles = await store.query({
    collection: 'articles',
    filters: [{ field: 'publishedAt', op: 'GREATER_THAN', value: asDate(cursor.articleAt) }],
    orderBy: [{ field: 'publishedAt', direction: 'ASCENDING' }],
    limit: SCAN_LIMIT,
  });
  for (const { id, data } of articles) {
    if (!(data.publishedAt instanceof Date)) continue;
    next.articleAt = later(next.articleAt && asDate(next.articleAt), data.publishedAt);
    if (data.isPublished === true) candidates.push({ type: 'article', contentId: id, title: data.title, publishedAt: data.publishedAt });
  }

  // Lyrical analyses are edited after publishing, so the cursor follows updatedAt and the status is checked here.
  const lyrical = await store.query({
    collection: 'lyricalAnalyses',
    filters: [{ field: 'updatedAt', op: 'GREATER_THAN', value: asDate(cursor.lyricalAt) }],
    orderBy: [{ field: 'updatedAt', direction: 'ASCENDING' }],
    limit: SCAN_LIMIT,
  });
  for (const { id, data } of lyrical) {
    if (!(data.updatedAt instanceof Date)) continue;
    next.lyricalAt = later(next.lyricalAt && asDate(next.lyricalAt), data.updatedAt);
    if (data.status === 'published') candidates.push({ type: 'lyrical', contentId: id, title: data.title, publishedAt: data.updatedAt });
  }

  // A live broadcast is one candidate per session. The admin regenerates sessionId each time they go live.
  const live = await store.get('settings/live');
  if (live?.isLive === true && typeof live.sessionId === 'string' && live.sessionId && live.sessionId !== cursor.liveSession) {
    candidates.push({ type: 'live', contentId: live.sessionId, title: live.title });
    next.liveSession = live.sessionId;
  }

  return { candidates: candidates.filter((c) => EVENT_TYPES.includes(c.type)), cursor: next };
}

/** A cursor for a store that has never run: everything published before now is treated as already seen. */
export function initialCursor(now, live) {
  return {
    testimonyAt: new Date(now),
    articleAt: new Date(now),
    lyricalAt: new Date(now),
    liveSession: live?.isLive === true && typeof live.sessionId === 'string' ? live.sessionId : null,
  };
}
