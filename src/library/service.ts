/**
 * My T.O.P. data: saved items, collections and listening history, each under users/{uid}. Lists are live
 * (onSnapshot), so a change on one device appears on the others. Writes follow the Firestore rules: saves are
 * create-only, and history writes are complete documents stamped with server time.
 */
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
  type DocumentData, type DocumentReference, type QueryDocumentSnapshot, type Timestamp, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { historyOverflow, isFinished, libraryKey, LIBRARY_LIMITS, type LibraryKind } from './rules';

export interface SavedItem {
  key: string;
  kind: LibraryKind;
  id: string;
  title: string;
  subtitle?: string;
  thumbnail?: string;
  savedAtMs: number;
}

export interface Collection {
  id: string;
  name: string;
  itemIds: string[];
  updatedAtMs: number;
}

export interface HistoryItem {
  key: string;
  kind: LibraryKind;
  id: string;
  title: string;
  thumbnail?: string;
  positionSec: number;
  durationSec: number;
  completed: boolean;
  updatedAtMs: number;
}

export interface SaveInput {
  kind: LibraryKind;
  id: string;
  title: string;
  subtitle?: string;
  thumbnail?: string;
}

const ms = (ts: Timestamp | null | undefined) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now());
const clip = (s: string | undefined, n: number) => (s ? s.slice(0, n) : undefined);
const withOptional = (base: DocumentData, extra: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(extra)) if (v) base[k] = v;
  return base;
};

const savedCol = (uid: string) => collection(db, 'users', uid, 'saved');
const collectionsCol = (uid: string) => collection(db, 'users', uid, 'collections');
const historyCol = (uid: string) => collection(db, 'users', uid, 'history');

// ---------------- saved items ----------------

/** Saves an item. Saving something already saved does nothing. Returns true when it was newly saved. */
export async function saveItem(uid: string, input: SaveInput): Promise<boolean> {
  const key = libraryKey(input.kind, input.id);
  if (!key) throw new Error('This item cannot be saved.');
  const ref = doc(db, 'users', uid, 'saved', key);
  if ((await getDoc(ref)).exists()) return false;
  await setDoc(
    ref,
    withOptional(
      { contentType: input.kind, contentId: input.id, title: clip(input.title, LIBRARY_LIMITS.titleMax) || 'Untitled', savedAt: serverTimestamp() },
      { subtitle: clip(input.subtitle, 200), thumbnail: input.thumbnail && input.thumbnail.length <= 1000 ? input.thumbnail : undefined },
    ),
  );
  return true;
}

export async function unsaveItem(uid: string, kind: LibraryKind, id: string): Promise<void> {
  const key = libraryKey(kind, id);
  if (key) await deleteDoc(doc(db, 'users', uid, 'saved', key));
}

export function subscribeSaved(uid: string, next: (items: SavedItem[]) => void, fail: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(savedCol(uid), orderBy('savedAt', 'desc'), limit(500)),
    (snap) => next(snap.docs.map(toSaved).filter((s): s is SavedItem => s !== null)),
    fail,
  );
}

function toSaved(d: QueryDocumentSnapshot): SavedItem | null {
  const v = d.data();
  if (v.contentType !== 'testimony' && v.contentType !== 'lyrical') return null;
  return {
    key: d.id,
    kind: v.contentType,
    id: String(v.contentId ?? ''),
    title: String(v.title ?? ''),
    subtitle: typeof v.subtitle === 'string' ? v.subtitle : undefined,
    thumbnail: typeof v.thumbnail === 'string' ? v.thumbnail : undefined,
    savedAtMs: ms(v.savedAt),
  };
}

// ---------------- collections ----------------

export async function createCollection(uid: string, name: string): Promise<string> {
  const ref = await addDoc(collectionsCol(uid), { name, itemIds: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function renameCollection(uid: string, id: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'collections', id), { name, updatedAt: serverTimestamp() });
}

export async function setCollectionItems(uid: string, id: string, itemIds: string[]): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'collections', id), { itemIds, updatedAt: serverTimestamp() });
}

export async function deleteCollection(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'collections', id));
}

export function subscribeCollections(uid: string, next: (items: Collection[]) => void, fail: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collectionsCol(uid), orderBy('updatedAt', 'desc'), limit(LIBRARY_LIMITS.itemsPerCollection)),
    (snap) =>
      next(
        snap.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id,
            name: String(v.name ?? 'Untitled'),
            itemIds: Array.isArray(v.itemIds) ? v.itemIds.filter((x: unknown): x is string => typeof x === 'string') : [],
            updatedAtMs: ms(v.updatedAt),
          };
        }),
      ),
    fail,
  );
}

// ---------------- listening history ----------------

let writesSincePrune = 0;

/** Records where the person is in an item. Called from the player, throttled by the caller. */
export async function recordProgress(uid: string, input: SaveInput, positionSec: number, durationSec: number): Promise<void> {
  const key = libraryKey(input.kind, input.id);
  if (!key) return;
  const pos = Math.max(0, Math.min(86400, Math.floor(positionSec)));
  const dur = Math.max(0, Math.min(86400, Math.floor(durationSec)));
  await setDoc(
    doc(db, 'users', uid, 'history', key),
    withOptional(
      {
        contentType: input.kind,
        contentId: input.id,
        title: clip(input.title, LIBRARY_LIMITS.titleMax) || 'Untitled',
        positionSec: pos,
        durationSec: dur,
        completed: isFinished(pos, dur),
        updatedAt: serverTimestamp(),
      },
      { thumbnail: input.thumbnail && input.thumbnail.length <= 1000 ? input.thumbnail : undefined },
    ),
  );
  writesSincePrune += 1;
  if (writesSincePrune >= 10) {
    writesSincePrune = 0;
    await pruneHistory(uid).catch(() => undefined);
  }
}

/** The saved position for one item, or null when there is none. */
export async function getProgress(uid: string, kind: LibraryKind, id: string): Promise<{ positionSec: number; completed: boolean } | null> {
  const key = libraryKey(kind, id);
  if (!key) return null;
  const snap = await getDoc(doc(db, 'users', uid, 'history', key));
  if (!snap.exists()) return null;
  const v = snap.data();
  return { positionSec: Number(v.positionSec) || 0, completed: v.completed === true };
}

export async function deleteHistoryItem(uid: string, kind: LibraryKind, id: string): Promise<void> {
  const key = libraryKey(kind, id);
  if (key) await deleteDoc(doc(db, 'users', uid, 'history', key));
}

export function subscribeHistory(uid: string, next: (items: HistoryItem[]) => void, fail: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(historyCol(uid), orderBy('updatedAt', 'desc'), limit(LIBRARY_LIMITS.historyCap)),
    (snap) =>
      next(
        snap.docs.map((d) => {
          const v = d.data();
          return {
            key: d.id,
            kind: v.contentType === 'lyrical' ? 'lyrical' : 'testimony',
            id: String(v.contentId ?? ''),
            title: String(v.title ?? ''),
            thumbnail: typeof v.thumbnail === 'string' ? v.thumbnail : undefined,
            positionSec: Number(v.positionSec) || 0,
            durationSec: Number(v.durationSec) || 0,
            completed: v.completed === true,
            updatedAtMs: ms(v.updatedAt),
          };
        }),
      ),
    fail,
  );
}

/** Deletes history beyond the cap, oldest first, so the collection stays bounded. */
export async function pruneHistory(uid: string): Promise<number> {
  const snap = await getDocs(query(historyCol(uid), orderBy('updatedAt', 'desc'), limit(LIBRARY_LIMITS.historyCap + 50)));
  const entries = snap.docs.map((d) => ({ ref: d.ref, updatedMs: ms(d.data().updatedAt as Timestamp | null) }));
  const overflow = historyOverflow(entries, LIBRARY_LIMITS.historyCap);
  if (overflow.length === 0) return 0;
  const batch = writeBatch(db);
  overflow.forEach((e) => batch.delete(e.ref));
  await batch.commit();
  return overflow.length;
}

// ---------------- account deletion ----------------

/**
 * Deletes everything personal for this person: saved items, collections, listening history, their activity
 * records and their discovery settings. Called before the account is deleted. Every query is filtered to this
 * person, which the owner-only rules require. Batches stay under the Firestore limit of 500.
 */
export async function clearPersonalData(uid: string): Promise<number> {
  const scopes = [
    query(savedCol(uid), limit(1000)),
    query(collectionsCol(uid), limit(1000)),
    query(historyCol(uid), limit(1000)),
    query(collection(db, 'user_activity'), where('uid', '==', uid), limit(1000)),
  ];
  let removed = 0;
  for (const q of scopes) {
    const refs = (await getDocs(q)).docs.map((d) => d.ref);
    removed += await deleteRefs(refs);
  }
  const discovery = doc(db, 'users', uid, 'private', 'discovery');
  if ((await getDoc(discovery)).exists()) {
    await deleteDoc(discovery);
    removed += 1;
  }
  return removed;
}

async function deleteRefs(refs: DocumentReference[]): Promise<number> {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + 400)) batch.delete(ref);
    await batch.commit();
  }
  return refs.length;
}
