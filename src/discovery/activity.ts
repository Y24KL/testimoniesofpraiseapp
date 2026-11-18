/**
 * Records minimal, per-person activity (T.O.P. 2.0 Phase 1). Each record is a fixed shape: type, content type,
 * content id, source, server time. It is fire-and-forget and never blocks the screen. It is skipped when the
 * person has opted out, when they are signed out, or when the event is not valid.
 */
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/api/firebase';
import { mayRecordActivity, readDiscovery, validActivity, type ActivityEvent, type DiscoverySettings } from './rules';

let cachedOptOut: { uid: string; settings: DiscoverySettings } | null = null;

/** Reads the person's discovery settings once per session. A failed read means: do not record. */
export async function loadDiscovery(uid: string): Promise<DiscoverySettings | null> {
  if (cachedOptOut?.uid === uid) return cachedOptOut.settings;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'discovery'));
    const settings = readDiscovery(snap.exists() ? snap.data() : null);
    cachedOptOut = { uid, settings };
    return settings;
  } catch {
    return null;
  }
}

/** Called after a discovery setting changes, so the next event reads the new value. */
export function resetDiscoveryCache(): void {
  cachedOptOut = null;
}

export function recordActivity(event: ActivityEvent): void {
  const uid = auth.currentUser?.uid;
  const valid = validActivity(event);
  if (!uid || !valid) return;
  void (async () => {
    const settings = await loadDiscovery(uid);
    if (!mayRecordActivity(settings)) return;
    await addDoc(collection(db, 'user_activity'), { uid, ...valid, ts: serverTimestamp() });
  })().catch(() => undefined);
}
