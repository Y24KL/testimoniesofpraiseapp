import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fmtDate } from '../lib';
import type { Article, Route } from '../types';
import { Message } from '../components/Field';

interface Props {
  go: (r: Route) => void;
}

export function Articles({ go }: Props) {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'articles'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setArticles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Article, 'id'>) })));
      },
      (e) => setErr(e.message)
    );
  }, []);

  const togglePublish = async (a: Article) => {
    try {
      const willPublish = !a.isPublished;
      await updateDoc(doc(db, 'articles', a.id), {
        isPublished: willPublish,
        publishedAt: willPublish ? serverTimestamp() : a.publishedAt ?? null,
        updatedAt: serverTimestamp(),
      });
      setOk(`Article marked as ${willPublish ? 'Published' : 'Draft'}.`);
    } catch (ex: any) {
      setErr(ex.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'articles', id));
      setOk('Article deleted.');
    } catch (ex: any) {
      setErr(ex.message);
    }
  };

  return (
    <>
      <div className="row between">
        <div>
          <h1>Articles & Updates</h1>
          <p className="muted">
            Write and publish announcements, devotionals, written testimonies, and church updates for mobile and web readers.
          </p>
        </div>
        <button className="btn primary" onClick={() => go({ name: 'articleEditor' })}>
          + Write New Article
        </button>
      </div>

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      {articles === null ? (
        <p className="muted">Loading articles…</p>
      ) : articles.length === 0 ? (
        <div className="card center" style={{ padding: 48 }}>
          <p className="muted">No articles written yet.</p>
          <button className="btn primary" onClick={() => go({ name: 'articleEditor' })}>
            Create Your First Article
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '12px 16px' }}>Cover</th>
                <th style={{ padding: '12px 16px' }}>Title & Category</th>
                <th style={{ padding: '12px 16px' }}>Author</th>
                <th style={{ padding: '12px 16px' }}>Published</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', width: 80 }}>
                    {a.coverImageUrl ? (
                      <img
                        src={a.coverImageUrl}
                        alt=""
                        style={{ width: 64, height: 42, objectFit: 'cover', borderRadius: 4 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 42,
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          color: 'var(--muted)',
                        }}
                      >
                        Text
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <b>{a.title}</b>
                    {a.category ? (
                      <span className="pill" style={{ marginLeft: 8, fontSize: 11 }}>
                        {a.category}
                      </span>
                    ) : null}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 14 }}>
                    {a.author || 'TOP Editorial'}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--muted)' }}>
                    {a.publishedAt ? fmtDate(a.publishedAt) : a.createdAt ? fmtDate(a.createdAt) : '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <button
                      className={`pill ${a.isPublished ? 'ok' : 'ghost'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={() => togglePublish(a)}
                    >
                      {a.isPublished ? 'Live' : 'Draft'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="btn small ghost"
                      onClick={() => go({ name: 'articleEditor', id: a.id })}
                    >
                      Edit
                    </button>
                    <button
                      className="btn small danger"
                      style={{ marginLeft: 6 }}
                      onClick={() => remove(a.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
