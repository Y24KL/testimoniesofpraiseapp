import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Field, Message } from '../components/Field';

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
const STATUS_LABEL: Record<Status, string> = { new: 'NEW', reviewed: 'REVIEWED', resolved: 'RESOLVED' };
const STATUS_PILL: Record<Status, string> = { new: 'pill warn', reviewed: 'pill', resolved: 'pill ok' };
const STATUSES: Status[] = ['new', 'reviewed', 'resolved'];
const PLATFORM_LABEL: Record<string, string> = { android: 'Android app', ios: 'iPhone app', web: 'Website' };

/** Inbox for "Feedback & Suggestions". Admins read everything and can only change the status. */
export function UserFeedback() {
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | FeedbackType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState('');
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
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const all = items ?? [];
  const newCount = all.filter((f) => f.status === 'new').length;
  const shown = all.filter((f) => (typeFilter === 'all' || f.feedbackType === typeFilter) && (statusFilter === 'all' || f.status === statusFilter));

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>User Feedback</h1>
        {items ? <span className={newCount > 0 ? 'pill warn' : 'pill'}>{newCount} new</span> : null}
      </div>
      <p className="muted">Messages sent from “Feedback &amp; Suggestions” in the app and on the website. Mark each one Reviewed or Resolved as you deal with it.</p>

      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 220px' }}>
            <Field label="Category">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | FeedbackType)}>
                <option value="all">All categories</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <Field label="Status">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | Status)}>
                <option value="all">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        {err ? <Message kind="err">{err}</Message> : null}
        {!items ? <div className="muted">Loading…</div> : null}
        {items && shown.length === 0 ? <div className="muted">{all.length === 0 ? 'No feedback yet.' : 'No feedback matches these filters.'}</div> : null}
        {items && shown.length > 0 ? (
          <div className="small muted">
            Showing {shown.length} of {all.length}
          </div>
        ) : null}
      </div>

      {shown.map((f) => {
        const profile = profiles[f.userId];
        const name = profile ? [profile.title, profile.fullName].filter(Boolean).join(' ') : '';
        const place = profile ? [profile.church, profile.zone].filter(Boolean).join(', ') : '';
        const status: Status = STATUSES.includes(f.status) ? f.status : 'new';
        return (
          <div key={f.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="pill">{TYPE_LABEL[f.feedbackType] ?? f.feedbackType}</span>
              <span className={STATUS_PILL[status]}>{STATUS_LABEL[status]}</span>
            </div>
            {f.subject ? <h2 style={{ margin: '10px 0 0' }}>{f.subject}</h2> : null}
            <p style={{ margin: '10px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{f.message}</p>
            <div className="small muted">
              Rating:{' '}
              {f.rating ? (
                <span style={{ color: 'var(--accent)' }} aria-label={`${f.rating} out of 5`}>
                  {'★'.repeat(f.rating)}
                  {'☆'.repeat(5 - f.rating)}
                </span>
              ) : (
                'not given'
              )}{' '}
              • {PLATFORM_LABEL[f.platform] ?? f.platform}
              {f.appVersion ? ` (version ${f.appVersion})` : ''}
            </div>
            <div className="small muted">
              Sent {f.createdAt ? f.createdAt.toDate().toLocaleString() : 'just now'}
              {f.reviewedAt ? ` • Status changed ${f.reviewedAt.toDate().toLocaleString()}` : ''}
            </div>
            <div className="small muted">
              From:{' '}
              {profile === undefined ? 'Loading…' : name || 'No profile saved'}
              {place ? ` • ${place}` : ''} • User ID <code>{f.userId}</code>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn ghost" disabled={busyId === f.id || status === 'reviewed'} onClick={() => void setStatus(f, 'reviewed')}>
                Mark reviewed
              </button>
              <button className="btn" disabled={busyId === f.id || status === 'resolved'} onClick={() => void setStatus(f, 'resolved')}>
                Mark resolved
              </button>
              {status === 'new' ? null : (
                <button className="btn ghost" disabled={busyId === f.id} onClick={() => void setStatus(f, 'new')}>
                  Back to new
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
