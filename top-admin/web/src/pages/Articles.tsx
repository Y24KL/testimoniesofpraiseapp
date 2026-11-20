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
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/feedback';
import { EmptyState, FilterTabs, GlassCard, LoadingList, PageHeader, SearchInput, StatusBadge } from '../components/ui';

interface Props {
  go: (r: Route) => void;
}

export function Articles({ go }: Props) {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const confirm = useConfirm();

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
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };

  const remove = async (a: Article) => {
    if (!(await confirm({ title: `Delete “${a.title}”?`, message: 'The article disappears from the app and website. This can’t be undone.', confirmLabel: 'Delete permanently', danger: true }))) return;
    try {
      await deleteDoc(doc(db, 'articles', a.id));
      setOk('Article deleted.');
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };

  const needle = search.trim().toLowerCase();
  const all = articles ?? [];
  const shown = all.filter(
    (a) => (filter === 'all' || (filter === 'published') === a.isPublished) && (!needle || [a.title, a.category ?? '', a.author ?? ''].some((v) => v.toLowerCase().includes(needle))),
  );
  const n = (f: typeof filter) => all.filter((a) => f === 'all' || (f === 'published') === a.isPublished).length;

  return (
    <>
      <PageHeader
        eyebrow="Content Studio"
        title="Articles & Updates"
        sub="Write and publish announcements, devotionals and church updates for app and website readers."
        actions={<button type="button" className="btn primary" onClick={() => go({ name: 'articleEditor' })}><Icon name="plus" size={16} />Write new article</button>}
      />
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, category or author…" label="Search articles" />
        <FilterTabs
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All', count: articles ? n('all') : undefined },
            { id: 'published', label: 'Published', count: articles ? n('published') : undefined },
            { id: 'draft', label: 'Drafts', count: articles ? n('draft') : undefined },
          ]}
        />
      </div>

      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <GlassCard className="table-card">
        {articles === null ? (
          <div style={{ padding: 20 }}><LoadingList rows={4} /></div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon="newspaper"
            title={all.length === 0 ? 'No articles yet' : 'No articles match'}
            action={all.length === 0 ? <button type="button" className="btn primary" onClick={() => go({ name: 'articleEditor' })}><Icon name="plus" size={16} />Write the first article</button> : undefined}
          >
            {all.length === 0 ? 'Published articles appear in the app’s Updates section.' : 'Try another search or status filter.'}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th aria-label="Cover"></th><th>Title</th><th>Author</th><th>Date</th><th>Status</th><th aria-label="Actions"></th></tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.id}>
                    <td>{a.coverImageUrl ? <img className="thumb" src={a.coverImageUrl} alt="" loading="lazy" /> : <div className="thumb center-icon"><Icon name="fileText" size={18} /></div>}</td>
                    <td className="title-cell">
                      <b>{a.title}</b>
                      {a.category ? <div className="small muted">{a.category}</div> : null}
                    </td>
                    <td className="small muted">{a.author || 'TOP Editorial'}</td>
                    <td className="small muted nowrap">{a.publishedAt ? fmtDate(a.publishedAt) : a.createdAt ? fmtDate(a.createdAt) : '—'}</td>
                    <td><StatusBadge kind={a.isPublished ? 'ok' : 'draft'}>{a.isPublished ? 'Published' : 'Draft'}</StatusBadge></td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn small ghost" onClick={() => go({ name: 'articleEditor', id: a.id })}><Icon name="edit" size={14} />Edit</button>
                        <button type="button" className={`btn small ${a.isPublished ? 'ghost' : 'success'}`} onClick={() => void togglePublish(a)}>{a.isPublished ? 'Unpublish' : 'Publish'}</button>
                        <button type="button" className="btn small danger" aria-label={`Delete ${a.title}`} onClick={() => void remove(a)}><Icon name="trash" size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </>
  );
}
