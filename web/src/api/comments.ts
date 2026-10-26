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

const friendly = (e: unknown, action: string) => {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'permission-denied') return new Error(`Couldn't ${action}. If you just posted, wait 15 seconds and try again.`);
  if (code === 'unavailable' || code === 'deadline-exceeded') return new Error(`No connection: couldn't ${action}.`);
  return new Error(`Couldn't ${action}. Please try again.`);
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
  try {
    await batch.commit();
  } catch (e) {
    throw friendly(e, input.existing ? 'update your comment' : 'post your comment');
  }
}

export async function deleteMyComment(type: CommentMediaType, mediaId: string, uid: string): Promise<void> {
  try {
    await deleteDoc(commentRef(type, mediaId, uid));
  } catch (e) {
    throw friendly(e, 'delete your comment');
  }
}
