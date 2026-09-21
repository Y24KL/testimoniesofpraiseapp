/**
 * Push notifications for the Testimonies of Praise app.
 *
 * Delivery goes through Expo's push service, which forwards to FCM (Android) and APNs (iOS)
 * using the credentials you upload to EAS. The app stores one document per device in
 * `pushTokens/{token}`: { token, uid, platform, prefs: { testimonies, live, announcements } }.
 *
 * Duplicate protection: every source document is "claimed" once inside a transaction by writing
 * `pushSentAt`. Re-saves, retries and double triggers never send a second push.
 */
import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';

admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();

type PrefKey = 'testimonies' | 'live' | 'announcements';

/** Returns true exactly once per document. */
async function claim(ref: FirebaseFirestore.DocumentReference): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.get('pushSentAt')) return false;
    tx.update(ref, { pushSentAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
}

const tokenDocId = (t: string) => t.replace(/\//g, '_');

async function broadcast(pref: PrefKey, msg: Omit<ExpoPushMessage, 'to'>) {
  const snap = await db.collection('pushTokens').where(`prefs.${pref}`, '==', true).get();
  const tokens = snap.docs.map((d) => d.get('token') as string).filter((t) => Expo.isExpoPushToken(t));
  const messages: ExpoPushMessage[] = tokens.map((to) => ({ to, sound: 'default', channelId: 'default', ...msg }));

  for (const chunk of expo.chunkPushNotifications(messages)) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    await Promise.all(
      tickets.map((t, i) => {
        if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
          const dead = (chunk[i] as { to: string }).to;
          return db.collection('pushTokens').doc(tokenDocId(dead)).delete();
        }
        return undefined;
      }),
    );
  }
}

const feed = (data: { title: string; message: string; type: string; contentId?: string }) =>
  db.collection('notifications').add({
    ...data,
    published: true,
    skipPush: true, // this feed entry is informational; the push is sent by the function itself
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

/** A testimony became (or is) published: notify once, unless the admin turned notifications off. */
export const onTestimonyWritten = onDocumentWritten('testimonies/{id}', async (event) => {
  const after = event.data?.after;
  if (!after?.exists || after.get('isPublished') !== true) return;
  if (after.get('notifyOnPublish') === false || after.get('pushSentAt')) return;
  if (!(await claim(after.ref))) return;

  const title = 'NEW TESTIMONY AVAILABLE';
  const message = 'A new testimony has just been added to Testimonies of Praise.';
  await broadcast('testimonies', { title, body: message, data: { type: 'testimony', contentId: event.params.id } });
  await feed({ title, message, type: 'testimony', contentId: event.params.id });
});

/** The admin flipped the stream from offline to live. */
export const onLiveChanged = onDocumentWritten('settings/live', async (event) => {
  const wasLive = event.data?.before?.get('isLive') === true;
  const after = event.data?.after;
  if (wasLive || !after?.exists || after.get('isLive') !== true) return;
  if (after.get('notifyOnStart') === false) return;

  const title = 'WE ARE LIVE';
  const message = (after.get('title') as string) || 'Join the live broadcast now.';
  await broadcast('live', { title, body: message, data: { type: 'live' } });
  await feed({ title, message, type: 'live' });
});

/** Announcements and featured content created from the admin portal. */
export const onAnnouncementCreated = onDocumentWritten('notifications/{id}', async (event) => {
  const after = event.data?.after;
  if (!after?.exists || after.get('published') !== true) return;
  const type = after.get('type');
  if (type !== 'announcement' && type !== 'featured') return;
  if (after.get('skipPush') === true) return;
  if (!(await claim(after.ref))) return;

  await broadcast('announcements', {
    title: after.get('title') as string,
    body: after.get('message') as string,
    data: { type, contentId: after.get('contentId') ?? undefined },
  });
});
