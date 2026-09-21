import { addDoc, collection, deleteField, doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { pushEnabled, sendPush } from './push';

export type NotifyResult = { status: 'sent' | 'in-app-only' | 'skipped' } | { status: 'failed'; message: string };

/** Adds an entry to the app's in-app notification list. */
export function addFeed(entry: { title: string; message: string; type: string; contentId?: string }) {
  return addDoc(collection(db, 'notifications'), {
    title: entry.title,
    message: entry.message,
    type: entry.type,
    ...(entry.contentId ? { contentId: entry.contentId } : {}),
    published: true,
    skipPush: true, // informational entry: the push (if any) is sent separately
    createdAt: serverTimestamp(),
  });
}

/**
 * Runs once per testimony: claims `pushSentAt` in a transaction so re-saving, double-clicking or
 * unpublishing/republishing never notifies twice. If the push fails, the claim is released so it can be retried.
 */
export async function notifyTestimonyPublished(id: string): Promise<NotifyResult> {
  const ref = doc(db, 'testimonies', id);
  const claimed = await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists() || s.get('pushSentAt')) return false;
    tx.update(ref, { pushSentAt: serverTimestamp() });
    return true;
  });
  if (!claimed) return { status: 'skipped' };

  const title = 'NEW TESTIMONY AVAILABLE';
  const message = 'A new testimony has just been added to Testimonies of Praise.';
  if (pushEnabled) {
    const r = await sendPush({ pref: 'testimonies', title, body: message, data: { type: 'testimony', contentId: id } });
    if (!r.ok) {
      await updateDoc(ref, { pushSentAt: deleteField() }).catch(() => undefined);
      return { status: 'failed', message: r.error };
    }
  }
  await addFeed({ title, message, type: 'testimony', contentId: id });
  return { status: pushEnabled ? 'sent' : 'in-app-only' };
}

export async function notifyLiveStarted(liveTitle: string): Promise<NotifyResult> {
  const title = 'WE ARE LIVE';
  const message = liveTitle || 'Join the live broadcast now.';
  if (pushEnabled) {
    const r = await sendPush({ pref: 'live', title, body: message, data: { type: 'live' } });
    if (!r.ok) return { status: 'failed', message: r.error };
  }
  await addFeed({ title, message, type: 'live' });
  return { status: pushEnabled ? 'sent' : 'in-app-only' };
}

export function describe(r: NotifyResult): string {
  switch (r.status) {
    case 'sent': return 'Push notification sent.';
    case 'in-app-only': return 'Added to the app’s notification list. (Push isn’t set up, so no push was sent.)';
    case 'skipped': return 'A notification was already sent for this one.';
    case 'failed': return `The push notification failed: ${r.message}`;
  }
}
