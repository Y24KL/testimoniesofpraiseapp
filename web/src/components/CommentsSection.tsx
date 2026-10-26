import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { countComments, deleteMyComment, getMyComment, saveComment, subscribeComments } from '../api/comments';
import { useAuth } from '../context/AuthContext';
import type { CommentMediaType, TestimonyComment } from '../types';
import { MAX_COMMENT_LENGTH, commentTextError, normalizeCommentText } from '../utils/commentText';
import { formatDate } from '../utils/format';

const PAGE = 20;

function relative(iso: string | null): string {
  if (!iso) return 'just now';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return formatDate(iso);
}
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || 'M';

/** Comments for ONE video or audio testimony (same rules and data as the mobile app). */
export function CommentsSection({ type, mediaId, mediaTitle }: { type: CommentMediaType; mediaId: string; mediaTitle: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<TestimonyComment[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [max, setMax] = useState(PAGE);
  const [count, setCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mine, setMine] = useState<TestimonyComment | null>(null);
  const [mineLoaded, setMineLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const submitting = useRef(false);

  const refreshCount = useCallback(() => {
    countComments(type, mediaId).then(setCount).catch(() => undefined);
  }, [type, mediaId]);
  const refreshMine = useCallback(async () => {
    if (!user) return;
    try {
      setMine(await getMyComment(type, mediaId, user.uid));
    } catch {
      /* composer falls back to "new comment" */
    } finally {
      setMineLoaded(true);
    }
  }, [type, mediaId, user]);

  useEffect(
    () =>
      subscribeComments(
        type,
        mediaId,
        max,
        (list, more) => {
          setItems(list);
          setHasMore(more);
          setLoadError(null);
        },
        (e) => {
          setLoadError(e.message);
          setItems((cur) => cur ?? []);
        },
      ),
    [type, mediaId, max],
  );
  useEffect(() => refreshCount(), [refreshCount, items?.length]);
  useEffect(() => {
    setMine(null);
    setMineLoaded(!user);
    void refreshMine();
  }, [refreshMine, user]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || submitting.current) return;
    const problem = commentTextError(text);
    if (problem) return setFormError(problem);
    submitting.current = true;
    setBusy(true);
    setFormError(null);
    try {
      await saveComment({ type, mediaId, mediaTitle, uid: user.uid, displayName: user.displayName, text, existing: Boolean(mine) });
      setNotice(mine ? 'Your comment was updated.' : 'Thank you! Your comment is posted.');
      setText('');
      setEditing(false);
      await refreshMine();
      refreshCount();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!user || !window.confirm('Delete your comment? This removes it for everyone.')) return;
    try {
      await deleteMyComment(type, mediaId, user.uid);
      setMine(null);
      setNotice('Your comment was deleted.');
      refreshCount();
    } catch (err) {
      setFormError((err as Error).message);
    }
  };

  const others = (items ?? []).filter((c) => c.uid !== user?.uid);
  const left = MAX_COMMENT_LENGTH - normalizeCommentText(text).length;
  const showComposer = Boolean(user) && mineLoaded && (!mine || editing);

  return (
    <section className="comments" aria-labelledby={`comments-${mediaId}`}>
      <div className="comments-head">
        <h2 id={`comments-${mediaId}`}>Comments</h2>
        <span className="comments-count" aria-label={`${count ?? 0} comments`}>
          <MessageCircle size={14} /> {count === null ? '…' : count}
        </span>
      </div>

      {!user ? (
        <p className="comments-muted">Sign in to join the conversation.</p>
      ) : (
        <>
          {mine && !editing ? (
            <article className="comment mine">
              <div className="comment-top">
                <b>Your comment</b>
                <time>{relative(mine.updatedAt ?? mine.createdAt)}</time>
              </div>
              <p>{mine.text}</p>
              {mine.status === 'hidden' ? <p className="comment-hidden">Hidden by a moderator: only you can see it.</p> : null}
              <div className="comment-actions">
                <button type="button" className="link-btn" onClick={() => { setText(mine.text); setEditing(true); setNotice(null); }}>
                  Edit
                </button>
                <button type="button" className="link-btn" style={{ color: 'var(--danger)' }} onClick={remove}>
                  Delete
                </button>
              </div>
            </article>
          ) : null}
          {showComposer ? (
            <form className="comment-form" onSubmit={submit}>
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder={mine ? 'Edit your comment' : 'Share how this testimony blessed you…'}
                maxLength={MAX_COMMENT_LENGTH + 50}
                rows={3}
                disabled={busy}
                aria-label="Comment text"
              />
              <div className="comment-form-row">
                <span className={left < 0 ? 'comments-error' : 'comments-muted'}>{left} left</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {editing ? (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(false)} disabled={busy}>
                      Cancel
                    </button>
                  ) : null}
                  <button type="submit" className="btn btn-gold btn-sm" disabled={busy || !normalizeCommentText(text)} aria-busy={busy}>
                    {busy ? <span className="spinner" /> : null}
                    {mine ? 'Update' : 'Post'}
                  </button>
                </div>
              </div>
              <span className="comments-muted">One comment per person on each testimony. You can edit it later.</span>
            </form>
          ) : null}
          {formError ? (
            <p className="comments-error" role="alert">
              {formError}
            </p>
          ) : null}
          {notice && !formError ? <p className="comments-notice">{notice}</p> : null}
        </>
      )}

      {items === null ? (
        <div className="skeleton" style={{ height: 64 }} aria-hidden="true" />
      ) : loadError ? (
        <p className="comments-error">{loadError}</p>
      ) : others.length === 0 ? (
        <p className="comments-muted">{mine ? 'No other comments yet.' : 'No comments yet. Be the first to share.'}</p>
      ) : (
        others.map((c) => (
          <article key={c.id} className="comment">
            <div className="comment-top">
              <span className="comment-avatar" aria-hidden="true">
                {initials(c.displayName)}
              </span>
              <b>{c.displayName}</b>
              <time dateTime={c.createdAt ?? undefined}>{relative(c.createdAt)}</time>
            </div>
            <p>{c.text}</p>
          </article>
        ))
      )}
      {hasMore ? (
        <button type="button" className="link-btn" onClick={() => setMax((m) => m + PAGE)}>
          Show more comments
        </button>
      ) : null}
    </section>
  );
}
