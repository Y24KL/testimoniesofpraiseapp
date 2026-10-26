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
import { CONFIG } from '@/constants/config';
import { AppError } from '@/utils/errors';
import { commenterName, commentTextError, normalizeCommentText } from '@/utils/commentText';
import type { CommentMediaType, TestimonyComment } from '@/types';

/**
 * Comments on video testimonies (testimonies/{id}/comments/{uid}) and audio testimonies
 * (audioTestimonies/{id}/comments/{uid}). The document id is the commenter's Firebase UID, so each
 * account has at most one comment per item (posting again edits it). Every write is batched with
 * commentRate/{uid}, which the Firestore rules accept at most once every 15 seconds.
 * Comments always use Firestore (also in REST backend mode, where they are reported as unavailable,
 * because the rules check the parent Firestore document is published).
 */
export const commentsAvailable = CONFIG.backendMode === 'firestore';

const parentCollection = (type: CommentMediaType) => (type === 'video' ? CONFIG.collections.testimonies : CONFIG.collections.audioTestimonies);
const commentsCol = (type: CommentMediaType, mediaId: string) => collection(db, parentCollection(type), mediaId, 'comments');
const commentRef = (type: CommentMediaType, mediaId: string, uid: string) => doc(db, parentCollection(type), mediaId, 'comments', uid);

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
  if (code === 'permission-denied') {
    return new AppError('permission', `Couldn't ${action}. If you just posted, wait 15 seconds and try again.`);
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') return new AppError('network', `No connection: couldn't ${action}.`);
  return new AppError('unknown', `Couldn't ${action}. Please try again.`);
};

/** Live list of visible comments, newest first. Returns an unsubscribe function. */
export function subscribeComments(
  type: CommentMediaType,
  mediaId: string,
  max: number,
  cb: (items: TestimonyComment[], hasMore: boolean) => void,
  onError: (e: AppError) => void,
): () => void {
  if (!commentsAvailable) {
    onError(new AppError('unknown', 'Comments are not available in this build.'));
    return () => {};
  }
  return onSnapshot(
    query(commentsCol(type, mediaId), where('status', '==', 'visible'), orderBy('createdAt', 'desc'), qLimit(max + 1)),
    (snap) => {
      const docs = snap.docs.slice(0, max).map((d) => toComment(d.id, d.data()));
      cb(docs, snap.docs.length > max);
    },
    (e) => onError(friendly(e, 'load comments')),
  );
}

/** Number of visible comments actually stored for this item. */
export async function countComments(type: CommentMediaType, mediaId: string): Promise<number> {
  if (!commentsAvailable) return 0;
  const snap = await getCountFromServer(query(commentsCol(type, mediaId), where('status', '==', 'visible')));
  return snap.data().count;
}

/** The signed-in user's own comment on this item (also when hidden by a moderator), or null. */
export async function getMyComment(type: CommentMediaType, mediaId: string, uid: string): Promise<TestimonyComment | null> {
  if (!commentsAvailable) return null;
  const snap = await getDoc(commentRef(type, mediaId, uid));
  return snap.exists() ? toComment(snap.id, snap.data()) : null;
}

/** Creates the user's comment, or edits it when one already exists. */
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
  if (problem) throw new AppError('unknown', problem);
  const text = normalizeCommentText(input.text);
  const displayName = commenterName(input.displayName);
  const batch = writeBatch(db);
  const ref = commentRef(input.type, input.mediaId, input.uid);
  if (input.existing) {
    batch.update(ref, { text, displayName, updatedAt: serverTimestamp() });
  } else {
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
  }
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
