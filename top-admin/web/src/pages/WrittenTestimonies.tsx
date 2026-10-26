import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { fmtDate } from '../lib';
import { describe, notifyWrittenPublished } from '../notify';
import type { Route } from '../types';
import { Message } from '../components/Field';

export interface WrittenTestimonyDoc {
  id: string;
  title: string;
  body: string;
  authorName?: string;
  churchZone?: string;
  authorPhotoUrl?: string;
  category?: string;
  isPublished: boolean;
  createdAt?: Timestamp;
  publishedAt?: Timestamp | null;
  sourceSubmissionId?: string;
}

type Filter = 'all' | 'published' | 'draft';

/** Written testimonies shown in the app's library (writtenTestimonies collection). */
export function WrittenTestimonies({ go }: { go: (r: Route) => void }) {
  const [items, setItems] = useState<WrittenTestimonyDoc[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'writtenTestimonies'), orderBy('createdAt', 'desc')),
        (s) => setItems(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WrittenTestimonyDoc, 'id'>) }))),
        (e) => setErr(e.message),
      ),
    [],
  );

  const togglePublish = async (w: WrittenTestimonyDoc) => {
    const publish = !w.isPublished;
    if (!publish && !confirm(`Unpublish “${w.title}”? It disappears from the app and website right away.`)) return;
    setBusyId(w.id); setErr(''); setOk('');
    try {
      await updateDoc(doc(db, 'writtenTestimonies', w.id), {
        isPublished: publish,
        ...(publish && !w.publishedAt ? { publishedAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      });
      let msg = publish ? `Published “${w.title}”.` : `“${w.title}” is now a draft.`;
      if (publish) msg += ` ${describe(await notifyWrittenPublished(w.id, w.title))}`;
      setOk(msg);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusyId('');
  };

  const remove = async (w: WrittenTestimonyDoc) => {
    if (!confirm(`Delete “${w.title}”? This can’t be undone. (Unpublish it instead if you may want it back.)`)) return;
    setBusyId(w.id); setErr(''); setOk('');
    try {
      await deleteDoc(doc(db, 'writtenTestimonies', w.id));
      setOk('Deleted.');
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusyId('');
  };

  const q = search.trim().toLowerCase();
  const shown = (items ?? []).filter(
    (w) =>
      (filter === 'all' || (filter === 'published') === w.isPublished) &&
      (!q || [w.title, w.authorName, w.churchZone, w.body].some((v) => v?.toLowerCase().includes(q))),
  );

  return (
    <>
      <div className="row between">
        <h1>Written testimonies</h1>
        <button className="btn" onClick={() => go({ name: 'writtenEditor' })}>+ New written testimony</button>
      </div>
      <p className="muted">
        Text testimonies shown in the app’s and website’s “Written testimonies” library. Only published ones are visible to users. You can also turn an approved submission into a written testimony from the Submissions page.
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        {(['all', 'published', 'draft'] as Filter[]).map((f) => (
          <button key={f} className={`btn small ${filter === f ? '' : 'ghost'}`} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
        ))}
        <input type="text" placeholder="Search title, name, church or text" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
      </div>
      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}
      {!items ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="card muted">{items.length === 0 ? 'No written testimonies yet.' : 'Nothing matches this filter.'}</div>
      ) : (
        shown.map((w) => (
          <div className="card" key={w.id}>
            <div className="row between">
              <div style={{ minWidth: 0 }}>
                <b>{w.title}</b>
                <div className="small muted">{[w.authorName, w.churchZone, w.category, fmtDate(w.createdAt)].filter(Boolean).join(' · ')}</div>
              </div>
              <span className={`pill ${w.isPublished ? 'ok' : 'draft'}`}>{w.isPublished ? 'PUBLISHED' : 'DRAFT'}</span>
            </div>
            <div className="quote" style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden' }}>{w.body}</div>
            <div className="row">
              <button className="btn small" onClick={() => go({ name: 'writtenEditor', id: w.id })}>Edit</button>
              <button className={`btn small ${w.isPublished ? 'ghost' : ''}`} disabled={busyId === w.id} onClick={() => void togglePublish(w)}>
                {w.isPublished ? 'Unpublish' : 'Publish'}
              </button>
              <button className="btn small danger" disabled={busyId === w.id} onClick={() => void remove(w)}>Delete</button>
            </div>
          </div>
        ))
      )}
    </>
  );
}
