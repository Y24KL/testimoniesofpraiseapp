import { useState } from 'react';
import { collection, doc, getDocs, limit, query, updateDoc, type DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { Message } from './Field';
import { Icon } from './Icon';
import { EmptyState, FilterTabs, GlassCard, SectionHeader } from './ui';
import { CONTENT_TAGS, MAX_TAGS, SUGGEST_BATCH, TAG_LABELS, sanitizeTags, suggestTags, type ContentTag, type TagSource, type TaggableType } from '../tags';

/**
 * Tags existing content in batches: lists items without interest tags, asks for suggestions (Praxiom with a
 * keyword fallback), lets the admin adjust each row, and saves only what the admin confirms.
 */

const KINDS: { id: TaggableType; label: string; collection: string; toSource: (d: DocumentData) => TagSource }[] = [
  { id: 'testimony', label: 'Video testimonies', collection: 'testimonies', toSource: (d) => ({ contentType: 'testimony', title: str(d.title), description: str(d.description), category: str(d.category), keywords: Array.isArray(d.keywords) ? d.keywords.filter((k: unknown) => typeof k === 'string') : [] }) },
  { id: 'written', label: 'Written', collection: 'writtenTestimonies', toSource: (d) => ({ contentType: 'written', title: str(d.title), category: str(d.category), excerpt: str(d.body).slice(0, 2500) }) },
  { id: 'article', label: 'Articles', collection: 'articles', toSource: (d) => ({ contentType: 'article', title: str(d.title), category: str(d.category), excerpt: str(d.body).slice(0, 2500) }) },
  { id: 'lyrical', label: 'Lyrical Analysis', collection: 'lyricalAnalyses', toSource: (d) => ({ contentType: 'lyrical', title: str(d.title), description: `${str(d.songTitle)} ${str(d.artistName)} ${str(d.description)}`.trim() }) },
  { id: 'loveworld', label: 'LoveWorld Singers', collection: 'loveworldSingersVideos', toSource: (d) => ({ contentType: 'loveworld', title: str(d.title), description: str(d.description) }) },
];
const SCAN_LIMIT = 300;

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

interface Row {
  id: string;
  title: string;
  source: TagSource;
  tags: ContentTag[];
  suggestedBy?: 'praxiom' | 'keywords';
  state: 'untagged' | 'suggested' | 'saving' | 'saved' | 'error';
  error?: string;
}

export function TagBackfill() {
  const [kind, setKind] = useState<TaggableType>('testimony');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const k = KINDS.find((x) => x.id === kind)!;

  const load = async (next: TaggableType = kind) => {
    const kk = KINDS.find((x) => x.id === next)!;
    setBusy(true);
    setErr('');
    setNote('');
    try {
      const snap = await getDocs(query(collection(db, kk.collection), limit(SCAN_LIMIT)));
      setTotal(snap.size);
      setRows(
        snap.docs
          .filter((d) => sanitizeTags(d.data().tags).length === 0)
          .map((d) => {
            const source = kk.toSource(d.data());
            return { id: d.id, title: source.title || '(untitled)', source, tags: [], state: 'untagged' as const };
          }),
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const update = (id: string, patch: Partial<Row>) => setRows((rs) => (rs ? rs.map((r) => (r.id === id ? { ...r, ...patch } : r)) : rs));

  const suggestNext = async () => {
    if (!rows) return;
    const batch = rows.filter((r) => r.state === 'untagged').slice(0, SUGGEST_BATCH);
    if (!batch.length) return;
    setBusy(true);
    setErr('');
    try {
      const { results, ai } = await suggestTags(batch.map((r) => r.source));
      setRows((rs) => rs?.map((r) => {
        const i = batch.findIndex((b) => b.id === r.id);
        if (i < 0) return r;
        const s = results[i];
        return { ...r, tags: s?.tags ?? [], suggestedBy: s?.source, state: 'suggested' };
      }) ?? rs);
      setNote(ai === 'ok' ? 'Suggestions from Praxiom. Check each row, then save.' : 'Praxiom was unavailable, so these come from keywords. Check each row, then save.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async (r: Row) => {
    if (!r.tags.length) return;
    update(r.id, { state: 'saving', error: undefined });
    try {
      await updateDoc(doc(db, k.collection, r.id), { tags: r.tags });
      update(r.id, { state: 'saved' });
    } catch (e) {
      update(r.id, { state: 'error', error: (e as Error).message });
    }
  };

  const saveAll = async () => {
    for (const r of rows ?? []) if (r.state === 'suggested' && r.tags.length) await save(r);
  };

  const toggle = (r: Row, t: ContentTag) => {
    if (r.state === 'saved' || r.state === 'saving') return;
    const tags = r.tags.includes(t) ? r.tags.filter((x) => x !== t) : r.tags.length < MAX_TAGS ? [...r.tags, t] : r.tags;
    update(r.id, { tags, state: r.state === 'untagged' ? 'suggested' : r.state });
  };

  const waiting = rows?.filter((r) => r.state === 'untagged').length ?? 0;
  const ready = rows?.filter((r) => r.state === 'suggested' && r.tags.length).length ?? 0;
  const saved = rows?.filter((r) => r.state === 'saved').length ?? 0;
  const shown = (rows ?? []).filter((r) => r.state !== 'untagged');

  return (
    <GlassCard>
      <SectionHeader icon="sparkles" title="Interest tags for existing content" hint="Used for personal recommendations. Nothing is saved until you confirm it." />
      <div className="toolbar">
        <FilterTabs label="Content type" value={kind} onChange={(v) => { setKind(v); setRows(null); void load(v); }} options={KINDS.map((x) => ({ id: x.id, label: x.label }))} />
      </div>
      {err ? <Message kind="err">{err}</Message> : null}
      {note ? <Message kind="ok">{note}</Message> : null}

      {rows === null ? (
        <button type="button" className="btn primary" disabled={busy} onClick={() => void load()}>
          {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="search" size={16} />}Find {k.label.toLowerCase()} without tags
        </button>
      ) : (
        <>
          <p className="small muted">
            {rows.length} of {total} {k.label.toLowerCase()} have no tags{total >= SCAN_LIMIT ? ` (first ${SCAN_LIMIT} checked)` : ''}. {waiting} still to suggest · {ready} ready to save · {saved} saved.
          </p>
          <div className="row gap" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <button type="button" className="btn primary" disabled={busy || waiting === 0} onClick={() => void suggestNext()}>
              {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="sparkles" size={16} />}Suggest for the next {Math.min(SUGGEST_BATCH, waiting)}
            </button>
            <button type="button" className="btn success" disabled={busy || ready === 0} onClick={() => void saveAll()}>
              <Icon name="check" size={16} />Save all ready ({ready})
            </button>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon="checkCircle" title="Everything here is tagged">Nothing to do for {k.label.toLowerCase()}.</EmptyState>
          ) : null}
          {shown.map((r) => (
            <div key={r.id} className="item-card" style={{ padding: '12px 0', borderTop: '1px solid var(--glass-border)' }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <b>{r.title}</b>
                <span className="small muted nowrap">
                  {r.state === 'saved' ? 'Saved' : r.state === 'saving' ? 'Saving…' : r.state === 'error' ? `Not saved: ${r.error}` : r.suggestedBy === 'praxiom' ? 'Praxiom' : r.suggestedBy === 'keywords' ? 'Keywords' : ''}
                </span>
              </div>
              <div className="chips" style={{ marginTop: 8 }}>
                {CONTENT_TAGS.map((t) => (
                  <button key={t} type="button" className="chip-check" aria-pressed={r.tags.includes(t)} disabled={r.state === 'saved' || r.state === 'saving' || (!r.tags.includes(t) && r.tags.length >= MAX_TAGS)} onClick={() => toggle(r, t)}>
                    {TAG_LABELS[t]}
                  </button>
                ))}
              </div>
              {r.state === 'suggested' || r.state === 'error' ? (
                <button type="button" className="btn small ghost" style={{ marginTop: 8 }} disabled={!r.tags.length} onClick={() => void save(r)}>
                  <Icon name="check" size={14} />{r.tags.length ? 'Save these tags' : 'Choose at least one tag'}
                </button>
              ) : null}
            </div>
          ))}
        </>
      )}
    </GlassCard>
  );
}
