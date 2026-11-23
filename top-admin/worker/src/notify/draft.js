/**
 * Praxiom-written notification copy for published content (Phase 3c).
 *
 * One request per published item, never per person. Praxiom receives only the item's public fields (kind,
 * title, description excerpt, topic labels), never anything about users. Its answer is accepted only if it
 * passes validatePushCopy: it must name the content, use no number or sensitive word the content does not
 * use itself, contain no links, emails or urgency, and fit the length limits. Otherwise the template is used.
 */
import { praxiomChat } from '../praxiom.js';
import { parseModelJson } from '../structured.js';
import { sanitizeTags } from '../tags.js';
import { MAX_BODY_CHARS, MAX_TITLE_CHARS, validatePushCopy } from './copy.js';

/** Where each published content type lives, and how to describe it to Praxiom. */
export const CONTENT_SOURCES = {
  testimony: { col: 'testimonies', kind: 'video testimony' },
  written: { col: 'writtenTestimonies', kind: 'written testimony' },
  article: { col: 'articles', kind: 'article' },
  lyrical: { col: 'lyricalAnalyses', kind: 'lyrical analysis video of a worship song' },
  loveworld: { col: 'loveworldSingersVideos', kind: 'LoveWorld Singers worship ministration video' },
  choir: { col: 'featuredChoirs', kind: 'featured choir' },
};

const LABELS = { healing: 'healing', salvation: 'salvation', deliverance: 'deliverance', miracles: 'miracles', finances: 'financial breakthrough', family: 'family', marriage: 'marriage', youth: 'youth', faith: 'faith', hope: 'hope and encouragement', worship: 'worship', missions: 'missions' };
const str = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

/** The public facts of one published item, or null if it is missing or not published. */
export function contentFacts(type, d) {
  const src = CONTENT_SOURCES[type];
  if (!src || !d || !(d.isPublished === true || d.status === 'published')) return null;
  const title = str(d.title || d.groupName || d.name, 200);
  if (!title) return null;
  const description = str(d.description || d.body || [d.songTitle, d.artistName].filter(Boolean).join(' by '), 1500);
  const tags = sanitizeTags(d.tags);
  const sourceText = `${title} ${description} ${tags.map((t) => LABELS[t]).join(' ')}`;
  return { type, kind: src.kind, title, description, tags, sourceText, numbers: sourceText.match(/\d[\d,.:]*\d|\d/g) ?? [] };
}

/** Reads one published item with the engine's store. */
export async function loadContent(store, type, id) {
  const src = CONTENT_SOURCES[type];
  if (!src || typeof id !== 'string' || !id) return null;
  const doc = (await store.get(src.col, [id])).get(id);
  return doc ? contentFacts(type, doc.data) : null;
}

function prompt(facts) {
  return [
    {
      role: 'system',
      content:
        'You write one short push notification for Testimonies of Praise, a Christian app of testimonies and worship. ' +
        'Use ONLY the facts given. Never invent names, places, numbers, dates, illnesses or outcomes. ' +
        'Warm, respectful and inviting. No links, no urgency ("hurry", "don\'t miss"), no exaggeration or promises. ' +
        `The title must be at most ${MAX_TITLE_CHARS} characters. The body must be at most ${MAX_BODY_CHARS} characters ` +
        'and must contain the content title exactly as given. ' +
        'Reply with JSON only, exactly: {"title":"...","body":"..."}',
    },
    { role: 'user', content: JSON.stringify({ kind: facts.kind, title: facts.title, description: facts.description.slice(0, 1200), topics: facts.tags.map((t) => LABELS[t]) }) },
  ];
}

/**
 * Asks Praxiom for copy and validates it. Returns { ok: true, title, body } or { ok: false, reason }.
 * Never throws: a Praxiom outage simply means the template is used.
 */
export async function draftCopy(env, facts, { chat = praxiomChat } = {}) {
  if (!env?.PRAXIOM_API_KEY) return { ok: false, reason: 'praxiom_not_configured' };
  let text;
  try {
    text = (await chat(env, { messages: prompt(facts), maxTokens: 200, temperature: 0.4 }, { maxAttempts: 1 })).text;
  } catch (e) {
    return { ok: false, reason: `praxiom_${e?.code || 'error'}` };
  }
  const parsed = parseModelJson(text);
  if (!parsed.ok) return { ok: false, reason: 'unreadable' };
  const checked = validatePushCopy(
    { title: String(parsed.value.title ?? ''), body: String(parsed.value.body ?? '') },
    { title: facts.title, allowTitleOmitted: facts.title.length > 100, allowedNumbers: facts.numbers, sourceText: facts.sourceText },
  );
  if (!checked.ok) return { ok: false, reason: `rejected: ${checked.errors.slice(0, 2).join('; ')}`.slice(0, 160) };
  return { ok: true, title: checked.value.title, body: checked.value.body };
}
