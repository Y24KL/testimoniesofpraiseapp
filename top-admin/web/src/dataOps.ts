import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Every top-level collection this app writes to, EXCEPT `admins` — that one must never be
 * touched by reset or export tooling, or an admin could accidentally lock themselves out, or
 * their own admin list could end up in a downloadable file.
 */
const COLLECTIONS = [
  'testimonies',
  'notifications',
  'testimonySubmissions',
  'pushTokens',
  'analyticsEvents',
  'sponsorships',
] as const;

async function deleteCollection(name: string): Promise<number> {
  const snap = await getDocs(query(collection(db, name)));
  let n = 0;
  // Firestore batches cap at 500 writes; chunk accordingly.
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + 500)) batch.delete(d.ref);
    await batch.commit();
    n += Math.min(500, snap.docs.length - i);
  }
  return n;
}

/** liveChat/{sessionId}/messages and liveViewers/{sessionId}/viewers are subcollections, so each
 * session doc has to be enumerated and its children deleted before the session doc itself. */
async function deleteSessionedCollection(parent: string, child: string): Promise<number> {
  const sessions = await getDocs(query(collection(db, parent)));
  let n = 0;
  for (const session of sessions.docs) {
    const sub = await getDocs(query(collection(db, parent, session.id, child)));
    for (let i = 0; i < sub.docs.length; i += 500) {
      const batch = writeBatch(db);
      for (const d of sub.docs.slice(i, i + 500)) batch.delete(d.ref);
      await batch.commit();
    }
    n += sub.docs.length;
    await deleteDoc(session.ref).catch(() => undefined);
  }
  return n;
}

export interface ResetResult {
  counts: Record<string, number>;
}

/** Deletes everything EXCEPT the admin list, and puts the live stream back to offline. Irreversible. */
export async function resetEverything(onProgress?: (label: string) => void): Promise<ResetResult> {
  const counts: Record<string, number> = {};

  for (const name of COLLECTIONS) {
    onProgress?.(name);
    counts[name] = await deleteCollection(name);
  }

  onProgress?.('live chat');
  counts['liveChat messages'] = await deleteSessionedCollection('liveChat', 'messages');

  onProgress?.('live chat reports');
  counts['liveChatReports'] = await deleteCollection('liveChatReports');

  onProgress?.('live viewers');
  counts['liveViewers'] = await deleteSessionedCollection('liveViewers', 'viewers');

  onProgress?.('live stream settings');
  await setDoc(doc(db, 'settings', 'live'), {
    isLive: false,
    streamUrl: '',
    sourceType: 'unknown',
    sessionId: '',
    title: '',
    description: '',
    thumbnail: '',
    notifyOnStart: true,
  });

  return { counts };
}

/** Everything the portal collects, as one JSON file — everything in COLLECTIONS, plus the
 * current live settings. Excludes `admins` (identity data) and live chat/viewer presence
 * (transient, not meant to be "data" worth backing up). */
export async function exportEverything(onProgress?: (label: string) => void): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};

  for (const name of COLLECTIONS) {
    onProgress?.(name);
    const snap = await getDocs(query(collection(db, name)));
    out[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  onProgress?.('live stream settings');
  // getDoc on the known document, not a collection list — the rules only ever granted read
  // access to settings/live specifically, never to listing the settings collection itself.
  const liveDoc = await getDoc(doc(db, 'settings', 'live'));
  out['settings'] = liveDoc.exists() ? [{ id: liveDoc.id, ...liveDoc.data() }] : [];

  return out;
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const DATA_COLLECTIONS = COLLECTIONS;
