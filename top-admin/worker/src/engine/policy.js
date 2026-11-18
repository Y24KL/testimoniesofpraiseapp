/**
 * Deterministic notification policy: quiet hours in the recipient's local time, daily frequency caps,
 * the kill switch, and duplicate keys. The model never decides any of these.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;
export const DEFAULT_OFFSET_MINUTES = 60; // West Africa Time (UTC+1), used only when a device has no timezone

/** Minute of the day (0-1439) at a fixed UTC offset in minutes. */
export function localMinuteOfDay(utcMs, utcOffsetMinutes) {
  const minutes = Math.floor(utcMs / MINUTE_MS) + utcOffsetMinutes;
  return ((minutes % 1440) + 1440) % 1440;
}

/** True when `utcMs` falls inside quiet hours at the recipient's offset. Quiet hours may wrap midnight. */
export function isInQuietHours(utcMs, utcOffsetMinutes, quiet) {
  if (!quiet || quiet.enabled === false) return false;
  const { startMin, endMin } = quiet;
  if (startMin === endMin) return false;
  const now = localMinuteOfDay(utcMs, utcOffsetMinutes);
  return startMin < endMin ? now >= startMin && now < endMin : now >= startMin || now < endMin;
}

/** The earliest UTC time at or after `utcMs` that is outside quiet hours. */
export function nextSendableUtc(utcMs, utcOffsetMinutes, quiet) {
  if (!isInQuietHours(utcMs, utcOffsetMinutes, quiet)) return utcMs;
  const now = localMinuteOfDay(utcMs, utcOffsetMinutes);
  const minutesUntilEnd = (quiet.endMin - now + 1440) % 1440;
  return utcMs + minutesUntilEnd * MINUTE_MS;
}

/**
 * Frequency cap for one user. `sent` counts sends in the last 24 hours: { total, byCategory: { name: n } }.
 * caps: { maxPerDay, perCategoryPerDay: { name: n } }. A missing cap means no limit.
 */
export function capDecision(sent, category, caps) {
  if (caps?.maxPerDay != null && (sent?.total || 0) >= caps.maxPerDay) return { allowed: false, reason: 'daily_cap' };
  const limit = caps?.perCategoryPerDay?.[category];
  if (limit != null && (sent?.byCategory?.[category] || 0) >= limit) return { allowed: false, reason: 'category_cap' };
  return { allowed: true };
}

/**
 * Kill switch. The engine fails closed: a missing or disabled settings document sends nothing.
 * settings: { enabled: boolean, categories: { name: { enabled: boolean } } }
 */
export function engineAllows(settings, category) {
  if (!settings || settings.enabled !== true) return { allowed: false, reason: 'engine_disabled' };
  if (settings.categories?.[category]?.enabled === false) return { allowed: false, reason: 'category_disabled' };
  return { allowed: true };
}

const clean = (value) => String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);

/**
 * Stable id for one notification to one audience segment on one channel. Writing the queue document with
 * this id, and only if it does not exist yet, makes duplicate sends impossible across retries and reruns.
 */
export function dedupeKey({ type, contentId, segment, channel = 'push' }) {
  return [type, contentId, segment, channel].map(clean).join(':');
}

/** A queue entry blocks a new one unless it previously failed (failed entries may be retried in place). */
export function mayEnqueue(existingStatus) {
  return !existingStatus || existingStatus === 'failed';
}
