import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  limit as qLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { commenterName, commentTextError, normalizeCommentText } from '../utils/commentText';
import type { CommentMediaType, TestimonyComment } from '../types';

/**
 * Website side of testimony comments. Same data model and rules as the mobile app (src/api/comments.ts):
 * testimonies/{id}/comments/{uid} and audioTestimonies/{id}/comments/{uid}; one comment per account per
 * item; every write batched with commentRate/{uid} (max one write per 15 s, enforced by the rules).
 */
const parent = (type: CommentMediaType) => (type === 'video' ? 'testimonies' : 'audioTestimonies');
const commentsCol = (type: CommentMediaType, id: string) => collection(db, parent(type), id, 'comments');
const commentRef = (type: CommentMediaType, id: string, uid: string) => doc(db, parent(type), id, 'comments', uid);

const iso = (v: unknown): string | null => {
  const t = v as { toDate?: () => Date } | null;
  return t && typeof t.toDate === 'function' ? t.toDate().toISOString() : null;
};

function toComment(id: string, d: Record<string, unknown>): TestimonyComment {
  return {
    id,
    uid: String(d.uid ?? id),
    displayName: commenterName(d.displayName as string),
    text: String(d.text ?? ''),
    mediaType: d.mediaType === 'audio' ? 'audio' : 'video',
    mediaId: String(d.mediaId ?? ''),
    status: d.status === 'hidden' ? 'hidden' : 'visible',
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

// Time of this device's last successful comment write: the rules allow one write per 15 s per account.
let lastWriteAt = 0;
const RATE_MS = 15_000;

/**
 * Turns a Firestore error into an honest message (and logs the real code). permission-denied on a
 * READ, or on a write more than 15 s after the last one, means the server's rules refused it, which
 * happens when the comment rules haven't been deployed to the Firebase project.
 */
const friendly = (e: unknown, action: string, write = false) => {
  const code = (e as { code?: string })?.code ?? 'unknown';
  console.warn(`[comments] ${action} failed: ${code}`, (e as Error)?.message);
  if (code === 'permission-denied') {
    if (write && Date.now() - lastWriteAt < RATE_MS) {
      return new Error(`You just posted. Wait ${Math.ceil((RATE_MS - (Date.now() - lastWriteAt)) / 1000)} seconds and try again.`);
    }
    return new Error(`Couldn't ${action}: the server refused access (permission-denied). Comments may not be switched on yet. Please try again later.`);
  }
  if (code === 'failed-precondition') return new Error(`Couldn't ${action}: the server is still preparing comments (missing index). Please try again later.`);
  if (code === 'unavailable' || code === 'deadline-exceeded') return new Error(`No connection: couldn't ${action}.`);
  return new Error(`Couldn't ${action} (${code}). Please try again.`);
};

export function subscribeComments(
  type: CommentMediaType,
  mediaId: string,
  max: number,
  cb: (items: TestimonyComment[], hasMore: boolean) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(commentsCol(type, mediaId), where('status', '==', 'visible'), orderBy('createdAt', 'desc'), qLimit(max + 1)),
    (snap) => cb(snap.docs.slice(0, max).map((d) => toComment(d.id, d.data())), snap.docs.length > max),
    (e) => onError(friendly(e, 'load comments')),
  );
}

export async function countComments(type: CommentMediaType, mediaId: string): Promise<number> {
  const snap = await getCountFromServer(query(commentsCol(type, mediaId), where('status', '==', 'visible')));
  return snap.data().count;
}

export async function getMyComment(type: CommentMediaType, mediaId: string, uid: string): Promise<TestimonyComment | null> {
  const snap = await getDoc(commentRef(type, mediaId, uid));
  return snap.exists() ? toComment(snap.id, snap.data()) : null;
}

export async function saveComment(input: {
  type: CommentMediaType;
  mediaId: string;
  mediaTitle: string;
  uid: string;
  displayName: string | null | undefined;
  text: string;
  existing: boolean;
}): Promise<void> {
  const problem = commentTextError(input.text);
  if (problem) throw new Error(problem);
  const text = normalizeCommentText(input.text);
  const displayName = commenterName(input.displayName);
  const batch = writeBatch(db);
  const ref = commentRef(input.type, input.mediaId, input.uid);
  if (input.existing) batch.update(ref, { text, displayName, updatedAt: serverTimestamp() });
  else
    batch.set(ref, {
      uid: input.uid,
      displayName,
      text,
      mediaType: input.type,
      mediaId: input.mediaId,
      mediaTitle: input.mediaTitle.slice(0, 200),
      status: 'visible',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  batch.set(doc(db, 'commentRate', input.uid), { lastAt: serverTimestamp() });
  if (Date.now() - lastWriteAt < RATE_MS) {
    throw new Error(`You just posted. Wait ${Math.ceil((RATE_MS - (Date.now() - lastWriteAt)) / 1000)} seconds and try again.`);
  }
  try {
    await batch.commit();
    lastWriteAt = Date.now();
  } catch (e) {
    throw friendly(e, input.existing ? 'update your comment' : 'post your comment', true);
  }
}

export async function deleteMyComment(type: CommentMediaType, mediaId: string, uid: string): Promise<void> {
  try {
    await deleteDoc(commentRef(type, mediaId, uid));
  } catch (e) {
    throw friendly(e, 'delete your comment');
  }
}
