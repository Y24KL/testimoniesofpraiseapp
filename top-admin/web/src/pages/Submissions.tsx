import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { fmtDate } from '../lib';
import type { Route, Submission } from '../types';
import { Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useConfirm, useToast } from '../components/feedback';
import { usePendingCounts } from '../hooks/usePendingCounts';
import { EmptyState, FilterTabs, GlassCard, LoadingList, PageHeader, SearchInput, StatusBadge } from '../components/ui';
import { MessageUserButton } from '../components/MessageUserButton';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

export function Submissions({ go }: { go: (r: Route) => void }) {
  const [items, setItems] = useState<Submission[] | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const confirm = useConfirm();
  const toast = useToast();
  const { refresh: refreshCounts } = usePendingCounts();

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'testimonySubmissions'), orderBy('createdAt', 'desc'), limit(300)),
        (s) => setItems(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Submission, 'id'>) }))),
        (e) => setErr(e.message),
      ),
    [],
  );

  const setStatus = (s: Submission, status: Submission['status']) =>
    updateDoc(doc(db, 'testimonySubmissions', s.id), { status })
      .then(() => {
        toast.ok(status === 'rejected' ? `Rejected the submission from ${s.fullName}.` : `Moved ${s.fullName}’s submission back to pending.`);
        refreshCounts();
      })
      .catch((e: Error) => setErr(e.message));

  const remove = async (s: Submission) => {
    if (!(await confirm({ title: `Delete the submission from ${s.fullName}?`, message: 'This can’t be undone.', confirmLabel: 'Delete permanently', danger: true }))) return;
    await deleteDoc(doc(db, 'testimonySubmissions', s.id))
      .then(() => {
        toast.ok('Submission deleted.');
        refreshCounts();
      })
      .catch((e: Error) => setErr(e.message));
  };

  // Turns a submission into an unpublished testimony draft, then opens it so a video can be added.
  const makeDraft = async (s: Submission) => {
    setErr('');
    try {
      const d = await addDoc(collection(db, 'testimonies'), {
        title: `Testimony from ${s.fullName}`,
        description: s.testimony,
        authorName: s.fullName,
        category: '',
        keywords: [],
        thumbnail: '',
        videoUrl: '',
        duration: 0,
        isPublished: false,
        isFeatured: false,
        isDownloadable: false,
        notifyOnPublish: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'testimonySubmissions', s.id), { status: 'approved', linkedTestimonyId: d.id });
      refreshCounts();
      go({ name: 'editor', id: d.id });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const needle = search.trim().toLowerCase();
  const shown = (items ?? []).filter(
    (s) => (filter === 'all' || s.status === filter) && (!needle || [s.fullName, s.churchZone, s.testimony, s.userEmail ?? ''].some((v) => v?.toLowerCase().includes(needle))),
  );
  const badge = (st: Submission['status']) => (st === 'approved' ? 'ok' : st === 'rejected' ? 'bad' : 'warn');
  const n = (f: Filter) => (items ?? []).filter((s) => f === 'all' || s.status === f).length;
  const label = (st: Submission['status']) => st.charAt(0).toUpperCase() + st.slice(1);

  return (
    <>
      <PageHeader
        eyebrow="Community Management"
        title="Testimony Submissions"
        sub="Testimonies people shared from the app. Nothing here is public until you turn it into a testimony and publish it."
      />
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, church, email or text…" label="Search submissions" />
        <FilterTabs
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => ({ id: f, label: f === 'all' ? 'All' : label(f), count: items ? n(f) : undefined }))}
        />
      </div>
      {err ? <Message kind="err">{err}</Message> : null}
      {!items ? (
        <GlassCard><LoadingList rows={3} /></GlassCard>
      ) : shown.length === 0 ? (
        <GlassCard>
          <EmptyState icon="inbox" title={filter === 'pending' && !needle ? 'All caught up' : 'No submissions here'}>
            {filter === 'pending' && !needle ? 'There are no submissions waiting for review.' : 'Try another search or status filter.'}
          </EmptyState>
        </GlassCard>
      ) : (
        shown.map((s) => (
          <GlassCard key={s.id} as="article" className="item-card">
            <div className="item-head">
              <div style={{ minWidth: 0 }}>
                <div className="t">{s.fullName}{s.churchZone ? <span className="muted" style={{ fontWeight: 500 }}> · {s.churchZone}</span> : null}</div>
                <div className="m">{[s.userEmail, fmtDate(s.createdAt)].filter(Boolean).join(' · ')}</div>
              </div>
              <StatusBadge kind={badge(s.status)}>{label(s.status)}</StatusBadge>
            </div>
            <div className="quote" style={{ whiteSpace: 'pre-wrap' }}>{s.testimony}</div>
            <div className="actions">
              <MessageUserButton uid={s.userId} label="Message submitter" context={{ category: 'testimony', related: { type: 'testimony_submission', id: s.id, label: `Testimony from ${s.fullName}` } }} />
              {s.linkedTestimonyId ? (
                <button type="button" className="btn small" onClick={() => go({ name: 'editor', id: s.linkedTestimonyId })}><Icon name="video" size={14} />Open video draft</button>
              ) : (
                <button type="button" className="btn small" onClick={() => void makeDraft(s)}><Icon name="video" size={14} />Create video testimony draft</button>
              )}
              {s.linkedWrittenId ? (
                <button type="button" className="btn small ghost" onClick={() => go({ name: 'writtenEditor', id: s.linkedWrittenId })}><Icon name="fileText" size={14} />Open written testimony</button>
              ) : (
                <button type="button" className="btn small ghost" onClick={() => go({ name: 'writtenEditor', prefill: { title: `Testimony from ${s.fullName}`, body: s.testimony, authorName: s.fullName, churchZone: s.churchZone, sourceSubmissionId: s.id } })}>
                  <Icon name="fileText" size={14} />Create written testimony
                </button>
              )}
              {s.status !== 'rejected' && !s.linkedTestimonyId && !s.linkedWrittenId ? <button type="button" className="btn small ghost" onClick={() => void setStatus(s, 'rejected')}><Icon name="x" size={14} />Reject</button> : null}
              {s.status === 'rejected' ? <button type="button" className="btn small ghost" onClick={() => void setStatus(s, 'pending')}><Icon name="undo" size={14} />Move back to pending</button> : null}
              <button type="button" className="btn small danger" onClick={() => void remove(s)}><Icon name="trash" size={14} />Delete</button>
            </div>
          </GlassCard>
        ))
      )}
    </>
  );
}
