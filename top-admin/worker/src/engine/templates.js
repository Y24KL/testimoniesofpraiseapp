/**
 * Deterministic notification copy, one template per event type. This is what is sent when no AI copy is
 * proposed or when the proposal fails validation. Every title or body names the real content, and no template
 * contains a number that is not in the content's own title.
 */

export const EVENT_TYPES = ['testimony', 'lyrical', 'article', 'live'];
const MAX_NAME_CHARS = 100;

const numbersIn = (text) => text.match(/\d[\d,.:]*\d|\d/g) || [];

export function shortName(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > MAX_NAME_CHARS ? `${text.slice(0, MAX_NAME_CHARS - 1).trimEnd()}…` : text;
}

/** Returns { copy: { title, body, category }, facts } for one candidate event. */
export function deterministicCopy(candidate) {
  const name = shortName(candidate.title);
  const facts = { title: name || undefined, allowedNumbers: numbersIn(name), allowTitleOmitted: !name };
  switch (candidate.type) {
    case 'testimony':
      return { copy: { title: 'NEW TESTIMONY AVAILABLE', body: `${name} is now available to watch.`, category: 'testimonies' }, facts };
    case 'lyrical':
      return { copy: { title: 'NEW LYRICAL ANALYSIS', body: `${name} is now available to watch.`, category: 'announcements' }, facts };
    case 'article':
      return { copy: { title: 'NEW UPDATE PUBLISHED', body: `${name} is now available to read.`, category: 'articles' }, facts };
    case 'live':
      return {
        copy: { title: 'WE ARE LIVE', body: name ? `${name} is live now. Join the broadcast.` : 'Join the live broadcast now.', category: 'live' },
        facts,
      };
    default:
      throw new Error(`Unknown event type ${candidate.type}`);
  }
}
