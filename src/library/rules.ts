/**
 * Pure rules for My T.O.P.: canonical keys, limits, collection edits, resume position, and the rate of progress
 * writes. The Firestore rules (top-admin/firestore.rules, "MY T.O.P.") enforce the same key format and limits.
 */

export const LIBRARY_KINDS = ['testimony', 'lyrical'] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export const LIBRARY_LIMITS = {
  collectionNameMax: 60,
  itemsPerCollection: 200,
  historyCap: 200,
  titleMax: 200,
  /** Within this many seconds of the start, a position is not worth resuming. */
  resumeStartSec: 5,
  /** Within this many seconds of the end, the item counts as finished and resumes from the start. */
  finishedWithinSec: 10,
  /** Progress writes are at most this often, unless the position moved this far. */
  writeIntervalMs: 15000,
  writeDeltaSec: 30,
} as const;

const ID = /^[A-Za-z0-9_-]{1,100}$/;

/** "<kind>_<id>", the document id used everywhere in My T.O.P. Null when the id is not safe. */
export function libraryKey(kind: LibraryKind, id: string): string | null {
  if (!(LIBRARY_KINDS as readonly string[]).includes(kind) || !ID.test(id)) return null;
  return `${kind}_${id}`;
}

export function parseLibraryKey(key: string): { kind: LibraryKind; id: string } | null {
  const i = key.indexOf('_');
  if (i < 0) return null;
  const kind = key.slice(0, i);
  const id = key.slice(i + 1);
  if (!(LIBRARY_KINDS as readonly string[]).includes(kind) || !ID.test(id)) return null;
  return { kind: kind as LibraryKind, id };
}

/** A trimmed collection name, or null when it is empty or too long. */
export function validCollectionName(name: string): string | null {
  const t = (name ?? '').trim();
  return t.length >= 1 && t.length <= LIBRARY_LIMITS.collectionNameMax ? t : null;
}

/** Adds a key to a collection's items, without duplicates and within the limit. */
export function addToCollection(itemIds: string[], key: string): { itemIds: string[]; result: 'added' | 'present' | 'full' } {
  if (itemIds.includes(key)) return { itemIds, result: 'present' };
  if (itemIds.length >= LIBRARY_LIMITS.itemsPerCollection) return { itemIds, result: 'full' };
  return { itemIds: [...itemIds, key], result: 'added' };
}

export function removeFromCollection(itemIds: string[], key: string): string[] {
  return itemIds.filter((k) => k !== key);
}

/** Whether a position counts as finished for this duration. */
export function isFinished(positionSec: number, durationSec: number): boolean {
  return durationSec > 0 && positionSec >= durationSec - LIBRARY_LIMITS.finishedWithinSec;
}

/**
 * Where to start playback. The furthest of this device's position and the saved position wins, so a person
 * who watched on the phone and then on the website continues from the furthest point. A finished item starts
 * from the beginning, and near-start positions are not worth resuming.
 */
export function resumeFrom({ localSec, remoteSec, remoteCompleted, durationSec }: { localSec?: number | null; remoteSec?: number | null; remoteCompleted?: boolean; durationSec?: number }): number {
  const candidates = [localSec, remoteCompleted ? undefined : remoteSec].filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  const best = candidates.length ? Math.max(...candidates) : 0;
  if (best <= LIBRARY_LIMITS.resumeStartSec) return 0;
  if (durationSec !== undefined && isFinished(best, durationSec)) return 0;
  return best;
}

/**
 * Whether a progress write is due. Writes are throttled by time, and sooner when the position has moved a lot.
 * Pausing and finishing always write (force), so the saved position is never stale.
 */
export function shouldWriteProgress(input: { lastWrittenMs: number | null; nowMs: number; lastPositionSec: number | null; positionSec: number; force?: boolean }): boolean {
  if (input.force) return true;
  if (input.lastWrittenMs === null || input.lastPositionSec === null) return true;
  if (input.nowMs - input.lastWrittenMs >= LIBRARY_LIMITS.writeIntervalMs) return true;
  return Math.abs(input.positionSec - input.lastPositionSec) >= LIBRARY_LIMITS.writeDeltaSec;
}

/** Newest first, by the saved time in milliseconds. Pure, so the screen does not have to repeat it. */
export function sortNewestFirst<T>(items: T[], timeOf: (item: T) => number): T[] {
  return [...items].sort((a, b) => timeOf(b) - timeOf(a));
}

/** History entries beyond the cap, oldest first. These are deleted so the history stays bounded. */
export function historyOverflow<T extends { updatedMs: number }>(entries: T[], cap = LIBRARY_LIMITS.historyCap): T[] {
  if (entries.length <= cap) return [];
  return [...entries].sort((a, b) => a.updatedMs - b.updatedMs).slice(0, entries.length - cap);
}
