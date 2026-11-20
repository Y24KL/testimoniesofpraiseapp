import { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, query, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { fmtDate } from '../lib';
import { Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useToast } from '../components/feedback';
import { usePendingCounts } from '../hooks/usePendingCounts';
import { EmptyState, FilterTabs, GlassCard, LoadingList, PageHeader, StatusBadge } from '../components/ui';

type Status = 'open' | 'reviewed' | 'actioned' | 'dismissed';
interface Report {
  id: string;
  contentType: string;
  contentId: string;
  reason: string;
  note?: string;
  status: Status;
  createdAt?: Timestamp;
  reviewedBy?: string;
}

const STATUSES: Status[] = ['open', 'reviewed', 'actioned', 'dismissed'];

/** Community reports for review. Admins can only change the status; reports are never deleted. */
export function Reports() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [filter, setFilter] = useState<Status | 'all'>('open');
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();
  const { refresh: refreshCounts } = usePendingCounts();

  useEffect(
    () =>
      onSnapshot(query(collection(db, 'contentReports'), limit(300)), (s) => setReports(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Report, 'id'>) }))), (e) => setErr(e.message)),
    [],
  );

  const shown = useMemo(() => {
    const list = (reports ?? []).filter((r) => filter === 'all' || r.status === filter);
    return list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  }, [reports, filter]);

  const setStatus = async (r: Report, status: Status) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return setErr('You are signed out.');
    setBusyId(r.id);
    setErr('');
    try {
      await updateDoc(doc(db, 'contentReports', r.id), { status, reviewedBy: uid, reviewedAt: serverTimestamp() });
      toast.ok(`Report marked ${status}.`);
      refreshCounts();
    } catch (e) {
      setErr(`Could not update: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const badge = (st: Status) => (st === 'open' ? 'warn' : st === 'actioned' ? 'ok' : st === 'dismissed' ? 'draft' : 'info');
  const label = (st: string) => st.charAt(0).toUpperCase() + st.slice(1);

  return (
    <>
      <PageHeader eyebrow="Community Management" title="Reports" sub="Reports people have filed on community content. Review each one, then mark what you did. Reports are kept for the record and can’t be deleted." />
      <div className="toolbar">
        <FilterTabs
          label="Filter reports"
          value={filter}
          onChange={setFilter}
          options={(['open', ...STATUSES.filter((s) => s !== 'open'), 'all'] as (Status | 'all')[]).map((s) => ({
            id: s,
            label: label(s),
            count: reports ? (s === 'all' ? reports.length : reports.filter((r) => r.status === s).length) : undefined,
          }))}
        />
      </div>
      {err ? <Message kind="err">{err}</Message> : null}
      {reports === null ? <GlassCard><LoadingList rows={3} /></GlassCard> : null}
      {reports !== null && shown.length === 0 ? (
        <GlassCard><EmptyState icon="flag" title={filter === 'open' ? 'No open reports' : 'No reports here'}>{filter === 'open' ? 'Nothing needs reviewing right now.' : 'Try another status filter.'}</EmptyState></GlassCard>
      ) : null}
      {shown.map((r) => (
        <GlassCard key={r.id} as="article" className="item-card">
          <div className="item-head">
            <div style={{ minWidth: 0 }}>
              <div className="t">{label(r.contentType)} <span className="muted small" style={{ fontWeight: 500 }}>· {r.contentId}</span></div>
              <div className="m">{r.createdAt ? `Reported ${fmtDate(r.createdAt)}` : 'Report date not recorded'}</div>
            </div>
            <StatusBadge kind={badge(r.status)}>{label(r.status)}</StatusBadge>
          </div>
          <dl className="kv">
            <dt>Reason</dt><dd>{r.reason}</dd>
            {r.note ? <><dt>Note</dt><dd>{r.note}</dd></> : null}
          </dl>
          <div className="actions">
            <button type="button" className="btn small ghost" disabled={busyId === r.id || r.status === 'reviewed'} onClick={() => void setStatus(r, 'reviewed')}><Icon name="eye" size={14} />Mark reviewed</button>
            <button type="button" className="btn small success" disabled={busyId === r.id || r.status === 'actioned'} onClick={() => void setStatus(r, 'actioned')}><Icon name="check" size={14} />Action taken</button>
            <button type="button" className="btn small ghost" disabled={busyId === r.id || r.status === 'dismissed'} onClick={() => void setStatus(r, 'dismissed')}><Icon name="x" size={14} />Dismiss</button>
          </div>
        </GlassCard>
      ))}
    </>
  );
}
