import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { describe, notifyTestimonyPublished } from '../notify';
import { fmtDate, fmtDuration, testimonyFromDoc } from '../lib';
import type { Route, Testimony } from '../types';
import { Message } from '../components/Field';

export function Testimonies({ go }: { go: (r: Route) => void }) {
  const [items, setItems] = useState<Testimony[] | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'testimonies'), orderBy('createdAt', 'desc'), limit(300)),
        (s) => setItems(s.docs.map(testimonyFromDoc)),
        (e) => setErr(e.message),
      ),
    [],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter(
      (t) =>
        (filter === 'all' || (filter === 'published') === t.isPublished) &&
        (!needle || [t.title, t.authorName, t.category, ...t.keywords].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [items, q, filter]);

  const togglePublish = async (t: Testimony) => {
    setErr('');
    setNote('');
    if (!t.isPublished) {
      if (!t.videoUrl) return setErr(`“${t.title}” has no video yet. Open it and add one before publishing.`);
      if (t.notifyOnPublish && !confirm(`Publish “${t.title}”?\n\nThis notifies app users.`)) return;
    }
    try {
      await updateDoc(doc(db, 'testimonies', t.id), {
        isPublished: !t.isPublished,
        ...(t.isPublished ? {} : { publishedAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      });
      if (!t.isPublished && t.notifyOnPublish) {
        const r = await notifyTestimonyPublished(t.id);
        if (r.status !== 'skipped') setNote(`Published. ${describe(r)}`);
        else setNote('Published.');
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const remove = async (t: Testimony) => {
    if (!confirm(`Delete “${t.title}” permanently? It disappears from the app immediately. (An uploaded video or image stays in your Cloudinary library.)`)) return;
    await deleteDoc(doc(db, 'testimonies', t.id)).catch((e: Error) => setErr(e.message));
  };

  return (
    <>
      <div className="row between"><h1>Testimonies</h1><button className="btn" onClick={() => go({ name: 'editor' })}>+ New testimony</button></div>
      <p className="muted">Publishing or unpublishing here updates the app straight away.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <input type="text" placeholder="Search title, name, category…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        {(['all', 'published', 'draft'] as const).map((f) => (
          <button key={f} className={`btn small ${filter === f ? '' : 'ghost'}`} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
        ))}
      </div>
      {err ? <Message kind="err">{err}</Message> : null}
      {note ? <Message kind="ok">{note}</Message> : null}
      <div className="card table-wrap">
        {!items ? <p className="muted">Loading…</p> : shown.length === 0 ? <p className="muted">Nothing here yet.</p> : (
          <table>
            <thead><tr><th></th><th>TITLE</th><th>STATUS</th><th>ADDED</th><th></th></tr></thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id}>
                  <td>{t.thumbnail ? <img className="thumb" src={t.thumbnail} alt="" /> : <div className="thumb" />}</td>
                  <td>
                    <b>{t.title || 'Untitled'}</b>{t.isFeatured ? ' ⭐' : ''}
                    <div className="small muted">{[t.authorName, t.category, fmtDuration(t.duration)].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td><span className={`pill ${t.isPublished ? 'ok' : 'draft'}`}>{t.isPublished ? 'PUBLISHED' : 'DRAFT'}</span></td>
                  <td className="small muted">{fmtDate(t.createdAt)}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn small ghost" onClick={() => go({ name: 'editor', id: t.id })}>Edit</button>
                      <button className="btn small" onClick={() => void togglePublish(t)}>{t.isPublished ? 'Unpublish' : 'Publish'}</button>
                      <button className="btn small danger" onClick={() => void remove(t)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
