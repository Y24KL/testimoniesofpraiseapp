import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useToast } from '../components/feedback';
import { usePendingCounts } from '../hooks/usePendingCounts';
import { EmptyState, FilterTabs, GlassCard, LoadingList, PageHeader, StatusBadge } from '../components/ui';
import type { Route } from '../types';

type Status = 'pending' | 'reviewed' | 'approved' | 'rejected';

/** A "Feature your choir/group" submission (Firestore: choirFeatureRequests). Records are kept, never deleted. */
interface ChoirRequest {
  id: string;
  groupName: string;
  churchZone: string;
  ministrationUrl: string;
  songTitle: string;
  submittedBy: string;
  status: Status;
  submittedAt?: Timestamp | null;
  reviewedAt?: Timestamp | null;
  reviewedBy?: string | null;
}

const LABEL: Record<Status, string> = { pending: 'Pending', reviewed: 'Reviewed', approved: 'Approved', rejected: 'Rejected' };
const FILTERS: ('all' | Status)[] = ['all', 'pending', 'reviewed', 'approved', 'rejected'];

/** Review queue for choir/group requests. Approving never publishes anything: add the group under "Featured choirs". */
export function ChoirRequests({ go }: { go: (r: Route) => void }) {
  const [requests, setRequests] = useState<ChoirRequest[] | null>(null);
  const [filter, setFilter] = useState<'all' | Status>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const toast = useToast();
  const { refresh: refreshCounts } = usePendingCounts();

  useEffect(() => {
    const q = query(collection(db, 'choirFeatureRequests'), orderBy('submittedAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChoirRequest, 'id'>) }))),
      (e) => setErr(e.message),
    );
  }, []);

  const setStatus = async (r: ChoirRequest, status: Status) => {
    setErr('');
    setBusyId(r.id);
    try {
      // Rules allow only these three fields to change, and only to the signed-in admin.
      await updateDoc(doc(db, 'choirFeatureRequests', r.id), {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid ?? null,
      });
      toast.ok(`${r.groupName} marked ${LABEL[status].toLowerCase()}.`);
      refreshCounts();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const shown = (requests ?? []).filter((r) => filter === 'all' || r.status === filter);
  const badge = (st: Status) => (st === 'approved' ? 'ok' : st === 'rejected' ? 'bad' : st === 'reviewed' ? 'info' : 'warn');

  return (
    <>
      <PageHeader
        eyebrow="Community Management"
        title="Choir Requests"
        sub="Requests from “Feature your choir/group on T.O.P”. Approving doesn’t publish anything; to show a group in the app, add it under Featured Choirs."
        actions={<button type="button" className="btn ghost" onClick={() => go({ name: 'featuredChoirs' })}><Icon name="users" size={16} />Open Featured Choirs</button>}
      />
      <div className="toolbar">
        <FilterTabs
          label="Filter requests"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ id: f, label: f === 'all' ? 'All' : LABEL[f], count: requests ? requests.filter((r) => f === 'all' || r.status === f).length : undefined }))}
        />
      </div>
      {err ? <Message kind="err">{err}</Message> : null}
      {!requests ? <GlassCard><LoadingList rows={3} /></GlassCard> : null}
      {requests && shown.length === 0 ? (
        <GlassCard><EmptyState icon="userPlus" title={filter === 'pending' ? 'No requests waiting' : 'No requests here'}>{filter === 'pending' ? 'New choir and group requests appear here.' : 'Try another status filter.'}</EmptyState></GlassCard>
      ) : null}

      {shown.map((r) => (
        <GlassCard key={r.id} as="article" className="item-card">
          <div className="item-head">
            <div style={{ minWidth: 0 }}>
              <div className="t">{r.groupName}</div>
              <div className="m">{[r.churchZone, r.songTitle ? `“${r.songTitle}”` : ''].filter(Boolean).join(' · ')}</div>
            </div>
            <StatusBadge kind={badge(r.status)}>{LABEL[r.status] ?? r.status}</StatusBadge>
          </div>
          <dl className="kv">
            <dt>Submitted</dt><dd>{r.submittedAt ? r.submittedAt.toDate().toLocaleString() : 'just now'}</dd>
            <dt>User ID</dt><dd><code>{r.submittedBy}</code></dd>
            {r.reviewedAt ? <><dt>Reviewed</dt><dd>{r.reviewedAt.toDate().toLocaleString()}</dd></> : null}
          </dl>
          <div className="actions">
            <a className="btn small" href={r.ministrationUrl} target="_blank" rel="noopener noreferrer"><Icon name="play" size={14} />Watch ministration</a>
            <button type="button" className="btn small ghost" disabled={busyId === r.id || r.status === 'reviewed'} onClick={() => void setStatus(r, 'reviewed')}><Icon name="eye" size={14} />Mark reviewed</button>
            <button type="button" className="btn small success" disabled={busyId === r.id || r.status === 'approved'} onClick={() => void setStatus(r, 'approved')}><Icon name="check" size={14} />Approve</button>
            <button type="button" className="btn small ghost" disabled={busyId === r.id || r.status === 'rejected'} onClick={() => void setStatus(r, 'rejected')}><Icon name="x" size={14} />Reject</button>
            {r.status === 'pending' ? null : (
              <button type="button" className="btn small ghost" disabled={busyId === r.id} onClick={() => void setStatus(r, 'pending')}><Icon name="arrowUp" size={14} />Back to pending</button>
            )}
          </div>
        </GlassCard>
      ))}
    </>
  );
}
