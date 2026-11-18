/**
 * Reads the content the assistant may talk about, and turns the results into cards. Every read uses the
 * signed-in person's own Firebase token, so Firestore rules decide what they can see. Nothing here can
 * return a record that a client could not already read.
 *
 * Cards are built only from these reads. The model never supplies a card, id or link.
 */
import { AIEndpointError } from './ai.js';
import { decodeFields, encodeValue } from './engine/firestoreRest.js';

export const DEEP_LINK_BASE = 'testimoniesofpraise://';
export const MAX_CARDS = 8;
export const SEARCH_POOL = 100;
export const RESULTS_PER_SEARCH = 5;
const RECENT_DAYS = 7;

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'about', 'what', 'show', 'me', 'some', 'find', 'any', 'are', 'was', 'that', 'this', 'from', 'your', 'you', 'please', 'want', 'to', 'of', 'in', 'on', 'a', 'an', 'is', 'it', 'i', 'my']);
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

/** Plain text from stored content: control characters removed, whitespace collapsed, length capped. */
export function cleanText(value, max = 300) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Lower-case search words from a question, without common filler words. */
export function queryTerms(query) {
  return [...new Set(String(query || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w)))];
}

/**
 * Orders items by how well they match the question. `fields` are { name, weight } pairs. A title match counts
 * more than a match in the body. Items with no match are left out. Pure, so it is tested without a network.
 */
export function rankByQuery(query, items, fields) {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const scored = [];
  for (const item of items) {
    let score = 0;
    for (const { name, weight } of fields) {
      const text = String(item[name] || '').toLowerCase();
      for (const term of terms) if (text.includes(term)) score += weight;
    }
    if (score > 0) scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.item);
}

/** Deep link for a card. Only these routes exist in the app (src/navigation/linking.ts). */
export function deepLink(kind, id) {
  if (kind === 'live') return `${DEEP_LINK_BASE}live`;
  if (kind === 'testimony' || kind === 'clip') return `${DEEP_LINK_BASE}testimony/${encodeURIComponent(id)}`;
  if (kind === 'lyrical') return `${DEEP_LINK_BASE}lyrical/${encodeURIComponent(id)}`;
  if (kind === 'article') return `${DEEP_LINK_BASE}article/${encodeURIComponent(id)}`;
  return null;
}

/** A card from a real record. verified is always true: the record was read from the database. */
export function makeCard(kind, id, title, subtitle = '', extra = {}) {
  const link = deepLink(kind, id);
  if (!link || !id) return null;
  return { kind, id, title: cleanText(title, 200) || 'Untitled', subtitle: cleanText(subtitle, 200), deepLink: link, verified: true, ...extra };
}

const asMillis = (v) => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
};

function base(env) {
  if (!env.FIREBASE_PROJECT_ID) throw new AIEndpointError(503, 'firestore_not_configured', 'Search is not configured yet.');
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
}

/**
 * One Firestore query, with the caller's token. `where` may hold several filters. Rules only allow a list
 * query whose filters guarantee the rule (for example isPublished == true), so callers must pass those.
 */
async function runQuery(env, authorization, { collection, where = [], limit, fetchFn }) {
  const structuredQuery = { from: [{ collectionId: collection }], limit };
  const filters = where.map((w) => ({ fieldFilter: { field: { fieldPath: w.field }, op: w.op, value: encodeValue(w.value) } }));
  if (filters.length === 1) structuredQuery.where = filters[0];
  else if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters } };
  const response = await fetchFn(`${base(env)}:runQuery`, {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
  if (response.status === 401 || response.status === 403) {
    throw new AIEndpointError(403, 'firestore_search_denied', 'You do not have permission to search this content. Please sign in and verify your account.');
  }
  if (!response.ok) throw new AIEndpointError(502, 'firestore_search_failed', 'Search is temporarily unavailable.');
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r.document)
    .map((r) => ({ id: r.document.name.split('/').pop(), data: decodeFields(r.document.fields || {}) }));
}

const defaultFetch = (...args) => fetch(...args);

/** Published lyrical analyses matching a question. */
export async function searchLyrical(env, authorization, query, { fetchFn = defaultFetch } = {}) {
  const rows = await runQuery(env, authorization, { collection: 'lyricalAnalyses', where: [{ field: 'status', op: 'EQUAL', value: 'published' }], limit: SEARCH_POOL, fetchFn });
  const items = rows.map((r) => ({ id: r.id, title: cleanText(r.data.title, 200), songTitle: cleanText(r.data.songTitle, 200), artistName: cleanText(r.data.artistName, 200), description: cleanText(r.data.description, 400) }));
  return rankByQuery(query, items, [
    { name: 'title', weight: 3 },
    { name: 'songTitle', weight: 2 },
    { name: 'artistName', weight: 2 },
    { name: 'description', weight: 1 },
  ]).slice(0, RESULTS_PER_SEARCH);
}

/** Published articles matching a question. */
export async function searchArticles(env, authorization, query, { fetchFn = defaultFetch } = {}) {
  const rows = await runQuery(env, authorization, { collection: 'articles', where: [{ field: 'isPublished', op: 'EQUAL', value: true }], limit: SEARCH_POOL, fetchFn });
  const items = rows.map((r) => ({ id: r.id, title: cleanText(r.data.title, 200), category: cleanText(r.data.category, 100), body: cleanText(r.data.body, 600) }));
  return rankByQuery(query, items, [
    { name: 'title', weight: 3 },
    { name: 'category', weight: 2 },
    { name: 'body', weight: 1 },
  ]).slice(0, RESULTS_PER_SEARCH);
}

/** Whether the live broadcast is on now. Returns only that and the programme title. */
export async function liveStatus(env, authorization, { fetchFn = defaultFetch } = {}) {
  const response = await fetchFn(`${base(env)}/settings/live`, { headers: { Authorization: authorization } });
  if (response.status === 404) return { isLive: false, title: '' };
  if (!response.ok) throw new AIEndpointError(502, 'firestore_search_failed', 'Live status is temporarily unavailable.');
  const doc = await response.json();
  const data = decodeFields(doc.fields || {});
  return { isLive: data.isLive === true, title: cleanText(data.title, 200) };
}

/**
 * What was published in the last week: testimonies, articles and lyrical analyses. Lyrical analyses are
 * ordered by when they were last updated, because they have no separate publish time.
 */
export async function recentPublished(env, authorization, { now = Date.now(), days = RECENT_DAYS, fetchFn = defaultFetch } = {}) {
  const since = now - days * 24 * 60 * 60 * 1000;
  const sinceDate = new Date(since);
  const [testimonies, articles, lyrical] = await Promise.all([
    runQuery(env, authorization, { collection: 'testimonies', where: [{ field: 'isPublished', op: 'EQUAL', value: true }, { field: 'publishedAt', op: 'GREATER_THAN', value: sinceDate }], limit: 50, fetchFn }),
    runQuery(env, authorization, { collection: 'articles', where: [{ field: 'isPublished', op: 'EQUAL', value: true }, { field: 'publishedAt', op: 'GREATER_THAN', value: sinceDate }], limit: 50, fetchFn }),
    runQuery(env, authorization, { collection: 'lyricalAnalyses', where: [{ field: 'status', op: 'EQUAL', value: 'published' }], limit: SEARCH_POOL, fetchFn }),
  ]);
  const out = [];
  for (const r of testimonies) {
    const at = asMillis(r.data.publishedAt);
    if (r.data.isPublished === true && at !== null && at >= since) out.push({ kind: 'testimony', id: r.id, title: cleanText(r.data.title, 200), subtitle: cleanText(r.data.authorName, 120), at });
  }
  for (const r of articles) {
    const at = asMillis(r.data.publishedAt);
    if (r.data.isPublished === true && at !== null && at >= since) out.push({ kind: 'article', id: r.id, title: cleanText(r.data.title, 200), subtitle: cleanText(r.data.category, 100), at });
  }
  for (const r of lyrical) {
    const at = asMillis(r.data.updatedAt);
    if (at !== null && at >= since) out.push({ kind: 'lyrical', id: r.id, title: cleanText(r.data.title, 200), subtitle: cleanText(r.data.songTitle, 200), at });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, 8);
}
