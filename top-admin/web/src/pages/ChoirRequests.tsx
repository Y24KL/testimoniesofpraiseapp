import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Field, Message } from '../components/Field';
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
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const shown = (requests ?? []).filter((r) => filter === 'all' || r.status === filter);

  return (
    <div>
      <h1>Choir requests</h1>
      <p className="muted">Requests from “Feature your choir/group on T.O.P”. Nothing is published from here. To show a group in the app, add it under Featured choirs.</p>

      <div className="card">
        <Field label="Show">
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | Status)}>
            {FILTERS.map((f) => (
              <option key={f} value={f}>
                {f === 'all' ? 'All requests' : LABEL[f]}
              </option>
            ))}
          </select>
        </Field>
        {err ? <Message kind="err">{err}</Message> : null}
        {!requests ? <div className="muted">Loading…</div> : null}
        {requests && shown.length === 0 ? <div className="muted">No requests here.</div> : null}
      </div>

      {shown.map((r) => (
        <div key={r.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{r.groupName}</h2>
            <span className="small" style={{ fontWeight: 700 }}>{LABEL[r.status] ?? r.status}</span>
          </div>
          <div className="small muted">
            Church zone: {r.churchZone} • Song: {r.songTitle}
          </div>
          <div className="small muted">
            Submitted {r.submittedAt ? r.submittedAt.toDate().toLocaleString() : 'just now'} • User ID <code>{r.submittedBy}</code>
          </div>
          {r.reviewedAt ? <div className="small muted">Reviewed {r.reviewedAt.toDate().toLocaleString()}</div> : null}
          <p style={{ margin: '10px 0', wordBreak: 'break-all' }}>
            <a href={r.ministrationUrl} target="_blank" rel="noopener noreferrer">Open the ministration link</a>
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn ghost" disabled={busyId === r.id || r.status === 'reviewed'} onClick={() => void setStatus(r, 'reviewed')}>Mark reviewed</button>
            <button className="btn" disabled={busyId === r.id || r.status === 'approved'} onClick={() => void setStatus(r, 'approved')}>Approve</button>
            <button className="btn ghost" disabled={busyId === r.id || r.status === 'rejected'} onClick={() => void setStatus(r, 'rejected')}>Reject</button>
            {r.status === 'pending' ? null : (
              <button className="btn ghost" disabled={busyId === r.id} onClick={() => void setStatus(r, 'pending')}>Back to pending</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
