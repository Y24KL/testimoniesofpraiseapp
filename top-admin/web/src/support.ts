/**
 * User Communication & Support (admin side). Sending goes through the Worker (admin check, idempotent write,
 * push); reading, resolving and read receipts use Firestore directly under the rules in firestore.rules.
 */
import {
  collection, doc, documentId, getDoc, getDocs, limit, orderBy, query, serverTimestamp, startAt, endAt, updateDoc, where, type Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export type SupportCategory = 'choir_request' | 'sponsorship' | 'testimony' | 'written_testimony' | 'feedback' | 'report' | 'comment' | 'account' | 'general';
export type RelatedType = 'choir_request' | 'sponsorship' | 'testimony_submission' | 'written_testimony' | 'feedback' | 'report' | 'comment';
export type ThreadStatus = 'awaiting_user' | 'awaiting_admin' | 'resolved';

export const CATEGORY_LABELS: Record<SupportCategory, string> = {
  choir_request: 'Choir request',
  sponsorship: 'Sponsorship',
  testimony: 'Testimony submission',
  written_testimony: 'Written testimony',
  feedback: 'Feedback',
  report: 'Content report',
  comment: 'Comment',
  account: 'Account assistance',
  general: 'General enquiry',
};

/** In-app screens an action button may open (first segment must match the Worker's ACTION_ROUTES). */
export const ACTION_DESTINATIONS: { route: string; label: string }[] = [
  { route: 'choir', label: 'Choir feature request form' },
  { route: 'sponsor', label: 'Sponsorship page' },
  { route: 'share', label: 'Share a testimony' },
  { route: 'profile', label: 'Profile' },
  { route: 'feedback', label: 'Feedback & suggestions' },
  { route: 'notifications', label: 'Notifications' },
  { route: 'live', label: 'Live' },
];

export interface Related { type: RelatedType; id: string; label?: string }
export interface MessageAction { label: string; route?: string; url?: string }

export interface Thread {
  id: string;
  uid: string;
  subject: string;
  category: SupportCategory;
  related?: Related | null;
  status: ThreadStatus;
  lastMessageAt?: Timestamp;
  lastMessagePreview?: string;
  lastSender?: 'admin' | 'user';
  unreadForUser?: number;
  unreadForAdmin?: number;
  messageCount?: number;
  correction?: { state: 'requested' | 'received'; at?: Timestamp } | null;
}

export interface Message {
  id: string;
  senderType: 'admin' | 'user';
  senderUid: string;
  body: string;
  action?: MessageAction;
  createdAt?: Timestamp;
  readAt?: Timestamp | null;
  delivery?: { status: string; campaignId?: string };
}

export interface UserCard {
  uid: string;
  fullName?: string;
  title?: string;
  church?: string;
  zone?: string;
  email?: string | null;
  lastSignInAt?: number | null;
}

const WORKER_URL = (import.meta.env.VITE_WORKER_URL || import.meta.env.VITE_PUSH_URL || 'https://top-push-relay.gtrusouth116.workers.dev').replace(/\/$/, '');

async function worker<T>(path: string, body: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You are signed out.');
  const res = await fetch(`${WORKER_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `Request failed (${res.status}).`);
  return j as T;
}

/** A fresh idempotency key for one send (a retry of the same send reuses it). */
export function newMessageKey(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return `m_${Date.now().toString(36)}_${Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')}`.slice(0, 64);
}

export interface SendInput {
  uid: string;
  clientMessageId: string;
  threadId?: string;
  subject?: string;
  category?: SupportCategory;
  related?: Related | null;
  body: string;
  action?: MessageAction | null;
}

export function sendMessage(input: SendInput) {
  return worker<{ threadId: string; messageId: string; created: boolean; duplicate: boolean; pushed: number; inApp: number }>('/api/support/send', {
    ...input,
    action: input.action ?? undefined,
  });
}

/** Firebase Auth details (email, last sign-in) for up to 50 users; never stored in Firestore. */
export async function authDetails(uids: string[]): Promise<Map<string, { email: string | null; lastSignInAt: number | null }>> {
  if (!uids.length) return new Map();
  const { users } = await worker<{ users: { uid: string; email: string | null; lastSignInAt: number | null }[] }>('/api/support/users', { uids });
  return new Map(users.map((u) => [u.uid, { email: u.email, lastSignInAt: u.lastSignInAt }]));
}

function cardFrom(uid: string, d: Record<string, unknown> | undefined): UserCard {
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  return { uid, fullName: s(d?.fullName), title: s(d?.title), church: s(d?.church), zone: s(d?.zone) };
}

export async function getUserCard(uid: string): Promise<UserCard> {
  const snap = await getDoc(doc(db, 'users', uid));
  return cardFrom(uid, snap.exists() ? snap.data() : undefined);
}

/**
 * Finds users without downloading the directory: an exact user id, an email (via the Worker), or a prefix
 * of the full name, church or zone (as typed and in title case). At most 20 results.
 */
export async function searchUsers(raw: string): Promise<UserCard[]> {
  const q = raw.trim();
  if (q.length < 2) return [];
  const out = new Map<string, UserCard>();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) {
    const { users } = await worker<{ users: { uid: string; email: string | null; lastSignInAt: number | null }[] }>('/api/support/users', { email: q });
    for (const u of users) out.set(u.uid, { ...(await getUserCard(u.uid)), email: u.email, lastSignInAt: u.lastSignInAt });
    return [...out.values()];
  }
  if (/^[A-Za-z0-9_-]{20,128}$/.test(q)) {
    const snap = await getDoc(doc(db, 'users', q));
    if (snap.exists()) out.set(q, cardFrom(q, snap.data()));
  }
  const variants = [...new Set([q, q.replace(/\b\p{L}/gu, (c) => c.toUpperCase())])];
  const fields = ['fullName', 'church', 'zone'];
  const snaps = await Promise.all(
    fields.flatMap((f) => variants.map((v) => getDocs(query(collection(db, 'users'), orderBy(f), startAt(v), endAt(`${v}`), limit(10))).catch(() => null))),
  );
  for (const s of snaps) s?.docs.forEach((d) => out.size < 20 && out.set(d.id, cardFrom(d.id, d.data())));
  return [...out.values()];
}

/** Several user cards at once (for conversation lists), 30 per query. */
export async function getUserCards(uids: string[]): Promise<Map<string, UserCard>> {
  const out = new Map<string, UserCard>();
  const unique = [...new Set(uids)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 30) {
    const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', unique.slice(i, i + 30))));
    snap.docs.forEach((d) => out.set(d.id, cardFrom(d.id, d.data())));
  }
  return out;
}

export function displayName(u?: UserCard | null): string {
  if (!u) return 'Unknown user';
  return [u.title, u.fullName].filter(Boolean).join(' ') || u.email || `User ${u.uid.slice(0, 6)}…`;
}

export async function setThreadStatus(t: Thread, status: ThreadStatus) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You are signed out.');
  await updateDoc(doc(db, 'supportThreads', t.id), {
    status,
    updatedAt: serverTimestamp(),
    ...(status === 'resolved' ? { resolvedAt: serverTimestamp(), resolvedBy: uid } : {}),
  });
}

/** Marks the user's messages read and clears the admin unread count. */
export async function markThreadReadByAdmin(t: Thread, messages: Message[]) {
  await Promise.all(
    messages.filter((m) => m.senderType === 'user' && !m.readAt).map((m) => updateDoc(doc(db, 'supportThreads', t.id, 'messages', m.id), { readAt: serverTimestamp() }).catch(() => undefined)),
  );
  if ((t.unreadForAdmin ?? 0) > 0) await updateDoc(doc(db, 'supportThreads', t.id), { unreadForAdmin: 0 }).catch(() => undefined);
}
