import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { fmtDate } from '../lib';
import type { Sponsorship, SponsorshipStatus } from '../types';
import { Message } from '../components/Field';

type Filter = SponsorshipStatus | 'all';

export function Sponsorships() {
  const [items, setItems] = useState<Sponsorship[] | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [err, setErr] = useState('');

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'sponsorships'), orderBy('createdAt', 'desc'), limit(300)),
        (s) => setItems(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sponsorship, 'id'>) }))),
        (e) => setErr(e.message),
      ),
    [],
  );

  const setStatus = (s: Sponsorship, status: SponsorshipStatus) =>
    updateDoc(doc(db, 'sponsorships', s.id), { status }).catch((e: Error) => setErr(e.message));

  const shown = (items ?? []).filter((s) => filter === 'all' || s.status === filter);
  const pillClass = (st: SponsorshipStatus) => (st === 'approved' ? 'ok' : st === 'rejected' ? 'bad' : 'warn');

  return (
    <>
      <h1>Sponsorships</h1>
      <p className="muted">Bank-transfer seeds from the app. Confirm the receipt against your bank statement, then approve or reject.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => (
          <button key={f} className={`btn small ${filter === f ? '' : 'ghost'}`} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
        ))}
      </div>
      {err ? <Message kind="err">{err}</Message> : null}
      {!items ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="card muted">Nothing here.</div>
      ) : (
        shown.map((s) => (
          <div className="card" key={s.id}>
            <div className="row between">
              <div>
                <b>{s.userEmail ?? s.uid}</b>
                {s.amount ? <span className="muted"> · {s.amount}</span> : null}
                <div className="small muted">{fmtDate(s.createdAt)}</div>
              </div>
              <span className={`pill ${pillClass(s.status)}`}>{s.status.toUpperCase()}</span>
            </div>
            {s.note ? <p className="small">{s.note}</p> : null}
            <a href={s.receiptUrl} target="_blank" rel="noreferrer">
              <img src={s.receiptUrl} alt="Transfer receipt" style={{ maxWidth: 320, maxHeight: 320, borderRadius: 12, marginTop: 8 }} />
            </a>
            <div className="row" style={{ marginTop: 10 }}>
              {s.status !== 'approved' ? <button className="btn small" onClick={() => void setStatus(s, 'approved')}>Approve</button> : null}
              {s.status !== 'rejected' ? <button className="btn small ghost" onClick={() => void setStatus(s, 'rejected')}>Reject</button> : null}
              {s.status !== 'pending' ? <button className="btn small ghost" onClick={() => void setStatus(s, 'pending')}>Move back to pending</button> : null}
            </div>
          </div>
        ))
      )}
    </>
  );
}
