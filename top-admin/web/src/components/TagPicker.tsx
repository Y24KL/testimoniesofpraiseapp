import { useState } from 'react';
import { Icon } from './Icon';
import { CONTENT_TAGS, MAX_TAGS, TAG_LABELS, suggestTags, type ContentTag, type TagSource } from '../tags';

/**
 * Interest tags for one content item. Admins pick up to MAX_TAGS tags; "Suggest" asks Praxiom (keyword
 * fallback on the server) and adds its picks, which the admin can still remove before saving.
 */
export function TagPicker({ value, onChange, source, disabled }: { value: ContentTag[]; onChange: (next: ContentTag[]) => void; source: () => TagSource; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const toggle = (t: ContentTag) => {
    if (value.includes(t)) onChange(value.filter((x) => x !== t));
    else if (value.length < MAX_TAGS) onChange([...value, t]);
  };

  const suggest = async () => {
    const s = source();
    if (!s.title.trim()) return setNote('Add a title first.');
    setBusy(true);
    setNote('');
    try {
      const { results } = await suggestTags([s]);
      const r = results[0];
      if (!r || r.tags.length === 0) {
        setNote('No clear match. Choose tags yourself.');
        return;
      }
      const merged = [...value];
      for (const t of r.tags) if (!merged.includes(t) && merged.length < MAX_TAGS) merged.push(t);
      onChange(merged);
      setNote(`${r.source === 'praxiom' ? 'Suggested by Praxiom' : 'Suggested from keywords'}: ${r.tags.map((t) => TAG_LABELS[t]).join(', ')}. Check them before saving.`);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="f">
      <span>Interest tags <span className="muted small">({value.length}/{MAX_TAGS}) · used for recommendations</span></span>
      <div className="chips">
        {CONTENT_TAGS.map((t) => {
          const on = value.includes(t);
          return (
            <button key={t} type="button" className="chip-check" aria-pressed={on} disabled={disabled || (!on && value.length >= MAX_TAGS)} onClick={() => toggle(t)}>
              {on ? <Icon name="check" size={13} /> : null}
              {TAG_LABELS[t]}
            </button>
          );
        })}
      </div>
      <div className="row gap" style={{ gap: 10, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn small ghost" disabled={disabled || busy} onClick={() => void suggest()}>
          {busy ? <span className="spin sm" aria-hidden="true" /> : <Icon name="sparkles" size={14} />}Suggest tags
        </button>
        {note ? <span className="small muted" role="status">{note}</span> : null}
      </div>
    </div>
  );
}
