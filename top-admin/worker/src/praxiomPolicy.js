/**
 * Pure rules for talking to Praxiom: which failures are worth retrying, how long to wait, and how a
 * concurrency lease is granted. No I/O here, so every rule can be unit-tested.
 *
 * Limits come from the Praxiom docs (https://cloud.praxiomai.io/docs, read 2026-11-18):
 *   - 2 chat requests in progress per account (429 concurrency_limit, Retry-After about 5 s)
 *   - 60 requests per minute per key (429 rate_limited)
 *   - 429 capacity and 503 model_unavailable are transient (Retry-After usually 30 s)
 * Requests rejected with 400, 402, 429 or 503 are not charged, so a retry does not double-bill.
 */

export const RETRYABLE_PROVIDER_CODES = new Set(['rate_limited', 'concurrency_limit', 'capacity', 'video_queue_full', 'model_unavailable']);
export const MAX_RETRY_WAIT_MS = 8000;
export const BASE_BACKOFF_MS = 1000;

/**
 * Decides whether a failed attempt should be retried.
 * `error` carries `providerCode`, `status` and optionally `retryAfterMs` (see praxiom.js).
 * An error with no provider code is retried only for 429 or 503 (for example, a body that was not JSON).
 */
export function retryDecision(error, { attempt, maxAttempts = 2, elapsedMs = 0, budgetMs = 20000 }) {
  if (attempt >= maxAttempts) return { retry: false, reason: 'attempts_exhausted' };
  const code = error?.providerCode || '';
  const status = error?.status;
  const retryable = code ? RETRYABLE_PROVIDER_CODES.has(code) : status === 429 || status === 503;
  if (!retryable) return { retry: false, reason: 'not_retryable' };
  const requested = Number.isFinite(error?.retryAfterMs) ? error.retryAfterMs : BASE_BACKOFF_MS * 2 ** (attempt - 1);
  const waitMs = Math.min(Math.max(0, requested), MAX_RETRY_WAIT_MS);
  if (elapsedMs + waitMs > budgetMs) return { retry: false, reason: 'budget_exhausted' };
  return { retry: true, waitMs };
}

/** Parses a Retry-After header (seconds). Returns milliseconds, or null when absent or not a number. */
export function parseRetryAfter(value) {
  if (value == null || value === '') return null;
  const seconds = Number(String(value).trim());
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(Math.round(seconds * 1000), MAX_RETRY_WAIT_MS);
}

export const LEASE_LIMITS = { minLimit: 1, maxLimit: 10, minTtlMs: 1000, maxTtlMs: 120000 };

/** Checks a lease request from a caller. Returns an error string, or null when valid. */
export function invalidLeaseRequest(body) {
  if (!body || typeof body !== 'object') return 'body';
  if (body.action !== 'acquire' && body.action !== 'release') return 'action';
  if (typeof body.leaseId !== 'string' || body.leaseId.length < 1 || body.leaseId.length > 64) return 'leaseId';
  if (body.action === 'acquire') {
    if (!Number.isInteger(body.limit) || body.limit < LEASE_LIMITS.minLimit || body.limit > LEASE_LIMITS.maxLimit) return 'limit';
    if (!Number.isInteger(body.ttlMs) || body.ttlMs < LEASE_LIMITS.minTtlMs || body.ttlMs > LEASE_LIMITS.maxTtlMs) return 'ttlMs';
  }
  return null;
}

/**
 * Applies one acquire or release to a map of { leaseId: expiresAtMs }. Expired leases are dropped first,
 * so a Worker that dies mid-request cannot hold a slot forever.
 * Returns the new map and whether the caller was granted a slot.
 */
export function applyLeaseAction(leases, action, { leaseId, limit, ttlMs }, now) {
  const live = Object.fromEntries(Object.entries(leases || {}).filter(([, expiresAt]) => Number(expiresAt) > now));
  if (action === 'release') {
    delete live[leaseId];
    return { leases: live, granted: true, inFlight: Object.keys(live).length };
  }
  if (Object.keys(live).length >= limit && !(leaseId in live)) {
    return { leases: live, granted: false, inFlight: Object.keys(live).length };
  }
  live[leaseId] = now + ttlMs;
  return { leases: live, granted: true, inFlight: Object.keys(live).length };
}
