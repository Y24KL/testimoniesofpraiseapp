import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useToast } from '../components/feedback';
import { usePendingCounts } from '../hooks/usePendingCounts';
import { EmptyState, FilterTabs, GlassCard, LoadingList, PageHeader, SearchInput, StatusBadge } from '../components/ui';

type Status = 'new' | 'reviewed' | 'resolved';
type FeedbackType = 'general' | 'suggestion' | 'problem' | 'experience' | 'other';

/** One "Feedback & Suggestions" entry from the app or the website (Firestore: appFeedback). Kept, never deleted. */
interface Feedback {
  id: string;
  userId: string;
  feedbackType: FeedbackType;
  subject?: string;
  message: string;
  rating?: number;
  platform: 'android' | 'ios' | 'web';
  appVersion?: string;
  status: Status;
  createdAt?: Timestamp | null;
  reviewedAt?: Timestamp | null;
}

/** What the users/{uid} profile holds. Missing for accounts that never completed a profile. */
interface Profile {
  title?: string;
  fullName?: string;
  zone?: string;
  church?: string;
}

const TYPE_LABEL: Record<FeedbackType, string> = {
  general: 'General Feedback',
  suggestion: 'Suggestion / Feature Request',
  problem: 'Report a Problem',
  experience: 'User Experience',
  other: 'Other',
};
const TYPES = Object.keys(TYPE_LABEL) as FeedbackType[];
const STATUS_LABEL: Record<Status, string> = { new: 'New', reviewed: 'Reviewed', resolved: 'Resolved' };
const STATUSES: Status[] = ['new', 'reviewed', 'resolved'];
const PLATFORM_LABEL: Record<string, string> = { android: 'Android app', ios: 'iPhone app', web: 'Website' };

/** Inbox for "Feedback & Suggestions". Admins read everything and can only change the status. */
export function UserFeedback() {
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | FeedbackType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const toast = useToast();
  const { refresh: refreshCounts } = usePendingCounts();
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({});
  const asked = useRef(new Set<string>());

  useEffect(() => {
    const q = query(collection(db, 'appFeedback'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Feedback, 'id'>) }))),
      (e) => setErr(e.message),
    );
  }, []);

  // Look up each sender's profile once (users/{uid}; admins may read it).
  useEffect(() => {
    for (const f of items ?? []) {
      if (!f.userId || asked.current.has(f.userId)) continue;
      asked.current.add(f.userId);
      getDoc(doc(db, 'users', f.userId))
        .then((snap) => setProfiles((p) => ({ ...p, [f.userId]: snap.exists() ? (snap.data() as Profile) : null })))
        .catch(() => setProfiles((p) => ({ ...p, [f.userId]: null })));
    }
  }, [items]);

  const setStatus = async (f: Feedback, status: Status) => {
    setErr('');
    setBusyId(f.id);
    try {
      // Rules allow only these three fields to change, and only to the signed-in admin.
      await updateDoc(doc(db, 'appFeedback', f.id), {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid ?? null,
      });
      toast.ok(`Feedback marked ${STATUS_LABEL[status].toLowerCase()}.`);
      refreshCounts();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const all = items ?? [];
  const needle = search.trim().toLowerCase();
  const shown = all.filter(
    (f) =>
      (typeFilter === 'all' || f.feedbackType === typeFilter) &&
      (statusFilter === 'all' || f.status === statusFilter) &&
      (!needle || [f.subject ?? '', f.message, f.userId].some((v) => v.toLowerCase().includes(needle))),
  );
  const badge = (st: Status) => (st === 'new' ? 'warn' : st === 'resolved' ? 'ok' : 'info');

  return (
    <>
      <PageHeader
        eyebrow="Community Management"
        title="User Feedback"
        sub="Messages sent from “Feedback & Suggestions” in the app and on the website. Mark each one Reviewed or Resolved as you deal with it."
      />
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search subject, message or user ID…" label="Search feedback" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | FeedbackType)} aria-label="Filter by category" style={{ width: 'auto' }}>
          <option value="all">All categories</option>
          {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <FilterTabs
          label="Filter by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={(['all', ...STATUSES] as ('all' | Status)[]).map((s) => ({ id: s, label: s === 'all' ? 'All' : STATUS_LABEL[s], count: items ? all.filter((f) => s === 'all' || f.status === s).length : undefined }))}
        />
      </div>
      {err ? <Message kind="err">{err}</Message> : null}
      {!items ? <GlassCard><LoadingList rows={3} /></GlassCard> : null}
      {items && shown.length === 0 ? (
        <GlassCard><EmptyState icon="messageCircle" title={all.length === 0 ? 'No feedback yet' : 'No feedback matches'}>{all.length === 0 ? 'Feedback from the app and website appears here.' : 'Try other filters or another search.'}</EmptyState></GlassCard>
      ) : null}
      {items && shown.length > 0 ? <p className="result-count">Showing {shown.length} of {all.length}</p> : null}

      {shown.map((f) => {
        const profile = profiles[f.userId];
        const name = profile ? [profile.title, profile.fullName].filter(Boolean).join(' ') : '';
        const place = profile ? [profile.church, profile.zone].filter(Boolean).join(', ') : '';
        const status: Status = STATUSES.includes(f.status) ? f.status : 'new';
        return (
          <GlassCard key={f.id} as="article" className="item-card">
            <div className="item-head">
              <div className="row gap" style={{ gap: 8 }}>
                <StatusBadge kind="info" plain>{TYPE_LABEL[f.feedbackType] ?? f.feedbackType}</StatusBadge>
                {f.rating ? (
                  <span className="gold" aria-label={`Rated ${f.rating} out of 5`} title={`Rated ${f.rating} out of 5`}>
                    {Array.from({ length: 5 }, (_, i) => <Icon key={i} name="star" size={14} fill={i < (f.rating ?? 0) ? 'currentColor' : 'none'} />)}
                  </span>
                ) : <span className="small muted">No rating</span>}
              </div>
              <StatusBadge kind={badge(status)}>{STATUS_LABEL[status]}</StatusBadge>
            </div>
            {f.subject ? <div className="t" style={{ fontSize: 17, fontWeight: 700 }}>{f.subject}</div> : null}
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{f.message}</p>
            <dl className="kv">
              <dt>From</dt>
              <dd>{profile === undefined ? 'Loading…' : name || 'No profile saved'}{place ? ` · ${place}` : ''} · <code>{f.userId}</code></dd>
              <dt>Platform</dt>
              <dd>{PLATFORM_LABEL[f.platform] ?? f.platform}{f.appVersion ? ` (version ${f.appVersion})` : ''}</dd>
              <dt>Sent</dt>
              <dd>{f.createdAt ? f.createdAt.toDate().toLocaleString() : 'just now'}{f.reviewedAt ? ` · status changed ${f.reviewedAt.toDate().toLocaleString()}` : ''}</dd>
            </dl>
            <div className="actions">
              <button type="button" className="btn small ghost" disabled={busyId === f.id || status === 'reviewed'} onClick={() => void setStatus(f, 'reviewed')}><Icon name="eye" size={14} />Mark reviewed</button>
              <button type="button" className="btn small success" disabled={busyId === f.id || status === 'resolved'} onClick={() => void setStatus(f, 'resolved')}><Icon name="check" size={14} />Mark resolved</button>
              {status === 'new' ? null : (
                <button type="button" className="btn small ghost" disabled={busyId === f.id} onClick={() => void setStatus(f, 'new')}><Icon name="arrowUp" size={14} />Back to new</button>
              )}
            </div>
          </GlassCard>
        );
      })}
    </>
  );
}
