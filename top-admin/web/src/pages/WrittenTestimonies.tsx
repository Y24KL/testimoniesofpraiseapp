import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { fmtDate } from '../lib';
import { describe, notifyWrittenPublished } from '../notify';
import type { Route } from '../types';
import { Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/feedback';
import { EmptyState, FilterTabs, GlassCard, LoadingList, PageHeader, SearchInput, StatusBadge } from '../components/ui';

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
  const confirm = useConfirm();

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
    if (!publish && !(await confirm({ title: `Unpublish “${w.title}”?`, message: 'It disappears from the app and website right away.', confirmLabel: 'Unpublish' }))) return;
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
    if (!(await confirm({ title: `Delete “${w.title}”?`, message: 'This can’t be undone. Unpublish it instead if you may want it back.', confirmLabel: 'Delete permanently', danger: true }))) return;
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

  const n = (f: Filter) => (items ?? []).filter((w) => f === 'all' || (f === 'published') === w.isPublished).length;

  return (
    <>
      <PageHeader
        eyebrow="Content Studio"
        title="Written Testimonies"
        sub="Text testimonies in the app’s and website’s “Written testimonies” library. Only published ones are visible. You can also turn an approved submission into a written testimony from Testimony Submissions."
        actions={<button type="button" className="btn primary" onClick={() => go({ name: 'writtenEditor' })}><Icon name="plus" size={16} />New written testimony</button>}
      />
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, name, church or text…" label="Search written testimonies" />
        <FilterTabs
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All', count: items ? n('all') : undefined },
            { id: 'published', label: 'Published', count: items ? n('published') : undefined },
            { id: 'draft', label: 'Drafts', count: items ? n('draft') : undefined },
          ]}
        />
      </div>
      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}
      {!items ? (
        <GlassCard><LoadingList rows={3} /></GlassCard>
      ) : shown.length === 0 ? (
        <GlassCard>
          <EmptyState icon="fileText" title={items.length === 0 ? 'No written testimonies yet' : 'Nothing matches'}>
            {items.length === 0 ? 'Create one, or convert an approved submission.' : 'Try another search or status filter.'}
          </EmptyState>
        </GlassCard>
      ) : (
        shown.map((w) => (
          <GlassCard key={w.id} as="article" className="item-card">
            <div className="item-head">
              <div style={{ minWidth: 0 }}>
                <div className="t">{w.title}</div>
                <div className="m">{[w.authorName, w.churchZone, w.category, fmtDate(w.createdAt)].filter(Boolean).join(' · ')}</div>
              </div>
              <StatusBadge kind={w.isPublished ? 'ok' : 'draft'}>{w.isPublished ? 'Published' : 'Draft'}</StatusBadge>
            </div>
            <div className="quote clamp-5">{w.body}</div>
            <div className="actions">
              <button type="button" className="btn small ghost" onClick={() => go({ name: 'writtenEditor', id: w.id })}><Icon name="edit" size={14} />Edit</button>
              <button type="button" className={`btn small ${w.isPublished ? 'ghost' : 'success'}`} disabled={busyId === w.id} onClick={() => void togglePublish(w)}>
                {w.isPublished ? 'Unpublish' : 'Publish'}
              </button>
              <button type="button" className="btn small danger" disabled={busyId === w.id} onClick={() => void remove(w)}><Icon name="trash" size={14} />Delete</button>
            </div>
          </GlassCard>
        ))
      )}
    </>
  );
}
