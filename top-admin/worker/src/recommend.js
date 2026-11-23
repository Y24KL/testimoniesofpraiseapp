/**
 * Personal home sections (Praxiom Phase 2c): For You, New in your interests, Featured you haven't seen,
 * and Continue where you left off. Deterministic and explainable: every item carries a reason code.
 *
 * Privacy and access: every Firestore read uses the CALLER's token, so the rules decide what can be read:
 * only this person's interests, history and activity, and only published content. Nothing is written.
 * Assistant conversations are never read. The content pool (published items only, identical for every
 * signed-in user) is cached for POOL_TTL_S to keep reads low.
 *
 * Scoring (docs/PRAXIOM_INTELLIGENCE_PLAN.md §4):
 *   0.35 explicit interest match + 0.20 learned tag affinity (>= 3 events on >= 2 days) + 0.20 similarity
 *   (bge-m3, testimonies) + 0.15 freshness + 0.10 type affinity, minus 0.15 per recent unclicked showing.
 *   Diversity: at most 2 per tag and 3 per type in For You; slots 5 and 10 are "something different".
 */
import { decodeFields, encodeValue } from './firestoreRest.js';
import { CONTENT_TAGS, sanitizeTags } from './tags.js';

export const POOL_TTL_S = 30 * 60;
const DAY = 86400000;
const FOR_YOU = 10;
const SIDE_LIST = 8;
const NEW_DAYS = 21;
const ID = /^[A-Za-z0-9_-]{1,100}$/;

/** Published content per type: collection, the filter the rules require, an indexed order, and fields. */
export const POOL_SPEC = [
  { type: 'testimony', collection: 'testimonies', filter: ['isPublished', true], order: ['createdAt', 'DESCENDING'], limit: 40, fields: ['title', 'description', 'authorName', 'category', 'tags', 'thumbnail', 'duration', 'isFeatured', 'publishedAt', 'createdAt', 'aiEmbedding'] },
  { type: 'written', collection: 'writtenTestimonies', filter: ['isPublished', true], order: ['createdAt', 'DESCENDING'], limit: 20, fields: ['title', 'authorName', 'category', 'tags', 'authorPhotoUrl', 'publishedAt', 'createdAt'] },
  { type: 'article', collection: 'articles', filter: ['isPublished', true], order: ['createdAt', 'DESCENDING'], limit: 15, fields: ['title', 'author', 'category', 'tags', 'coverImageUrl', 'publishedAt', 'createdAt'] },
  { type: 'lyrical', collection: 'lyricalAnalyses', filter: ['status', 'published'], order: ['displayOrder', 'ASCENDING'], limit: 15, fields: ['title', 'songTitle', 'artistName', 'tags', 'thumbnailUrl', 'duration', 'publicationDate', 'createdAt'] },
  { type: 'loveworld', collection: 'loveworldSingersVideos', filter: ['isPublished', true], order: ['order', 'ASCENDING'], limit: 15, fields: ['title', 'description', 'tags', 'thumbnailUrl', 'duration', 'isFeatured', 'publishedAt', 'createdAt'] },
];
const TYPES = POOL_SPEC.map((s) => s.type);
const ACTIVITY_TYPES = { testimony: 'testimony', written: 'written', article: 'article', lyrical: 'lyrical' };

export const REASON_TEXT = {
  interest: (tag) => `Because you enjoy ${LABEL[tag] ?? tag} content`,
  affinity: (tag) => `You often explore ${LABEL[tag] ?? tag}`,
  similar: () => 'Similar to what you watched',
  new_in: (tag) => `New in ${LABEL[tag] ?? tag}`,
  featured: () => 'Featured',
  fresh: () => 'New on T.O.P',
  explore: () => 'Something different for you',
  continue: () => 'Continue where you left off',
};
const LABEL = { healing: 'healing', salvation: 'salvation', deliverance: 'deliverance', miracles: 'miracle', finances: 'financial breakthrough', family: 'family', marriage: 'marriage', youth: 'youth', faith: 'faith', hope: 'hope and encouragement', worship: 'worship', missions: 'missions' };

// ---------------- Firestore (caller's token) ----------------
const base = (env) => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

async function runQuery(env, authorization, fetchFn, { parent = '', collection, where = [], orderBy, limit, select }) {
  const sq = { from: [{ collectionId: collection }], limit };
  const filters = where.map(([f, v]) => ({ fieldFilter: { field: { fieldPath: f }, op: 'EQUAL', value: encodeValue(v) } }));
  if (filters.length === 1) sq.where = filters[0];
  else if (filters.length > 1) sq.where = { compositeFilter: { op: 'AND', filters } };
  if (orderBy) sq.orderBy = [{ field: { fieldPath: orderBy[0] }, direction: orderBy[1] }];
  if (select) sq.select = { fields: select.map((f) => ({ fieldPath: f })) };
  const res = await fetchFn(`${base(env)}${parent}:runQuery`, {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: sq }),
  });
  if (!res.ok) throw Object.assign(new Error(`query ${collection} failed (${res.status})`), { status: res.status });
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).filter((r) => r.document).map((r) => ({ id: decodeURIComponent(r.document.name.split('/').pop()), data: decodeFields(r.document.fields || {}) }));
}

async function getDoc(env, authorization, fetchFn, path) {
  const res = await fetchFn(`${base(env)}/${path}`, { headers: { Authorization: authorization } });
  if (!res.ok) return null; // 403 (unpublished / not allowed) and 404 (deleted) both mean: not available
  const d = await res.json();
  return d?.fields ? decodeFields(d.fields) : {};
}

// ---------------- content pool ----------------
const ms = (v) => (v instanceof Date ? v.getTime() : typeof v === 'number' ? v : 0);
const str = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function vectorOf(v) {
  const arr = Array.isArray(v) ? v : Array.isArray(v?.value) ? v.value : null;
  return arr && arr.length >= 8 && arr.every((x) => typeof x === 'number') ? arr : null;
}

/** One pool item in the shape the app shows. Only public fields of published content. */
export function poolItem(type, id, d) {
  const subtitle = type === 'lyrical' ? [str(d.songTitle, 120), str(d.artistName, 120)].filter(Boolean).join(' · ') : str(d.authorName || d.author, 120);
  return {
    type,
    id,
    title: str(d.title) || 'Untitled',
    subtitle,
    thumbnail: str(d.thumbnail || d.thumbnailUrl || d.coverImageUrl || d.authorPhotoUrl, 1000) || null,
    duration: typeof d.duration === 'number' ? d.duration : null,
    tags: sanitizeTags(d.tags),
    publishedMs: ms(d.publishedAt) || ms(d.publicationDate) || ms(d.createdAt),
    featured: d.isFeatured === true,
    embedding: type === 'testimony' ? vectorOf(d.aiEmbedding) : null,
  };
}

export async function loadPool(env, authorization, { fetchFn = fetch, cache = globalThis.caches?.default } = {}) {
  const key = new Request(`https://cache.top.internal/discover-pool/v1/${env.FIREBASE_PROJECT_ID}`);
  if (cache) {
    const hit = await cache.match(key).catch(() => null);
    if (hit) return hit.json();
  }
  const lists = await Promise.all(
    POOL_SPEC.map((s) =>
      runQuery(env, authorization, fetchFn, { collection: s.collection, where: [s.filter], orderBy: s.order, limit: s.limit, select: s.fields })
        .then((rows) => rows.filter((r) => ID.test(r.id)).map((r) => poolItem(s.type, r.id, r.data)))
        .catch((e) => {
          console.error('[recommend] pool', s.collection, e.status || e.message);
          return [];
        }),
    ),
  );
  const pool = lists.flat();
  if (cache && pool.length) await cache.put(key, new Response(JSON.stringify(pool), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${POOL_TTL_S}` } })).catch(() => undefined);
  return pool;
}

// ---------------- the person ----------------
export async function loadPerson(env, authorization, uid, { fetchFn = fetch } = {}) {
  const parent = `/users/${encodeURIComponent(uid)}`;
  const [discovery, history, activity] = await Promise.all([
    getDoc(env, authorization, fetchFn, `users/${encodeURIComponent(uid)}/private/discovery`),
    runQuery(env, authorization, fetchFn, { parent, collection: 'history', orderBy: ['updatedAt', 'DESCENDING'], limit: 20 }).catch(() => []),
    runQuery(env, authorization, fetchFn, { collection: 'user_activity', where: [['uid', uid]], orderBy: ['ts', 'DESCENDING'], limit: 60 }).catch(() => []),
  ]);
  return {
    interests: sanitizeTags(discovery?.interests, CONTENT_TAGS.length),
    optOut: discovery?.optOut === true,
    history: history.map((h) => ({ type: h.data.contentType === 'lyrical' ? 'lyrical' : 'testimony', id: str(h.data.contentId, 100), title: str(h.data.title), thumbnail: str(h.data.thumbnail, 1000) || null, positionSec: Number(h.data.positionSec) || 0, durationSec: Number(h.data.durationSec) || 0, completed: h.data.completed === true, atMs: ms(h.data.updatedAt) })).filter((h) => ID.test(h.id)),
    activity: activity.map((a) => ({ event: str(a.data.type, 30), type: ACTIVITY_TYPES[a.data.contentType] ?? str(a.data.contentType, 30), id: str(a.data.contentId, 100), atMs: ms(a.data.ts) })).filter((a) => ID.test(a.id)),
  };
}

// ---------------- profile and ranking ----------------
const keyOf = (type, id) => `${type}:${id}`;

/** What the person has shown interest in, from their own events. Single interactions never count alone. */
export function buildProfile(person, pool) {
  const byKey = new Map(pool.map((p) => [keyOf(p.type, p.id), p]));
  const events = [
    ...person.history.map((h) => ({ type: h.type, id: h.id, atMs: h.atMs, weight: h.completed ? 2 : 1 })),
    ...person.activity.map((a) => ({ type: a.type, id: a.id, atMs: a.atMs, weight: a.event === 'complete' || a.event === 'save' ? 2 : 1 })),
  ];
  const tagCount = {};
  const tagDays = {};
  const typeCount = {};
  const seen = new Set();
  const completed = new Set(person.history.filter((h) => h.completed).map((h) => keyOf(h.type, h.id)));
  for (const a of person.activity) if (a.event === 'complete') completed.add(keyOf(a.type, a.id));
  for (const e of events) {
    const k = keyOf(e.type, e.id);
    seen.add(k);
    typeCount[e.type] = (typeCount[e.type] ?? 0) + e.weight;
    const item = byKey.get(k);
    for (const t of item?.tags ?? []) {
      tagCount[t] = (tagCount[t] ?? 0) + e.weight;
      (tagDays[t] ??= new Set()).add(Math.floor(e.atMs / DAY));
    }
  }
  const affinity = {};
  const top = Math.max(1, ...Object.values(tagCount));
  for (const [t, n] of Object.entries(tagCount)) if (n >= 3 && (tagDays[t]?.size ?? 0) >= 2) affinity[t] = n / top;
  const typeTop = Math.max(1, ...Object.values(typeCount));
  const typeAffinity = Object.fromEntries(Object.entries(typeCount).map(([t, n]) => [t, n / typeTop]));

  // Similarity anchor: the mean embedding of the last five testimonies they finished or played.
  const anchors = person.history.filter((h) => h.type === 'testimony').slice(0, 5).map((h) => byKey.get(keyOf('testimony', h.id))?.embedding).filter(Boolean);
  let centroid = null;
  if (anchors.length) {
    centroid = new Array(anchors[0].length).fill(0);
    for (const v of anchors) for (let i = 0; i < v.length; i += 1) centroid[i] += v[i] / anchors.length;
  }
  return { interests: person.interests, affinity, typeAffinity, seen, completed, centroid, events: events.length };
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Scores one candidate and picks its strongest reason. */
export function scoreItem(item, profile, { now, exposure = {} }) {
  const interestTag = item.tags.find((t) => profile.interests.includes(t)) ?? null;
  const affinityTag = item.tags.filter((t) => profile.affinity[t]).sort((a, b) => profile.affinity[b] - profile.affinity[a])[0] ?? null;
  const sim = profile.centroid && item.embedding ? Math.max(0, cosine(profile.centroid, item.embedding)) : 0;
  const ageDays = item.publishedMs ? Math.max(0, (now - item.publishedMs) / DAY) : 365;
  const fresh = Math.exp(-ageDays / 14);
  const shown = Math.min(5, Number(exposure[keyOf(item.type, item.id)]) || 0);
  const parts = {
    interest: interestTag ? 0.35 : 0,
    affinity: affinityTag ? 0.2 * profile.affinity[affinityTag] : 0,
    similar: 0.2 * sim,
    fresh: 0.15 * fresh,
    type: 0.1 * (profile.typeAffinity[item.type] ?? 0),
  };
  const score = parts.interest + parts.affinity + parts.similar + parts.fresh + parts.type + (item.featured ? 0.03 : 0) - 0.15 * shown;
  let reason = { code: 'fresh' };
  if (parts.interest) reason = { code: 'interest', tag: interestTag };
  else if (parts.affinity >= parts.similar && parts.affinity > 0.05) reason = { code: 'affinity', tag: affinityTag };
  else if (parts.similar > 0.12) reason = { code: 'similar' };
  else if (item.featured) reason = { code: 'featured' };
  return { score, reason, mainTag: interestTag ?? affinityTag ?? item.tags[0] ?? null };
}

const withReason = (item, reason) => {
  const { embedding, ...rest } = item;
  return { ...rest, reason: reason.code, reasonTag: reason.tag ?? null, reasonText: REASON_TEXT[reason.code](reason.tag) };
};

/** The For You list: ranked, varied, with two "something different" slots. */
export function forYou(pool, profile, opts) {
  const candidates = pool.filter((p) => !profile.completed.has(keyOf(p.type, p.id)));
  const scored = candidates.map((item) => ({ item, ...scoreItem(item, profile, opts) })).sort((a, b) => b.score - a.score);
  const picked = [];
  const perTag = {};
  const perType = {};
  const taken = new Set();
  const usual = new Set([...profile.interests, ...Object.keys(profile.affinity)]);
  const take = (s, reason) => {
    picked.push(withReason(s.item, reason ?? s.reason));
    taken.add(keyOf(s.item.type, s.item.id));
    if (s.mainTag) perTag[s.mainTag] = (perTag[s.mainTag] ?? 0) + 1;
    perType[s.item.type] = (perType[s.item.type] ?? 0) + 1;
  };
  while (picked.length < FOR_YOU) {
    const slot = picked.length + 1;
    const exploring = (slot === 5 || slot === 10) && usual.size > 0;
    const next = scored.find((s) => {
      if (taken.has(keyOf(s.item.type, s.item.id))) return false;
      if (exploring) return s.item.tags.length > 0 && !s.item.tags.some((t) => usual.has(t));
      return (perTag[s.mainTag] ?? 0) < 2 && (perType[s.item.type] ?? 0) < 3;
    }) ?? scored.find((s) => !taken.has(keyOf(s.item.type, s.item.id)));
    if (!next) break;
    take(next, exploring && next.item.tags.length && !next.item.tags.some((t) => usual.has(t)) ? { code: 'explore' } : undefined);
  }
  return picked;
}

/** Recently published items in the person's chosen interests that they have not opened. */
export function newInInterests(pool, profile, { now }) {
  if (!profile.interests.length) return [];
  return pool
    .filter((p) => p.publishedMs && now - p.publishedMs <= NEW_DAYS * DAY && !profile.seen.has(keyOf(p.type, p.id)))
    .map((p) => ({ p, tag: p.tags.find((t) => profile.interests.includes(t)) }))
    .filter((x) => x.tag)
    .sort((a, b) => b.p.publishedMs - a.p.publishedMs)
    .slice(0, SIDE_LIST)
    .map((x) => withReason(x.p, { code: 'new_in', tag: x.tag }));
}

/** Items the T.O.P team marked as featured that the person has not opened yet. */
export function featuredUnseen(pool, profile) {
  return pool
    .filter((p) => p.featured && !profile.seen.has(keyOf(p.type, p.id)))
    .sort((a, b) => b.publishedMs - a.publishedMs)
    .slice(0, SIDE_LIST)
    .map((p) => withReason(p, { code: 'featured' }));
}

/** Unfinished items from their history that still exist and are still published. */
export async function continueWatching(env, authorization, person, { fetchFn = fetch } = {}) {
  const open = person.history.filter((h) => !h.completed && h.positionSec >= 10).slice(0, 6);
  const checked = await Promise.all(
    open.map(async (h) => {
      const d = await getDoc(env, authorization, fetchFn, `${h.type === 'lyrical' ? 'lyricalAnalyses' : 'testimonies'}/${encodeURIComponent(h.id)}`);
      const published = d && (d.isPublished === true || d.status === 'published');
      if (!published) return null;
      return { type: h.type, id: h.id, title: str(d.title) || h.title || 'Untitled', subtitle: '', thumbnail: str(d.thumbnail || d.thumbnailUrl, 1000) || h.thumbnail, duration: h.durationSec || null, tags: sanitizeTags(d.tags), positionSec: h.positionSec, durationSec: h.durationSec, reason: 'continue', reasonTag: null, reasonText: REASON_TEXT.continue() };
    }),
  );
  return checked.filter(Boolean);
}

/** Validates the client's record of how often each item was shown without being opened. */
export function readExposure(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw).slice(0, 100)) {
    const [type, id] = k.split(':');
    if (TYPES.includes(type) && ID.test(id ?? '') && Number.isFinite(v) && v > 0) out[k] = Math.min(5, Math.floor(v));
  }
  return out;
}

/**
 * Everything the home screen needs, for the signed-in caller. If the person opted out of personalization,
 * only editorial sections come back (featured and continue), and nothing about their activity is used.
 */
export async function homeSections(env, authorization, uid, body = {}, { fetchFn = fetch, cache, now = Date.now() } = {}) {
  const [pool, person] = await Promise.all([loadPool(env, authorization, { fetchFn, cache }), loadPerson(env, authorization, uid, { fetchFn })]);
  const cont = await continueWatching(env, authorization, person, { fetchFn });
  if (person.optOut) {
    const empty = { interests: [], affinity: {}, typeAffinity: {}, seen: new Set(), completed: new Set(), centroid: null, events: 0 };
    return { personalized: false, interests: [], forYou: [], newInInterests: [], featured: featuredUnseen(pool, empty), continue: cont, generatedAt: now };
  }
  const profile = buildProfile(person, pool);
  const opts = { now, exposure: readExposure(body.exposure) };
  return {
    personalized: true,
    interests: profile.interests,
    forYou: forYou(pool, profile, opts),
    newInInterests: newInInterests(pool, profile, opts),
    featured: featuredUnseen(pool, profile),
    continue: cont,
    generatedAt: now,
  };
}
