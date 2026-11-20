import { useEffect, useState } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Check, Field, Message } from '../components/Field';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, GlassCard, LoadingList, PageHeader, SectionHeader } from '../components/ui';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const MAX_INSPIRATIONS = 30;
const MAX_RADIO = 7;
const MAX_HIGHLIGHTS = 6;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface Radio {
  weekday: (typeof WEEKDAYS)[number];
  localTime: string;
  utcOffsetMinutes: number;
  timeZoneLabel: string;
  title: string;
  confirmed: boolean;
}

/**
 * The Wednesday programme from the brief: 1 PM GMT+1, which is 12:00 UTC. It is pre-filled, but an admin must
 * check it and save. People see it only while "confirmed" is ticked.
 */
const BRIEF_RADIO: Radio = { weekday: 'wednesday', localTime: '13:00', utcOffsetMinutes: 60, timeZoneLabel: 'GMT+1', title: 'LoveWorld Radio', confirmed: true };

export function Editorial() {
  const [inspirations, setInspirations] = useState('');
  const [radio, setRadio] = useState<Radio[]>([BRIEF_RADIO]);
  const [prefilled, setPrefilled] = useState(true);
  const [featured, setFeatured] = useState({ testimony: '', lyrical: '', article: '' });
  const [highlights, setHighlights] = useState<string[]>([]);
  const [choirs, setChoirs] = useState<{ id: string; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [options, setOptions] = useState<Record<'testimony' | 'lyrical' | 'article', { id: string; title: string }[]>>({ testimony: [], lyrical: [], article: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(
    () =>
      onSnapshot(doc(db, 'settings', 'editorial'), (s) => {
        const d = (s.data() ?? {}) as Record<string, unknown>;
        const lines = Array.isArray(d.inspirations) ? d.inspirations : [];
        setInspirations(lines.map((x) => {
          const i = x as { text?: string; source?: string };
          return i.source ? `${i.text ?? ''} | ${i.source}` : i.text ?? '';
        }).join('\n'));
        if (Array.isArray(d.radioSchedule)) {
          setRadio(d.radioSchedule as Radio[]);
          setPrefilled(false);
        }
        const f = (d.featuredIds ?? {}) as Record<string, string>;
        setFeatured({ testimony: f.testimony ?? '', lyrical: f.lyrical ?? '', article: f.article ?? '' });
        setHighlights(Array.isArray(d.highlightChoirIds) ? (d.highlightChoirIds as string[]) : []);
        setLoaded(true);
      }, (e) => setErr(e.message)),
    [],
  );

  // Recent published items, offered as suggestions for the featured picks. Ids can still be pasted by hand.
  useEffect(() => {
    const load = (col: string, field: string, value: unknown, titleField = 'title') =>
      getDocs(query(collection(db, col), where(field, '==', value), limit(100)))
        .then((s) => s.docs.map((d) => ({ id: d.id, title: String(d.data()[titleField] ?? d.id) })))
        .catch(() => [] as { id: string; title: string }[]);
    void Promise.all([load('testimonies', 'isPublished', true), load('lyricalAnalyses', 'status', 'published'), load('articles', 'isPublished', true)]).then(([testimony, lyrical, article]) =>
      setOptions({ testimony, lyrical, article }),
    );
  }, []);

  // Only published choirs can be highlighted, so only those are offered.
  useEffect(() => {
    getDocs(query(collection(db, 'featuredChoirs'), where('isPublished', '==', true), limit(100)))
      .then((s) => setChoirs(s.docs.map((d) => ({ id: d.id, name: String(d.data().groupName ?? d.id) }))))
      .catch(() => setChoirs([]));
  }, []);

  const parseLines = () => {
    const out: { text: string; source: string }[] = [];
    for (const raw of inspirations.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const [text, source = ''] = line.split(' | ');
      out.push({ text: text.trim().slice(0, 280), source: source.trim().slice(0, 120) });
    }
    return out;
  };

  const validate = (): string | null => {
    const lines = parseLines();
    if (lines.length > MAX_INSPIRATIONS) return `Use at most ${MAX_INSPIRATIONS} inspiration lines.`;
    if (radio.length > MAX_RADIO) return `Use at most ${MAX_RADIO} radio entries.`;
    for (const r of radio) {
      if (!TIME.test(r.localTime)) return `"${r.localTime}" is not a time. Use HH:MM, such as 13:00.`;
      if (!Number.isInteger(r.utcOffsetMinutes) || Math.abs(r.utcOffsetMinutes) > 840) return 'The UTC offset must be whole minutes, such as 60 for GMT+1.';
      if (!r.title.trim()) return 'Every radio entry needs a title.';
    }
    if (highlights.length > MAX_HIGHLIGHTS) return `Choose at most ${MAX_HIGHLIGHTS} highlighted choirs.`;
    return null;
  };

  const save = async () => {
    setErr('');
    setOk('');
    const problem = validate();
    if (problem) return setErr(problem);
    setBusy(true);
    try {
      await setDoc(doc(db, 'settings', 'editorial'), {
        inspirations: parseLines(),
        radioSchedule: radio.map((r) => ({ ...r, title: r.title.trim().slice(0, 120), timeZoneLabel: r.timeZoneLabel.trim().slice(0, 40) })),
        featuredIds: Object.fromEntries(Object.entries(featured).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])),
        highlightChoirIds: highlights,
        updatedAt: serverTimestamp(),
      });
      setPrefilled(false);
      setOk('Saved. The Home screen updates for people who are signed in.');
    } catch (e) {
      setErr(`Could not save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const setRadioAt = (i: number, patch: Partial<Radio>) => setRadio(radio.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const toggleHighlight = (id: string) =>
    setHighlights(highlights.includes(id) ? highlights.filter((x) => x !== id) : highlights.length < MAX_HIGHLIGHTS ? [...highlights, id] : highlights);

  if (!loaded) {
    return (
      <>
        <PageHeader eyebrow="Content Studio" title="Daily Discovery" />
        {err ? <ErrorState title="Couldn’t load the daily discovery settings" message={err} /> : <GlassCard><LoadingList rows={4} /></GlassCard>}
      </>
    );
  }

  const pick = (key: keyof typeof featured, label: string, list: { id: string; title: string }[]) => {
    const match = list.find((o) => o.id === featured[key].trim());
    return (
      <label className="f">
        <span>{label}</span>
        <input list={`pick-${key}`} value={featured[key]} onChange={(e) => setFeatured({ ...featured, [key]: e.target.value })} placeholder={list.length ? 'Type to search titles, or paste an id' : 'Paste the item id'} />
        <datalist id={`pick-${key}`}>{list.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</datalist>
        <span className="f-hint">
          {!featured[key].trim() ? 'Nothing featured.' : match ? <>Featuring <b className="gold">{match.title}</b></> : 'Not among the latest published items. It shows only if that id is published.'}
        </span>
      </label>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Content Studio"
        title="Daily Discovery"
        sub="What the app’s Home screen shows in its Daily Discovery section. An empty part is hidden; nothing is invented to fill it."
        actions={<button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>{busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="check" size={16} />}{busy ? 'Saving…' : 'Save daily discovery'}</button>}
      />
      {err ? <Message kind="err">{err}</Message> : null}
      {ok ? <Message kind="ok">{ok}</Message> : null}

      <div className="split">
        <GlassCard>
          <SectionHeader icon="sparkles" title="Inspiration lines" hint={`${parseLines().length} of ${MAX_INSPIRATIONS} lines. One is shown each day, in turn.`} />
          <Field label="One per line" hint="Add a source after “ | ”, for example: The Lord is my shepherd | Psalm 23:1">
            <textarea rows={9} value={inspirations} onChange={(e) => setInspirations(e.target.value)} aria-label="Inspiration lines" />
          </Field>
        </GlassCard>

        <GlassCard>
          <SectionHeader icon="star" title="Featured picks" hint="Shown only while the item stays published." />
          {pick('testimony', 'Testimony', options.testimony)}
          {pick('lyrical', 'Lyrical analysis', options.lyrical)}
          {pick('article', 'Article', options.article)}
        </GlassCard>
      </div>

      <GlassCard>
        <SectionHeader icon="radio" title="Radio programme" hint={`Up to ${MAX_RADIO} weekly entries. People see an entry only when it’s confirmed.`} actions={radio.length < MAX_RADIO ? <button type="button" className="btn small ghost" onClick={() => setRadio([...radio, { ...BRIEF_RADIO, confirmed: false, title: '' }])}><Icon name="plus" size={14} />Add entry</button> : undefined} />
        {prefilled ? <Message kind="warn">Pre-filled from the programme brief: Wednesdays at 1 PM GMT+1 (12:00 UTC). Check it, then save.</Message> : null}
        {radio.length === 0 ? <EmptyState icon="radio" title="No radio programme">Add an entry to show the weekly programme on Home.</EmptyState> : null}
        {radio.map((r, i) => (
          <div key={i} className="radio-entry">
            <Field label="Day">
              <select value={r.weekday} onChange={(e) => setRadioAt(i, { weekday: e.target.value as Radio['weekday'] })}>
                {WEEKDAYS.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Local time">
              <input value={r.localTime} onChange={(e) => setRadioAt(i, { localTime: e.target.value })} placeholder="13:00" />
            </Field>
            <Field label="UTC offset (min)">
              <input type="number" value={r.utcOffsetMinutes} onChange={(e) => setRadioAt(i, { utcOffsetMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="Zone label">
              <input value={r.timeZoneLabel} onChange={(e) => setRadioAt(i, { timeZoneLabel: e.target.value })} placeholder="GMT+1" />
            </Field>
            <label className="f wide">
              <span>Title</span>
              <input value={r.title} onChange={(e) => setRadioAt(i, { title: e.target.value })} />
            </label>
            <div className="end">
              <Check checked={r.confirmed} onChange={(v) => setRadioAt(i, { confirmed: v })} label="Confirmed" hint="Show this entry in the app." />
              <button type="button" className="btn small danger" onClick={() => setRadio(radio.filter((_, idx) => idx !== i))}><Icon name="trash" size={14} />Remove</button>
            </div>
          </div>
        ))}
      </GlassCard>

      <GlassCard>
        <SectionHeader icon="users" title="Community highlights" hint={`Published featured choirs only. ${highlights.length} of ${MAX_HIGHLIGHTS} chosen.`} />
        {choirs.length === 0 ? <EmptyState icon="users" title="No published choirs yet">Publish a group under Featured Choirs to highlight it here.</EmptyState> : null}
        <div className="chips">
          {choirs.map((c) => {
            const on = highlights.includes(c.id);
            return (
              <button key={c.id} type="button" className="chip-check" aria-pressed={on} disabled={!on && highlights.length >= MAX_HIGHLIGHTS} onClick={() => toggleHighlight(c.id)}>
                <Icon name={on ? 'checkCircle' : 'plus'} size={15} />{c.name}
              </button>
            );
          })}
        </div>
      </GlassCard>

      <div className="save-bar">
        <span className="small muted">Changes apply to Home for signed-in users after saving.</span>
        <button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save daily discovery'}</button>
      </div>
    </>
  );
}
