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
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/feedback';
import { EmptyState, GlassCard, LoadingList, PageHeader, SearchInput, StatusBadge } from '../components/ui';

/**
 * Comments people post on video testimonies (testimonies/{id}/comments/{uid}), audio testimonies
 * (audioTestimonies/{id}/comments/{uid}) and written testimonies (writtenTestimonies/{id}/comments/{uid}). Read with a collection-group query; the Firestore rules let
 * only admins run it. Hide/restore sets status + moderatedBy/moderatedAt; delete removes the comment.
 */
type MediaType = 'video' | 'audio' | 'written';
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
  const col = parent?.parent.id;
  const mediaType: MediaType = col === 'audioTestimonies' ? 'audio' : col === 'writtenTestimonies' ? 'written' : 'video';
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
  const confirm = useConfirm();

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
    const yes = await confirm({
      title: `Delete this comment by ${r.displayName}?`,
      message: (
        <>
          <span className="quote" style={{ display: 'block', whiteSpace: 'pre-wrap' }}>“{r.text.slice(0, 140)}{r.text.length > 140 ? '…' : ''}”</span>
          This can’t be undone. Hide it instead if you may want it back.
        </>
      ),
      confirmLabel: 'Delete comment',
      danger: true,
    });
    if (!yes) return;
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
  const siteLink = (r: Row) => (SITE ? `${SITE}/#/${r.mediaType === 'audio' ? 'audio' : r.mediaType === 'written' ? 'written' : 'testimony'}/${encodeURIComponent(r.mediaId)}` : '');

  return (
    <>
      <PageHeader
        eyebrow="Community Management"
        title="Comments Moderation"
        sub="Comments on video, audio and written testimonies from the app and the website. Each account can leave one comment per testimony. Hiding removes a comment from public view (the author still sees it, marked as hidden); deleting removes it for good."
        actions={
          <button type="button" className="btn ghost" onClick={() => void load(null)} disabled={loading}>
            <Icon name="refresh" size={16} className={loading ? 'spinning' : undefined} />{loading ? 'Loading…' : 'Refresh'}
          </button>
        }
      />

      <GlassCard className="filter-card">
        <SearchInput value={search} onChange={setSearch} placeholder="Search loaded comments: text, name, user ID or media title…" label="Search loaded comments" />
        <div className="filter-grid">
          <label className="f">
            <span>Media type</span>
            <select value={type} onChange={(e) => setType(e.target.value as 'all' | MediaType)}>
              <option value="all">All</option>
              <option value="video">Video testimonies</option>
              <option value="audio">Audio testimonies</option>
              <option value="written">Written testimonies</option>
            </select>
          </label>
          <label className="f">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="all">All</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
          <label className="f">
            <span>Sort</span>
            <select value={newestFirst ? 'new' : 'old'} onChange={(e) => setNewestFirst(e.target.value === 'new')}>
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
            </select>
          </label>
          <label className="f">
            <span>Media item ID</span>
            <input type="text" value={mediaId} onChange={(e) => setMediaId(e.target.value)} placeholder="Any item" />
          </label>
        </div>
        {mediaId.trim() ? (
          <div className="row small muted">
            Showing comments on one item.
            <button type="button" className="btn small ghost" onClick={() => setMediaId('')}><Icon name="x" size={14} />Show all items</button>
          </div>
        ) : null}
        {q ? <div className="small muted">Search covers the {rows?.length ?? 0} comments loaded so far. Load more to search further back.</div> : null}
      </GlassCard>

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      {rows === null ? (
        <GlassCard><LoadingList rows={3} /></GlassCard>
      ) : shown.length === 0 ? (
        <GlassCard><EmptyState icon="messageSquare" title={rows.length === 0 ? 'No comments match these filters' : 'No loaded comments match your search'}>{rows.length === 0 ? 'Comments appear here as people post them.' : 'Load more, or try another search.'}</EmptyState></GlassCard>
      ) : (
        shown.map((r) => {
          const busy = busyId === r.ref.path;
          const link = siteLink(r);
          return (
            <GlassCard key={r.ref.path} as="article" className={`item-card ${r.status === 'hidden' ? 'dim' : ''}`}>
              <div className="item-head">
                <div style={{ minWidth: 0 }}>
                  <div className="t">{r.displayName} <span className="small muted" style={{ fontWeight: 500 }}>· <code>{r.uid}</code></span></div>
                  <div className="m">
                    {fmtDate(r.createdAt)}
                    {r.updatedAt && r.createdAt && r.updatedAt.toMillis() - r.createdAt.toMillis() > 1000 ? ` · edited ${fmtDate(r.updatedAt)}` : ''}
                    {r.status === 'hidden' && r.moderatedAt ? ` · hidden ${fmtDate(r.moderatedAt)}` : ''}
                  </div>
                </div>
                <StatusBadge kind={r.status === 'visible' ? 'ok' : 'bad'}>{r.status === 'visible' ? 'Visible' : 'Hidden'}</StatusBadge>
              </div>
              <div className="quote" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.text}</div>
              <div className="context-line">
                On {r.mediaType} testimony: <b>{r.mediaTitle || '(untitled)'}</b> · <code>{r.mediaId}</code>
              </div>
              <div className="actions">
                {r.status === 'visible' ? (
                  <button type="button" className="btn small ghost" disabled={busy} onClick={() => void moderate(r, 'hidden')}><Icon name="eyeOff" size={14} />Hide</button>
                ) : (
                  <button type="button" className="btn small success" disabled={busy} onClick={() => void moderate(r, 'visible')}><Icon name="eye" size={14} />Restore</button>
                )}
                <button type="button" className="btn small danger" disabled={busy} onClick={() => void remove(r)}><Icon name="trash" size={14} />Delete</button>
                {!mediaId.trim() ? <button type="button" className="btn small ghost" onClick={() => setMediaId(r.mediaId)}><Icon name="layers" size={14} />All comments on this item</button> : null}
                {r.mediaType === 'video' ? <button type="button" className="btn small ghost" onClick={() => go({ name: 'editor', id: r.mediaId })}><Icon name="video" size={14} />Open testimony</button> : null}
                {link ? <a className="btn small ghost" href={link} target="_blank" rel="noreferrer"><Icon name="external" size={14} />View on website</a> : null}
              </div>
            </GlassCard>
          );
        })
      )}

      {hasMore && rows && rows.length > 0 ? (
        <div className="load-more">
          <button type="button" className="btn ghost" disabled={loading} onClick={() => void load(cursor)}>{loading ? 'Loading…' : `Load ${PAGE} more`}</button>
        </div>
      ) : null}
    </>
  );
}
