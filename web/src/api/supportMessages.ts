/**
 * Private messages from the T.O.P support team (supportThreads). The person reads only their own
 * conversations, replies as themselves, and marks admin messages read; Firestore rules enforce all of it.
 * Admin messages are written by the server, never by the app.
 */
import {
  collection, doc, increment, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch, type Timestamp, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export type ThreadStatus = 'awaiting_user' | 'awaiting_admin' | 'resolved';

export interface SupportThread {
  id: string;
  subject: string;
  category: string;
  related?: { type: string; id: string; label?: string } | null;
  status: ThreadStatus;
  lastMessageAt: number;
  lastMessagePreview: string;
  lastSender: 'admin' | 'user';
  unreadForUser: number;
}

export interface SupportMessage {
  id: string;
  senderType: 'admin' | 'user';
  body: string;
  action?: { label: string; route?: string; url?: string } | null;
  createdAt: number;
  readAt: number | null;
}

export const MAX_REPLY = 2000;
const ms = (v: unknown) => ((v as Timestamp | undefined)?.toMillis?.() ?? 0);
const str = (v: unknown, n = 500) => (typeof v === 'string' ? v.slice(0, n) : '');

export const CATEGORY_LABELS: Record<string, string> = {
  choir_request: 'Choir request',
  sponsorship: 'Sponsorship',
  testimony: 'Testimony',
  written_testimony: 'Written testimony',
  feedback: 'Feedback',
  report: 'Report',
  comment: 'Comment',
  account: 'Your account',
  general: 'General',
};

export function subscribeThreads(uid: string, next: (t: SupportThread[]) => void, fail: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'supportThreads'), where('uid', '==', uid), orderBy('lastMessageAt', 'desc'), limit(100)),
    (s) =>
      next(
        s.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id,
            subject: str(v.subject, 120) || 'Message',
            category: str(v.category, 40),
            related: v.related ?? null,
            status: v.status === 'resolved' || v.status === 'awaiting_admin' ? v.status : 'awaiting_user',
            lastMessageAt: ms(v.lastMessageAt),
            lastMessagePreview: str(v.lastMessagePreview, 140),
            lastSender: v.lastSender === 'user' ? 'user' : 'admin',
            unreadForUser: Number(v.unreadForUser) || 0,
          };
        }),
      ),
    fail,
  );
}

export function subscribeThread(threadId: string, next: (t: SupportThread | null) => void, fail: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'supportThreads', threadId),
    (d) => {
      if (!d.exists()) return next(null);
      const v = d.data();
      next({
        id: d.id,
        subject: str(v.subject, 120) || 'Message',
        category: str(v.category, 40),
        related: v.related ?? null,
        status: v.status === 'resolved' || v.status === 'awaiting_admin' ? v.status : 'awaiting_user',
        lastMessageAt: ms(v.lastMessageAt),
        lastMessagePreview: str(v.lastMessagePreview, 140),
        lastSender: v.lastSender === 'user' ? 'user' : 'admin',
        unreadForUser: Number(v.unreadForUser) || 0,
      });
    },
    fail,
  );
}

export function subscribeMessages(threadId: string, next: (m: SupportMessage[]) => void, fail: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'supportThreads', threadId, 'messages'), orderBy('createdAt', 'asc'), limit(300)),
    (s) =>
      next(
        s.docs.map((d) => {
          const v = d.data();
          const a = v.action;
          return {
            id: d.id,
            senderType: v.senderType === 'user' ? 'user' : 'admin',
            body: str(v.body, 4000),
            action: a && typeof a.label === 'string' ? { label: str(a.label, 40), route: typeof a.route === 'string' ? a.route : undefined, url: typeof a.url === 'string' ? a.url : undefined } : null,
            createdAt: ms(v.createdAt) || Date.now(),
            readAt: v.readAt ? ms(v.readAt) : null,
          };
        }),
      ),
    fail,
  );
}

/** Sends a reply as the signed-in person: the message and the conversation update in one batch. */
export async function sendReply(threadId: string, uid: string, body: string): Promise<void> {
  const text = body.replace(/\r\n/g, '\n').trim().slice(0, MAX_REPLY);
  if (!text) return;
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'supportThreads', threadId, 'messages')), { senderType: 'user', senderUid: uid, body: text, createdAt: serverTimestamp(), readAt: null });
  batch.update(doc(db, 'supportThreads', threadId), {
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastSender: 'user',
    status: 'awaiting_admin',
    lastMessagePreview: text.replace(/\s+/g, ' ').slice(0, 140),
    unreadForAdmin: increment(1),
    messageCount: increment(1),
  });
  await batch.commit();
}

/** Marks the team's unread messages read and clears this conversation's unread count. */
export async function markRead(thread: SupportThread, messages: SupportMessage[]): Promise<void> {
  const unread = messages.filter((m) => m.senderType === 'admin' && !m.readAt);
  await Promise.all(unread.map((m) => updateDoc(doc(db, 'supportThreads', thread.id, 'messages', m.id), { readAt: serverTimestamp() }).catch(() => undefined)));
  if (thread.unreadForUser > 0) await updateDoc(doc(db, 'supportThreads', thread.id), { unreadForUser: 0 }).catch(() => undefined);
}
