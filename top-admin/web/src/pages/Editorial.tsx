import { useEffect, useState } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Check, Field, Message } from '../components/Field';

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

  if (!loaded) return <p>Loading the daily discovery settings…</p>;

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 880 }}>
      <header>
        <h1 style={{ margin: 0 }}>Daily discovery</h1>
        <p style={{ margin: '4px 0 0', opacity: 0.8 }}>
          What Home shows in the Daily discovery section. An empty part is hidden. Nothing is invented to fill it.
        </p>
      </header>
      {err && <Message kind="err">{err}</Message>}
      {ok && <Message kind="ok">{ok}</Message>}

      <section style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Inspiration lines</h2>
        <p style={{ margin: 0, opacity: 0.8 }}>One per line. Add a source after " | ", for example: The Lord is my shepherd | Psalm 23:1. One line is shown each day, in turn.</p>
        <textarea rows={6} value={inspirations} onChange={(e) => setInspirations(e.target.value)} aria-label="Inspiration lines" />
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Radio programme</h2>
        {prefilled && <Message kind="warn">Pre-filled from the programme brief: Wednesdays at 1 PM GMT+1 (12:00 UTC). Check it, then save. It shows to people only when Confirmed is ticked.</Message>}
        {radio.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <Field label="Day">
              <select value={r.weekday} onChange={(e) => setRadioAt(i, { weekday: e.target.value as Radio['weekday'] })}>
                {WEEKDAYS.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Local time (HH:MM)">
              <input value={r.localTime} onChange={(e) => setRadioAt(i, { localTime: e.target.value })} style={{ width: 90 }} />
            </Field>
            <Field label="UTC offset (minutes)">
              <input type="number" value={r.utcOffsetMinutes} onChange={(e) => setRadioAt(i, { utcOffsetMinutes: Number(e.target.value) })} style={{ width: 110 }} />
            </Field>
            <Field label="Zone label">
              <input value={r.timeZoneLabel} onChange={(e) => setRadioAt(i, { timeZoneLabel: e.target.value })} style={{ width: 100 }} />
            </Field>
            <Field label="Title">
              <input value={r.title} onChange={(e) => setRadioAt(i, { title: e.target.value })} />
            </Field>
            <Check checked={r.confirmed} onChange={(v) => setRadioAt(i, { confirmed: v })} label="Confirmed" />
            <button type="button" onClick={() => setRadio(radio.filter((_, idx) => idx !== i))}>Remove</button>
          </div>
        ))}
        {radio.length < MAX_RADIO && (
          <div>
            <button type="button" onClick={() => setRadio([...radio, { ...BRIEF_RADIO, confirmed: false, title: '' }])}>Add a radio entry</button>
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Featured picks</h2>
        <p style={{ margin: 0, opacity: 0.8 }}>Paste the id of a published item. It is shown only while it stays published.</p>
        <Field label="Testimony id"><input value={featured.testimony} onChange={(e) => setFeatured({ ...featured, testimony: e.target.value })} /></Field>
        <Field label="Lyrical analysis id"><input value={featured.lyrical} onChange={(e) => setFeatured({ ...featured, lyrical: e.target.value })} /></Field>
        <Field label="Article id"><input value={featured.article} onChange={(e) => setFeatured({ ...featured, article: e.target.value })} /></Field>
      </section>

      <section style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Community highlights</h2>
        <p style={{ margin: 0, opacity: 0.8 }}>Only published featured choirs are listed. Choose up to {MAX_HIGHLIGHTS}.</p>
        {choirs.length === 0 && <p style={{ margin: 0 }}>No published choirs yet.</p>}
        {choirs.map((c) => (
          <Check key={c.id} checked={highlights.includes(c.id)} onChange={() => toggleHighlight(c.id)} label={c.name} />
        ))}
      </section>

      <div>
        <button type="button" disabled={busy} onClick={() => void save()}>Save daily discovery</button>
      </div>
    </div>
  );
}
