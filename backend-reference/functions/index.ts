/**
 * Push notifications for Testimonies of Praise (reference implementation).
 *
 * Sends through Expo's push service, which delivers to FCM (Android) and APNs (iOS) using the
 * credentials you upload to EAS. Tokens are stored by the app in `pushTokens/{token}`:
 *   { token, uid, platform, prefs: { testimonies, live, announcements } }
 *
 * Duplicate protection: each source document gets a `pushSentAt` timestamp inside a transaction, so a
 * re-save, retry, or double trigger never sends twice.
 */
import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';

admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();

type PrefKey = 'testimonies' | 'live' | 'announcements';

async function claim(ref: FirebaseFirestore.DocumentReference): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.get('pushSentAt')) return false;
    tx.update(ref, { pushSentAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
}

async function broadcast(pref: PrefKey, msg: Omit<ExpoPushMessage, 'to'>) {
  const snap = await db.collection('pushTokens').where(`prefs.${pref}`, '==', true).get();
  const tokens = snap.docs.map((d) => d.get('token') as string).filter((t) => Expo.isExpoPushToken(t));
  const messages: ExpoPushMessage[] = tokens.map((to) => ({ to, sound: 'default', channelId: 'default', ...msg }));
  for (const chunk of expo.chunkPushNotifications(messages)) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    // Remove tokens the OS reports as dead.
    await Promise.all(
      tickets.map((t, i) => {
        if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
          const dead = (chunk[i] as { to: string }).to;
          return db.collection('pushTokens').doc(dead.replace(/\//g, '_')).delete();
        }
        return undefined;
      }),
    );
  }
}

/** Fires when a testimony is created or edited and is (newly) published. */
export const onTestimonyPublished = onDocumentWritten('testimonies/{id}', async (event) => {
  const after = event.data?.after;
  if (!after?.exists || after.get('isPublished') !== true) return;
  if (!(await claim(after.ref))) return;
  await broadcast('testimonies', {
    title: 'NEW TESTIMONY AVAILABLE',
    body: 'A new testimony has just been added to Testimonies of Praise.',
    data: { type: 'testimony', contentId: event.params.id },
  });
  await db.collection('notifications').add({
    title: 'NEW TESTIMONY AVAILABLE',
    message: 'A new testimony has just been added to Testimonies of Praise.',
    type: 'testimony',
    contentId: event.params.id,
    published: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});

/** Fires when the Admin Portal flips settings/live from offline to live. */
export const onLiveStarted = onDocumentWritten('settings/live', async (event) => {
  const before = event.data?.before?.get('isLive') === true;
  const after = event.data?.after?.get('isLive') === true;
  if (before || !after) return;
  await broadcast('live', {
    title: '🔴 WE ARE LIVE',
    body: (event.data?.after?.get('title') as string) || 'Join the live broadcast now.',
    data: { type: 'live' },
  });
});

/** Announcements / featured content: create a doc in `notifications` with type 'announcement' | 'featured'. */
export const onAnnouncement = onDocumentWritten('notifications/{id}', async (event) => {
  const after = event.data?.after;
  if (!after?.exists || after.get('published') !== true) return;
  const type = after.get('type');
  if (type !== 'announcement' && type !== 'featured') return; // testimony notifications are sent above
  if (!(await claim(after.ref))) return;
  await broadcast('announcements', {
    title: after.get('title'),
    body: after.get('message'),
    data: { type, contentId: after.get('contentId') },
  });
});
