import { useCallback, useEffect, useState } from 'react';
import {
  collectionGroup,
  deleteDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type DocumentReference,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { fmtDate } from '../lib';
import type { Route } from '../types';
import { Message } from '../components/Field';

/**
 * Comments people post on video testimonies (testimonies/{id}/comments/{uid}) and audio testimonies
 * (audioTestimonies/{id}/comments/{uid}). Read with a collection-group query; the Firestore rules let
 * only admins run it. Hide/restore sets status + moderatedBy/moderatedAt; delete removes the comment.
 */
type MediaType = 'video' | 'audio';
type StatusFilter = 'all' | 'visible' | 'hidden';
interface Row {
  ref: DocumentReference;
  id: string;
  uid: string;
  displayName: string;
  text: string;
  mediaType: MediaType;
  mediaId: string;
  mediaTitle: string;
  status: 'visible' | 'hidden';
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  moderatedAt: Timestamp | null;
}

const PAGE = 50;
const SITE = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? '').trim().replace(/\/+$/, '');

function toRow(d: QueryDocumentSnapshot): Row {
  const x = d.data();
  // Path is {testimonies|audioTestimonies}/{mediaId}/comments/{uid}: the parent is the source of truth.
  const parent = d.ref.parent.parent;
  const mediaType: MediaType = parent?.parent.id === 'audioTestimonies' ? 'audio' : 'video';
  return {
    ref: d.ref,
    id: d.id,
    uid: String(x.uid ?? d.id),
    displayName: String(x.displayName ?? 'Member'),
    text: String(x.text ?? ''),
    mediaType,
    mediaId: parent?.id ?? String(x.mediaId ?? ''),
    mediaTitle: String(x.mediaTitle ?? ''),
    status: x.status === 'hidden' ? 'hidden' : 'visible',
    createdAt: (x.createdAt as Timestamp) ?? null,
    updatedAt: (x.updatedAt as Timestamp) ?? null,
    moderatedAt: (x.moderatedAt as Timestamp) ?? null,
  };
}

const friendly = (e: unknown) => {
  const m = (e as Error)?.message ?? String(e);
  if (/index/i.test(m)) return `This filter needs a Firestore index that isn't deployed yet. Deploy firebase.indexes.json (${m})`;
  if (/permission/i.test(m)) return 'Permission denied. Make sure your account is in admins/{uid} and the latest Firestore rules are deployed.';
  return m;
};

export function Comments({ go }: { go: (r: Route) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [type, setType] = useState<'all' | MediaType>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [mediaId, setMediaId] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(
    async (after: QueryDocumentSnapshot | null) => {
      setLoading(true);
      setErr('');
      try {
        const c: QueryConstraint[] = [];
        const item = mediaId.trim();
        if (item) c.push(where('mediaId', '==', item));
        else if (type !== 'all') c.push(where('mediaType', '==', type));
        if (status !== 'all') c.push(where('status', '==', status));
        c.push(orderBy('createdAt', newestFirst ? 'desc' : 'asc'));
        if (after) c.push(startAfter(after));
        c.push(limit(PAGE));
        const snap = await getDocs(query(collectionGroup(db, 'comments'), ...c));
        const page = snap.docs.map(toRow).filter((r) => !item || type === 'all' || r.mediaType === type);
        setRows((cur) => (after ? [...(cur ?? []), ...page] : page));
        setCursor(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.docs.length === PAGE);
      } catch (e) {
        setErr(friendly(e));
        if (!after) setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [type, status, mediaId, newestFirst],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const moderate = async (r: Row, next: Row['status']) => {
    setBusyId(r.ref.path);
    setErr('');
    setOk('');
    try {
      await updateDoc(r.ref, { status: next, moderatedBy: auth.currentUser?.uid ?? '', moderatedAt: serverTimestamp() });
      setRows((cur) => (cur ?? []).map((x) => (x.ref.path === r.ref.path ? { ...x, status: next } : x)));
      setOk(next === 'hidden' ? `Hidden. ${r.displayName}'s comment is no longer shown in the app or on the website.` : `Restored. ${r.displayName}'s comment is visible again.`);
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusyId('');
    }
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete this comment by ${r.displayName}?\n\n"${r.text.slice(0, 140)}${r.text.length > 140 ? '…' : ''}"\n\nThis can't be undone. (Hide it instead if you may want it back.)`)) return;
    setBusyId(r.ref.path);
    setErr('');
    setOk('');
    try {
      await deleteDoc(r.ref);
      setRows((cur) => (cur ?? []).filter((x) => x.ref.path !== r.ref.path));
      setOk('Comment deleted.');
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusyId('');
    }
  };

  const q = search.trim().toLowerCase();
  const shown = (rows ?? []).filter((r) => !q || [r.text, r.displayName, r.uid, r.mediaTitle, r.mediaId].some((v) => v.toLowerCase().includes(q)));
  const siteLink = (r: Row) => (SITE ? `${SITE}/#/${r.mediaType === 'audio' ? 'audio' : 'testimony'}/${encodeURIComponent(r.mediaId)}` : '');

  return (
    <>
      <h1>Comments</h1>
      <p className="muted">
        Comments on video and audio testimonies from the app and the website. Each account can leave one comment per testimony. Hiding removes a comment from public view (the author still sees it, marked as hidden); deleting removes it for good.
      </p>

      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="f" style={{ marginBottom: 0, flex: '2 1 220px' }}>
            <span>Search loaded comments</span>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Text, name, user ID or media title" />
          </label>
          <label className="f" style={{ marginBottom: 0, flex: '1 1 130px' }}>
            <span>Media type</span>
            <select value={type} onChange={(e) => setType(e.target.value as 'all' | MediaType)}>
              <option value="all">All</option>
              <option value="video">Video testimonies</option>
              <option value="audio">Audio testimonies</option>
            </select>
          </label>
          <label className="f" style={{ marginBottom: 0, flex: '1 1 120px' }}>
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="all">All</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
          <label className="f" style={{ marginBottom: 0, flex: '1 1 120px' }}>
            <span>Sort</span>
            <select value={newestFirst ? 'new' : 'old'} onChange={(e) => setNewestFirst(e.target.value === 'new')}>
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
            </select>
          </label>
          <label className="f" style={{ marginBottom: 0, flex: '1 1 180px' }}>
            <span>Media item ID</span>
            <input type="text" value={mediaId} onChange={(e) => setMediaId(e.target.value)} placeholder="Any item" />
          </label>
          <button className="btn small ghost" onClick={() => void load(null)} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
        {mediaId.trim() ? (
          <div className="small muted" style={{ marginTop: 8 }}>
            Showing one item. <button className="btn small ghost" onClick={() => setMediaId('')}>Show all items</button>
          </div>
        ) : null}
        {q ? <div className="small muted" style={{ marginTop: 8 }}>Search covers the {rows?.length ?? 0} comments loaded so far. Load more to search further back.</div> : null}
      </div>

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      {rows === null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="card muted">{rows.length === 0 ? 'No comments match these filters yet.' : 'No loaded comments match your search.'}</div>
      ) : (
        shown.map((r) => {
          const busy = busyId === r.ref.path;
          const link = siteLink(r);
          return (
            <div className="card" key={r.ref.path} style={r.status === 'hidden' ? { opacity: 0.75 } : undefined}>
              <div className="row between">
                <div style={{ minWidth: 0 }}>
                  <b>{r.displayName}</b> <span className="small muted">· user ID <code>{r.uid}</code></span>
                  <div className="small muted">
                    {fmtDate(r.createdAt)}
                    {r.updatedAt && r.createdAt && r.updatedAt.toMillis() - r.createdAt.toMillis() > 1000 ? ` · edited ${fmtDate(r.updatedAt)}` : ''}
                    {r.status === 'hidden' && r.moderatedAt ? ` · hidden ${fmtDate(r.moderatedAt)}` : ''}
                  </div>
                </div>
                <span className={`pill ${r.status === 'visible' ? 'ok' : 'bad'}`}>{r.status.toUpperCase()}</span>
              </div>
              <div className="quote" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.text}</div>
              <div className="small muted" style={{ marginBottom: 10 }}>
                On {r.mediaType === 'audio' ? 'audio' : 'video'} testimony: <b style={{ color: 'var(--text)' }}>{r.mediaTitle || '(untitled)'}</b> · ID <code>{r.mediaId}</code>
              </div>
              <div className="row">
                {r.status === 'visible' ? (
                  <button className="btn small ghost" disabled={busy} onClick={() => void moderate(r, 'hidden')}>Hide</button>
                ) : (
                  <button className="btn small" disabled={busy} onClick={() => void moderate(r, 'visible')}>Restore</button>
                )}
                <button className="btn small danger" disabled={busy} onClick={() => void remove(r)}>Delete</button>
                {!mediaId.trim() ? <button className="btn small ghost" onClick={() => setMediaId(r.mediaId)}>All comments on this item</button> : null}
                {r.mediaType === 'video' ? <button className="btn small ghost" onClick={() => go({ name: 'editor', id: r.mediaId })}>Open testimony</button> : null}
                {link ? <a className="btn small ghost" href={link} target="_blank" rel="noreferrer">View on website ↗</a> : null}
              </div>
            </div>
          );
        })
      )}

      {hasMore && rows && rows.length > 0 ? (
        <button className="btn ghost" disabled={loading} onClick={() => void load(cursor)}>{loading ? 'Loading…' : `Load ${PAGE} more`}</button>
      ) : null}
    </>
  );
}
