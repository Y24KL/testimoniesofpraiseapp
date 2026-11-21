/**
 * Validates AI-written notification copy before it can be queued. The model proposes text; this module
 * decides whether it may be used. Anything the source facts do not support is refused, and the engine then
 * falls back to the deterministic template for that event.
 *
 * Rules (from the spec): no fabricated facts, no artificial urgency, no overclaiming, no links.
 */
import { schemaErrors } from '../structured.js';

// Legacy push preference names plus the engine's categories (src/notify/engine.js CATEGORIES).
export const PUSH_CATEGORIES = ['testimonies', 'live', 'announcements', 'promotions', 'choirs', 'loveworld', 'articles', 'dailyPraise', 'loveworldMusic', 'lyricalAnalysis', 'featuredChoirs', 'community'];
export const MAX_TITLE_CHARS = 60;
export const MAX_BODY_CHARS = 180;

export const COPY_SCHEMA = {
  type: 'object',
  required: ['title', 'body'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: MAX_TITLE_CHARS },
    body: { type: 'string', minLength: 1, maxLength: MAX_BODY_CHARS },
    category: { type: 'string', enum: PUSH_CATEGORIES },
  },
};

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|io|app|tv|ng|co)\b)/i;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const URGENCY_RE = /\b(hurry|act now|last chance|today only|limited time|don'?t miss|urgent|final call|expires?|only \d+ left|before it'?s too late)\b/i;
const OVERCLAIM_RE = /\b(guarantee[sd]?|miracles?|cures?|cured|healed for sure|free money|breakthrough|prosperity)\b/i;
const NUMBER_RE = /\d[\d,.:]*\d|\d/g;

const normalizeNumber = (token) => token.replace(/,/g, '');

/**
 * facts: {
 *   title?: string,            // the content's own title; copy must name it (case-insensitive)
 *   allowedNumbers?: string[], // every number, date or time that may appear in copy, e.g. "13", "12:00"
 *   allowTitleOmitted?: boolean,
 *   sourceText?: string        // the content's own words: a sensitive word it uses itself ("miracle") is allowed
 * }
 */
export function validatePushCopy(candidate, facts = {}) {
  const shape = schemaErrors(candidate, COPY_SCHEMA);
  if (shape.length) return { ok: false, errors: shape };
  const { title, body } = candidate;
  const errors = [];
  const text = `${title} ${body}`;

  if (CONTROL_RE.test(text)) errors.push('contains control characters');
  if (LINK_RE.test(text)) errors.push('contains a link or domain');
  if (EMAIL_RE.test(text)) errors.push('contains an email address');
  if (URGENCY_RE.test(text)) errors.push('uses urgency language');
  // Words like "miracle" or "breakthrough" are an overclaim only when the content itself does not say them.
  const source = String(facts.sourceText || '').toLowerCase();
  for (const m of text.matchAll(new RegExp(OVERCLAIM_RE.source, 'gi'))) {
    if (!source.includes(m[0].toLowerCase())) { errors.push('makes an overclaim'); break; }
  }

  const allowed = new Set((facts.allowedNumbers || []).map(normalizeNumber));
  for (const token of text.match(NUMBER_RE) || []) {
    if (!allowed.has(normalizeNumber(token))) errors.push(`number "${token}" is not in the source facts`);
  }

  const letters = body.replace(/[^A-Za-z]/g, '');
  if (letters.length > 12 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6) errors.push('body is mostly capitals');

  if (facts.title && !facts.allowTitleOmitted) {
    const wanted = facts.title.trim().toLowerCase();
    if (wanted && !text.toLowerCase().includes(wanted)) errors.push('does not name the content');
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: { title: title.trim(), body: body.trim(), category: candidate.category } };
}
