import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { fmtDate } from '../lib';
import type { Sponsorship, SponsorshipStatus } from '../types';
import { Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useToast } from '../components/feedback';
import { usePendingCounts } from '../hooks/usePendingCounts';
import { EmptyState, FilterTabs, GlassCard, LoadingList, PageHeader, StatusBadge } from '../components/ui';

type Filter = SponsorshipStatus | 'all';

export function Sponsorships() {
  const [items, setItems] = useState<Sponsorship[] | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [err, setErr] = useState('');
  const toast = useToast();
  const { refresh: refreshCounts } = usePendingCounts();

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
    updateDoc(doc(db, 'sponsorships', s.id), { status })
      .then(() => {
        toast.ok(status === 'approved' ? 'Sponsorship approved.' : status === 'rejected' ? 'Sponsorship rejected.' : 'Moved back to pending.');
        refreshCounts();
      })
      .catch((e: Error) => setErr(e.message));

  const shown = (items ?? []).filter((s) => filter === 'all' || s.status === filter);
  const badge = (st: SponsorshipStatus) => (st === 'approved' ? 'ok' : st === 'rejected' ? 'bad' : 'warn');
  const label = (st: string) => st.charAt(0).toUpperCase() + st.slice(1);
  const n = (f: Filter) => (items ?? []).filter((s) => f === 'all' || s.status === f).length;

  return (
    <>
      <PageHeader eyebrow="Community Management" title="Sponsorships" sub="Bank-transfer seeds from the app. Confirm each receipt against your bank statement, then approve or reject it." />
      <div className="toolbar">
        <FilterTabs
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => ({ id: f, label: label(f), count: items ? n(f) : undefined }))}
        />
      </div>
      {err ? <Message kind="err">{err}</Message> : null}
      {!items ? (
        <GlassCard><LoadingList rows={2} /></GlassCard>
      ) : shown.length === 0 ? (
        <GlassCard><EmptyState icon="heart" title={filter === 'pending' ? 'No receipts to verify' : 'Nothing here'}>{filter === 'pending' ? 'New sponsorship receipts appear here.' : 'Try another status filter.'}</EmptyState></GlassCard>
      ) : (
        shown.map((s) => (
          <GlassCard key={s.id} as="article" className="item-card">
            <div className="item-head">
              <div style={{ minWidth: 0 }}>
                <div className="t wrap-anywhere">{s.userEmail ?? s.uid}</div>
                <div className="m">{fmtDate(s.createdAt)}</div>
              </div>
              <StatusBadge kind={badge(s.status)}>{label(s.status)}</StatusBadge>
            </div>
            <dl className="kv">
              <dt>Amount</dt><dd>{s.amount ? <b className="gold">{s.amount}</b> : <span className="muted">Not given</span>}</dd>
              {s.note ? <><dt>Note</dt><dd>{s.note}</dd></> : null}
            </dl>
            {s.receiptUrl ? (
              <a className="receipt" href={s.receiptUrl} target="_blank" rel="noreferrer" title="Open the full receipt in a new tab">
                <img src={s.receiptUrl} alt={`Transfer receipt from ${s.userEmail ?? s.uid}`} loading="lazy" />
              </a>
            ) : <span className="small muted">No receipt image attached.</span>}
            <div className="actions">
              {s.status !== 'approved' ? <button type="button" className="btn small success" onClick={() => void setStatus(s, 'approved')}><Icon name="check" size={14} />Approve</button> : null}
              {s.status !== 'rejected' ? <button type="button" className="btn small ghost" onClick={() => void setStatus(s, 'rejected')}><Icon name="x" size={14} />Reject</button> : null}
              {s.status !== 'pending' ? <button type="button" className="btn small ghost" onClick={() => void setStatus(s, 'pending')}><Icon name="arrowUp" size={14} />Move back to pending</button> : null}
              {s.receiptUrl ? <a className="btn small ghost" href={s.receiptUrl} target="_blank" rel="noreferrer"><Icon name="external" size={14} />Open receipt</a> : null}
            </div>
          </GlassCard>
        ))
      )}
    </>
  );
}
