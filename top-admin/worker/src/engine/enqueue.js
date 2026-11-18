/**
 * Turns a candidate event into a queue entry that waits for admin approval (decision D4). The entry id is the
 * dedupe key, and it is created only if it does not exist yet, so the same event can never be queued twice.
 */
import { validatePushCopy } from './copy.js';
import { dedupeKey, mayEnqueue } from './policy.js';
import { deterministicCopy } from './templates.js';

export const SEGMENT_ALL = 'all';

/**
 * propose(candidate, facts) may return AI-written copy. It is used only if it passes validatePushCopy;
 * otherwise the deterministic template is used. Returns { status, key?, errors? }.
 */
export async function enqueueCandidate(store, candidate, { now, propose = null } = {}) {
  const built = deterministicCopy(candidate);
  let copy = built.copy;
  let copySource = 'template';
  if (propose) {
    try {
      const proposed = await propose(candidate, built.facts);
      const checked = validatePushCopy(proposed, built.facts);
      if (checked.ok) {
        copy = checked.value;
        copySource = 'ai';
      } else {
        console.warn('[engine] AI copy refused; using template', checked.errors.length);
      }
    } catch {
      console.warn('[engine] AI copy unavailable; using template');
    }
  }

  const verdict = validatePushCopy(copy, built.facts);
  if (!verdict.ok) return { status: 'invalid', errors: verdict.errors };

  const key = dedupeKey({ type: candidate.type, contentId: candidate.contentId, segment: SEGMENT_ALL });
  const path = `notification_queue/${key}`;
  const existing = await store.get(path);
  if (!mayEnqueue(existing?.status)) return { status: 'duplicate', key };

  const entry = {
    status: 'pending',
    type: candidate.type,
    contentId: candidate.contentId,
    segment: SEGMENT_ALL,
    channel: 'push',
    category: verdict.value.category,
    title: verdict.value.title,
    body: verdict.value.body,
    copySource,
    sendAfter: new Date(now),
    attempts: 0,
    createdAt: new Date(now),
    decidedBy: null,
    decidedAt: null,
  };
  if (existing) {
    // A failed entry is re-queued in place, and goes back to pending so an admin reviews it again.
    await store.set(path, entry);
    return { status: 'requeued', key };
  }
  const created = await store.create(path, entry);
  return created ? { status: 'queued', key } : { status: 'duplicate', key };
}
