/** Pure helpers for the clip indexer (no network, no Firebase), so they can be tested on their own. */

/** "m:ss" or "h:mm:ss" to seconds; null when it cannot be read. */
export function toSeconds(label) {
  const parts = String(label ?? '').trim().split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

/** Seconds to a display label: 0:42, 12:05, 1:02:09. */
export function clipLabel(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** Keeps only well-formed segments inside the video length. Returns at most 80 clean clips. */
export function cleanSegments(raw, durationSec) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const start = toSeconds(item?.start);
    const end = toSeconds(item?.end);
    const description = typeof item?.description === 'string' ? item.description.trim().slice(0, 600) : '';
    if (start === null || end === null || !description || end <= start) return [];
    if (durationSec && start >= durationSec) return [];
    const endClamped = durationSec ? Math.min(end, durationSec) : end;
    return [{ startSec: Math.floor(start), endSec: Math.ceil(endClamped), description }];
  }).slice(0, 80);
}
