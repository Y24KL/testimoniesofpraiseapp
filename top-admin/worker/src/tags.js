/**
 * Content interest tags (Praxiom Phase 2b). One fixed list is shared by the app (interests), the admin
 * editors (content tags), Firestore rules and this Worker; tests/contentTags.test.mjs keeps the copies equal.
 *
 * Suggestions come from Praxiom when it is configured and answers validly, otherwise from a deterministic
 * keyword matcher. Praxiom sees only public content text (title, description, category, keywords, an
 * excerpt), never anything about users. Its answer is checked against the list; anything else is dropped.
 */
import { praxiomChat } from './praxiom.js';
import { validateModelOutput } from './structured.js';

export const CONTENT_TAGS = ['healing', 'salvation', 'deliverance', 'miracles', 'finances', 'family', 'marriage', 'youth', 'faith', 'hope', 'worship', 'missions'];
export const MAX_TAGS_PER_ITEM = 5;
export const MAX_SUGGESTED = 3;
export const MAX_ITEMS_PER_REQUEST = 8;
export const CONTENT_TYPES = ['testimony', 'written', 'article', 'lyrical', 'loveworld'];

const TAG_SET = new Set(CONTENT_TAGS);

/** Keeps known tags only, without duplicates, at most `max`. */
export function sanitizeTags(input, max = MAX_TAGS_PER_ITEM) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const t of input) {
    const v = typeof t === 'string' ? t.trim().toLowerCase() : '';
    if (TAG_SET.has(v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

// Words and phrases that point to a tag. Matched case-insensitively on whole words.
const KEYWORDS = {
  healing: ['heal', 'healed', 'healing', 'cured', 'cure', 'sickness', 'sick', 'disease', 'cancer', 'tumour', 'tumor', 'diagnosis', 'diagnosed', 'doctor', 'doctors', 'hospital', 'surgery', 'recovered', 'recovery', 'fever', 'kidney', 'diabetes', 'stroke', 'blind', 'deaf', 'paralysed', 'paralyzed', 'infirmity'],
  salvation: ['salvation', 'saved', 'born again', 'gave my life', 'accepted christ', 'accepted jesus', 'repented', 'repentance', 'new birth', 'converted'],
  deliverance: ['deliverance', 'delivered', 'demon', 'demons', 'demonic', 'oppression', 'oppressed', 'addiction', 'addicted', 'bondage', 'witchcraft', 'nightmares', 'set free'],
  miracles: ['miracle', 'miracles', 'miraculous', 'miraculously', 'supernatural', 'supernaturally', 'impossible'],
  finances: ['financial', 'finances', 'finance', 'money', 'debt', 'debts', 'business', 'contract', 'salary', 'promotion', 'job', 'employment', 'employed', 'prosperity', 'provision', 'rent'],
  family: ['family', 'child', 'children', 'baby', 'pregnancy', 'pregnant', 'conceived', 'fruit of the womb', 'son', 'daughter', 'mother', 'father', 'parents', 'barren', 'twins'],
  marriage: ['marriage', 'married', 'husband', 'wife', 'wedding', 'spouse', 'divorce', 'engaged'],
  youth: ['student', 'students', 'school', 'exam', 'exams', 'examination', 'university', 'campus', 'teenager', 'youth', 'admission', 'graduate', 'graduated', 'scholarship', 'waec', 'jamb'],
  faith: ['faith', 'believed', 'believe', 'trust god', 'word of god', 'confession', 'confessed', 'spoke the word'],
  hope: ['hope', 'hopeless', 'encouragement', 'encouraged', 'despair', 'depression', 'depressed', 'comfort', 'anxiety', 'fear', 'peace', 'suicidal'],
  worship: ['worship', 'praise', 'praises', 'song', 'songs', 'sing', 'singing', 'music', 'choir', 'hymn', 'ministration', 'loveworld singers'],
  missions: ['mission', 'missions', 'outreach', 'evangelism', 'evangelise', 'evangelize', 'soul winning', 'crusade', 'rhapsody of realities'],
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERNS = Object.fromEntries(
  Object.entries(KEYWORDS).map(([tag, words]) => [tag, words.map((w) => new RegExp(`(^|[^a-z])${escape(w).replace(/ /g, '\\s+')}([^a-z]|$)`, 'i'))]),
);

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

/** Normalises one item from a request into the public text fields used for tagging. */
export function tagInput(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    contentType: CONTENT_TYPES.includes(r.contentType) ? r.contentType : 'testimony',
    title: clip(r.title, 200).trim(),
    description: clip(r.description, 1500).trim(),
    category: clip(r.category, 60).trim(),
    keywords: (Array.isArray(r.keywords) ? r.keywords : []).filter((k) => typeof k === 'string').slice(0, 20).map((k) => k.slice(0, 40)),
    excerpt: clip(r.excerpt, 2500).trim(),
  };
}

/**
 * Deterministic suggestion: a tag needs a match in the title, or matches on two different words elsewhere.
 * Worship music (lyrical analysis, LoveWorld videos) is always tagged "worship".
 */
export function suggestByKeywords(item) {
  const it = tagInput(item);
  const rest = [it.description, it.category, it.keywords.join(' '), it.excerpt].join(' \n ');
  const scored = [];
  for (const tag of CONTENT_TAGS) {
    let score = 0;
    let hits = 0;
    for (const re of PATTERNS[tag]) {
      if (re.test(it.title)) { score += 2; hits += 1; } else if (re.test(rest)) { score += 1; hits += 1; }
    }
    if (it.category && it.category.toLowerCase() === tag) score += 2;
    if (score >= 2 && hits >= 1) scored.push([tag, score]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  let tags = scored.map(([t]) => t);
  if ((it.contentType === 'lyrical' || it.contentType === 'loveworld') && !tags.includes('worship')) tags = ['worship', ...tags];
  return tags.slice(0, MAX_SUGGESTED);
}

const SCHEMA = {
  type: 'object',
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      maxItems: MAX_ITEMS_PER_REQUEST,
      items: {
        type: 'object',
        required: ['i', 'tags'],
        properties: {
          i: { type: 'integer', min: 0, max: MAX_ITEMS_PER_REQUEST - 1 },
          tags: { type: 'array', maxItems: MAX_SUGGESTED, items: { type: 'string', enum: CONTENT_TAGS } },
        },
      },
    },
  },
};

function prompt(items) {
  const lines = items.map((it, i) => JSON.stringify({ i, type: it.contentType, title: it.title, description: it.description, category: it.category, keywords: it.keywords, excerpt: it.excerpt.slice(0, 1200) }));
  return [
    {
      role: 'system',
      content:
        `You label Christian testimony and worship content with topic tags. Allowed tags: ${CONTENT_TAGS.join(', ')}. ` +
        `For each item choose 1 to ${MAX_SUGGESTED} tags that the text clearly supports. Do not guess from the title alone when the text says otherwise. ` +
        'If no tag clearly fits, return an empty list for that item. ' +
        'Reply with JSON only, in this exact shape: {"results":[{"i":0,"tags":["healing"]}]}. No other text.',
    },
    { role: 'user', content: lines.join('\n') },
  ];
}

/**
 * Suggests tags for up to MAX_ITEMS_PER_REQUEST items with one Praxiom call. Returns, per item,
 * { tags, source: 'praxiom' | 'keywords' }. Any Praxiom failure or invalid answer falls back to keywords
 * for that item; a Praxiom answer of "no tags" also falls back, so every item gets the best available.
 */
export async function suggestTags(env, rawItems, { chat = praxiomChat } = {}) {
  const items = (Array.isArray(rawItems) ? rawItems : []).slice(0, MAX_ITEMS_PER_REQUEST).map(tagInput);
  const byKeywords = items.map(suggestByKeywords);
  let fromAi = items.map(() => null);
  let aiStatus = 'unavailable';
  if (env?.PRAXIOM_API_KEY && items.length) {
    try {
      const res = await chat(env, { messages: prompt(items), maxTokens: 300, temperature: 0 });
      const checked = validateModelOutput(res.text, SCHEMA);
      if (checked.ok) {
        aiStatus = 'ok';
        fromAi = items.map(() => null);
        for (const r of checked.value.results) if (r.i < items.length && fromAi[r.i] === null) fromAi[r.i] = sanitizeTags(r.tags, MAX_SUGGESTED);
      } else {
        aiStatus = 'invalid';
        console.error('[tags] Praxiom answer failed validation', checked.errors.slice(0, 3).join('; '));
      }
    } catch (e) {
      aiStatus = 'error';
      console.error('[tags] Praxiom request failed', e?.code || e?.message || e);
    }
  }
  const results = items.map((it, i) => {
    const ai = fromAi[i];
    if (ai && ai.length) {
      const tags = (it.contentType === 'lyrical' || it.contentType === 'loveworld') && !ai.includes('worship') ? ['worship', ...ai].slice(0, MAX_SUGGESTED) : ai;
      return { tags, source: 'praxiom' };
    }
    return { tags: byKeywords[i], source: 'keywords' };
  });
  return { results, ai: aiStatus };
}
