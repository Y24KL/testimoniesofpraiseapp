import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { describe, notifyTestimonyPublished } from '../notify';
import { fmtDate, fmtDuration, testimonyFromDoc } from '../lib';
import type { Route, Testimony } from '../types';
import { Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/feedback';
import { EmptyState, FilterTabs, GlassCard, LoadingList, PageHeader, SearchInput, StatusBadge } from '../components/ui';
import { reindexPublishedTestimonies, indexTestimony } from '../aiSearchIndex';

export function Testimonies({ go }: { go: (r: Route) => void }) {
  const [items, setItems] = useState<Testimony[] | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [indexingAi, setIndexingAi] = useState(false);
  const [indexProgress, setIndexProgress] = useState('');
  const confirm = useConfirm();

  const rebuildAiIndex = async () => {
    if (indexingAi) return;
    setIndexingAi(true); setIndexProgress('Preparing the published testimony index…'); setErr(''); setNote('');
    try {
      const result = await reindexPublishedTestimonies((done, scanned) => setIndexProgress(`Indexed ${done} published testimonies (${scanned} records scanned)…`));
      setNote(`AI search index refreshed for ${result.indexed} published testimonies.`);
      setIndexProgress('');
    } catch (e) {
      setErr(`AI search index rebuild failed: ${(e as Error).message}`);
    } finally {
      setIndexingAi(false);
    }
  };

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
      if (t.notifyOnPublish && !(await confirm({ title: `Publish “${t.title}”?`, message: 'This sends a push notification to app users.', confirmLabel: 'Publish and notify' }))) return;
    }
    try {
      await updateDoc(doc(db, 'testimonies', t.id), {
        isPublished: !t.isPublished,
        ...(t.isPublished ? {} : { publishedAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      });
      if (!t.isPublished) {
        try {
          await indexTestimony({ id: t.id, title: t.title, description: t.description, authorName: t.authorName, category: t.category, keywords: t.keywords });
        } catch (indexError) {
          console.warn('[AI search] testimony published but embedding was not refreshed; use Rebuild AI search index.', indexError);
        }
      }
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
    if (!(await confirm({ title: `Delete “${t.title}”?`, message: 'It disappears from the app immediately. An uploaded video or image stays in your Cloudinary library.', confirmLabel: 'Delete permanently', danger: true }))) return;
    await deleteDoc(doc(db, 'testimonies', t.id)).catch((e: Error) => setErr(e.message));
  };

  const counts = useMemo(() => {
    const all = items ?? [];
    const published = all.filter((t) => t.isPublished).length;
    return { all: all.length, published, draft: all.length - published };
  }, [items]);

  return (
    <>
      <PageHeader
        eyebrow="Content Studio"
        title="Video Testimonies"
        sub="Publishing or unpublishing here updates the app straight away."
        actions={
          <>
            <button type="button" className="btn ghost" disabled={indexingAi} onClick={() => void rebuildAiIndex()}>
              <Icon name="cpu" size={16} className={indexingAi ? 'spinning' : undefined} />
              {indexingAi ? 'Indexing AI search…' : 'Rebuild AI search index'}
            </button>
            <button type="button" className="btn primary" onClick={() => go({ name: 'editor' })}><Icon name="plus" size={16} />New testimony</button>
          </>
        }
      />
      {indexProgress ? <Message kind="warn">{indexProgress}</Message> : null}
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search title, name, category, keyword…" label="Search testimonies" />
        <FilterTabs
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All', count: items ? counts.all : undefined },
            { id: 'published', label: 'Published', count: items ? counts.published : undefined },
            { id: 'draft', label: 'Drafts', count: items ? counts.draft : undefined },
          ]}
        />
      </div>
      {err ? <Message kind="err">{err}</Message> : null}
      {note ? <Message kind="ok">{note}</Message> : null}
      <GlassCard className="table-card">
        {!items ? (
          <div style={{ padding: 20 }}><LoadingList rows={5} /></div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon="video"
            title={items.length === 0 ? 'No testimonies yet' : 'No testimonies match'}
            action={items.length === 0 ? <button type="button" className="btn primary" onClick={() => go({ name: 'editor' })}><Icon name="plus" size={16} />Add the first testimony</button> : undefined}
          >
            {items.length === 0 ? 'Add a video testimony to see it here.' : 'Try another search or status filter.'}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th aria-label="Thumbnail"></th><th>Title</th><th>Status</th><th>Added</th><th aria-label="Actions"></th></tr></thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id}>
                    <td>{t.thumbnail ? <img className="thumb" src={t.thumbnail} alt="" loading="lazy" /> : <div className="thumb" />}</td>
                    <td className="title-cell">
                      <b>{t.title || 'Untitled'}{t.isFeatured ? <span className="star" title="Featured"><Icon name="star" size={14} label="Featured" /></span> : null}</b>
                      <div className="small muted">{[t.authorName, t.category, fmtDuration(t.duration)].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td><StatusBadge kind={t.isPublished ? 'ok' : 'draft'}>{t.isPublished ? 'Published' : 'Draft'}</StatusBadge></td>
                    <td className="small muted nowrap">{fmtDate(t.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn small ghost" onClick={() => go({ name: 'editor', id: t.id })}><Icon name="edit" size={14} />Edit</button>
                        <button type="button" className={`btn small ${t.isPublished ? 'ghost' : 'success'}`} onClick={() => void togglePublish(t)}>{t.isPublished ? 'Unpublish' : 'Publish'}</button>
                        <button type="button" className="btn small danger" aria-label={`Delete ${t.title}`} onClick={() => void remove(t)}><Icon name="trash" size={14} /></button>
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
