/**
 * One engine run: read the kill switch, detect new content, queue it for approval, send what is approved,
 * and read delivery receipts. Called from the Worker's cron trigger (see index.js), and from tests.
 *
 * Safety:
 *  - The kill switch is read first. A missing or disabled settings document means nothing runs.
 *  - A lock document prevents two overlapping runs from sending at the same time.
 *  - The first run only sets the cursor. Old content is never announced.
 *  - AI copy is off in this build: every message uses the deterministic template.
 */
import { detectCandidates, initialCursor } from './detect.js';
import { enqueueCandidate } from './enqueue.js';
import { checkReceipts } from './receipts.js';
import { DEFAULT_MAX_PER_DAY } from './policy.js';
import { EXPO_PUSH_URL, EXPO_RECEIPTS_URL, sendApproved } from './send.js';
import { FirestoreRest } from './firestoreRest.js';

export const LOCK_PATH = 'notificationLocks/engine';
export const LOCK_MS = 10 * 60 * 1000;
export const DEFAULT_QUIET = { enabled: true, startMin: 22 * 60, endMin: 7 * 60 };

/** Settings with safe defaults. Invalid values fall back to the default; a missing "enabled" means off. */
export function effectiveSettings(raw) {
  const q = raw?.quietHours;
  const minuteOk = (v) => Number.isInteger(v) && v >= 0 && v < 1440;
  return {
    enabled: raw?.enabled === true,
    categories: raw?.categories && typeof raw.categories === 'object' ? raw.categories : {},
    quietHours: q && minuteOk(q.startMin) && minuteOk(q.endMin) ? { enabled: q.enabled !== false, startMin: q.startMin, endMin: q.endMin } : DEFAULT_QUIET,
    caps: {
      maxPerDay: Number.isInteger(raw?.maxPerDay) && raw.maxPerDay >= 0 ? raw.maxPerDay : DEFAULT_MAX_PER_DAY,
      perCategoryPerDay: raw?.perCategoryPerDay && typeof raw.perCategoryPerDay === 'object' ? raw.perCategoryPerDay : {},
    },
  };
}

/** Takes the run lock, or takes it over if the previous holder's lease has expired. */
export async function acquireLock(store, now) {
  const expiresAt = new Date(now + LOCK_MS);
  if (await store.create(LOCK_PATH, { expiresAt })) return true;
  const current = await store.get(LOCK_PATH);
  if (current?.expiresAt instanceof Date && current.expiresAt.getTime() > now) return false;
  await store.set(LOCK_PATH, { expiresAt });
  return true;
}

export async function runEngine({ store, now = Date.now(), fetchFn = fetch, sleep, expoUrl = EXPO_PUSH_URL, receiptsUrl = EXPO_RECEIPTS_URL, propose = null }) {
  const settings = effectiveSettings(await store.get('settings/notifications'));
  if (!settings.enabled) return { skipped: 'engine_disabled' };
  if (!(await acquireLock(store, now))) return { skipped: 'locked' };
  try {
    const state = await store.get('settings/notificationEngine');
    if (!state?.cursor) {
      const live = await store.get('settings/live');
      await store.set('settings/notificationEngine', { cursor: initialCursor(now, live), lastRunAt: new Date(now), initializedAt: new Date(now) }, { merge: true });
      return { initialized: true };
    }

    const { candidates, cursor } = await detectCandidates(store, state.cursor);
    const queued = { queued: 0, requeued: 0, duplicate: 0, invalid: 0 };
    for (const candidate of candidates) {
      const result = await enqueueCandidate(store, candidate, { now, propose });
      if (result.status === 'queued') queued.queued += 1;
      else if (result.status === 'requeued') queued.requeued += 1;
      else if (result.status === 'duplicate') queued.duplicate += 1;
      else queued.invalid += 1;
    }
    await store.set('settings/notificationEngine', { cursor, lastRunAt: new Date(now) }, { merge: true });

    const sent = await sendApproved(store, { now, fetchFn, sleep, expoUrl, quiet: settings.quietHours, caps: settings.caps });
    const receipts = await checkReceipts(store, { fetchFn, expoUrl: receiptsUrl, now });
    return { candidates: candidates.length, queued, sent, receipts };
  } finally {
    await store.delete(LOCK_PATH);
  }
}

/** Entry point for the Worker's scheduled handler. Uses the service account and the project id from env. */
export async function runNotificationEngineFromEnv(env, { fetchFn = fetch, now = Date.now() } = {}) {
  const store = new FirestoreRest({ serviceAccount: env.FIREBASE_SERVICE_ACCOUNT, projectId: env.FIREBASE_PROJECT_ID, fetchFn });
  return runEngine({ store, now, fetchFn });
}
