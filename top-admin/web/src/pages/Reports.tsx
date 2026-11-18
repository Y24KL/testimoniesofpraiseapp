import { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, query, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { fmtDate } from '../lib';
import { Message } from '../components/Field';

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
    } catch (e) {
      setErr(`Could not update: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 960 }}>
      <header>
        <h1 style={{ margin: 0 }}>Reports</h1>
        <p style={{ margin: '4px 0 0', opacity: 0.8 }}>Reports people have filed on community content. Review each one, then mark it.</p>
      </header>
      {err && <Message kind="err">{err}</Message>}
      <div style={{ display: 'flex', gap: 8 }} role="tablist" aria-label="Filter reports">
        {(['open', ...STATUSES.filter((s) => s !== 'open'), 'all'] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={filter === s} onClick={() => setFilter(s)} style={{ fontWeight: filter === s ? 700 : 400 }}>
            {s === 'all' ? 'All' : s} {s !== 'all' && reports ? `(${reports.filter((r) => r.status === s).length})` : ''}
          </button>
        ))}
      </div>
      {reports === null && <p>Loading…</p>}
      {reports !== null && shown.length === 0 && <p>No reports here.</p>}
      {shown.map((r) => (
        <article key={r.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong>{r.contentType} · {r.contentId}</strong>
            <span style={{ opacity: 0.8 }}>{r.status}{r.createdAt ? ` · ${fmtDate(r.createdAt)}` : ''}</span>
          </div>
          <div>Reason: {r.reason}</div>
          {r.note ? <div style={{ opacity: 0.9 }}>Note: {r.note}</div> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={busyId === r.id || r.status === 'reviewed'} onClick={() => void setStatus(r, 'reviewed')}>Mark reviewed</button>
            <button type="button" disabled={busyId === r.id || r.status === 'actioned'} onClick={() => void setStatus(r, 'actioned')}>Action taken</button>
            <button type="button" disabled={busyId === r.id || r.status === 'dismissed'} onClick={() => void setStatus(r, 'dismissed')}>Dismiss</button>
          </div>
        </article>
      ))}
    </div>
  );
}
