import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { fmtDate } from '../lib';
import type { Route, Submission } from '../types';
import { Message } from '../components/Field';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

export function Submissions({ go }: { go: (r: Route) => void }) {
  const [items, setItems] = useState<Submission[] | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [err, setErr] = useState('');

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
    updateDoc(doc(db, 'testimonySubmissions', s.id), { status }).catch((e: Error) => setErr(e.message));

  const remove = async (s: Submission) => {
    if (confirm(`Delete the submission from ${s.fullName}? This can’t be undone.`)) await deleteDoc(doc(db, 'testimonySubmissions', s.id)).catch((e: Error) => setErr(e.message));
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
      go({ name: 'editor', id: d.id });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const shown = (items ?? []).filter((s) => filter === 'all' || s.status === filter);
  const pill = (st: Submission['status']) => (st === 'approved' ? 'ok' : st === 'rejected' ? 'bad' : 'warn');

  return (
    <>
      <h1>Submissions</h1>
      <p className="muted">Testimonies people shared from the app. Nothing here is public until you turn it into a testimony and publish it.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => (
          <button key={f} className={`btn small ${filter === f ? '' : 'ghost'}`} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
        ))}
      </div>
      {err ? <Message kind="err">{err}</Message> : null}
      {!items ? <p className="muted">Loading…</p> : shown.length === 0 ? <div className="card muted">No submissions here.</div> : shown.map((s) => (
        <div className="card" key={s.id}>
          <div className="row between">
            <div><b>{s.fullName}</b> <span className="muted">· {s.churchZone}</span>
              <div className="small muted">{[s.userEmail, fmtDate(s.createdAt)].filter(Boolean).join(' · ')}</div></div>
            <span className={`pill ${pill(s.status)}`}>{s.status.toUpperCase()}</span>
          </div>
          <div className="quote">{s.testimony}</div>
          <div className="row">
            {s.linkedTestimonyId
              ? <button className="btn small" onClick={() => go({ name: 'editor', id: s.linkedTestimonyId })}>Open draft</button>
              : <button className="btn small" onClick={() => void makeDraft(s)}>Create testimony draft</button>}
            {s.status !== 'rejected' && !s.linkedTestimonyId ? <button className="btn small ghost" onClick={() => void setStatus(s, 'rejected')}>Reject</button> : null}
            {s.status === 'rejected' ? <button className="btn small ghost" onClick={() => void setStatus(s, 'pending')}>Move back to pending</button> : null}
            <button className="btn small danger" onClick={() => void remove(s)}>Delete</button>
          </div>
        </div>
      ))}
    </>
  );
}
