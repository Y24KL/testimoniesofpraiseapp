import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { NAV_ITEMS } from '../nav';
import type { Route } from '../types';
import { Icon, type IconName } from './Icon';

/**
 * Search across pages and content titles. Firestore has no full-text search, so on first use this loads
 * the 100 most recent items of each content type once per session and filters them in the browser.
 */
interface Hit { key: string; group: string; label: string; meta?: string; icon: IconName; route: Route }

const SOURCES: { collection: string; group: string; icon: IconName; title: (d: Record<string, unknown>) => string; route: (id: string) => Route }[] = [
  { collection: 'testimonies', group: 'Video Testimonies', icon: 'video', title: (d) => String(d.title ?? ''), route: (id) => ({ name: 'editor', id }) },
  { collection: 'writtenTestimonies', group: 'Written Testimonies', icon: 'fileText', title: (d) => String(d.title ?? ''), route: (id) => ({ name: 'writtenEditor', id }) },
  { collection: 'articles', group: 'Articles & Updates', icon: 'newspaper', title: (d) => String(d.title ?? ''), route: (id) => ({ name: 'articleEditor', id }) },
  { collection: 'lyricalAnalyses', group: 'Lyrical Analysis', icon: 'music', title: (d) => String(d.title ?? ''), route: () => ({ name: 'lyrical' }) },
  { collection: 'loveworldSingersVideos', group: 'LoveWorld Singers', icon: 'mic', title: (d) => String(d.title ?? ''), route: () => ({ name: 'singers' }) },
  { collection: 'featuredChoirs', group: 'Featured Choirs', icon: 'users', title: (d) => String(d.groupName ?? ''), route: () => ({ name: 'featuredChoirs' }) },
  { collection: 'promotions', group: 'Promotions', icon: 'megaphone', title: (d) => String(d.title ?? ''), route: () => ({ name: 'promotions' }) },
];
const PER_SOURCE = 100;

async function loadSource(s: (typeof SOURCES)[number]): Promise<Hit[]> {
  const col = collection(db, s.collection);
  let snap;
  try {
    snap = await getDocs(query(col, orderBy('createdAt', 'desc'), limit(PER_SOURCE)));
  } catch {
    snap = await getDocs(query(col, limit(PER_SOURCE)));
  }
  return snap.docs
    .map((d) => ({ key: `${s.collection}/${d.id}`, group: s.group, label: s.title(d.data()), icon: s.icon, route: s.route(d.id), meta: d.data().isPublished === false || d.data().status === 'draft' ? 'Draft' : undefined }))
    .filter((h) => h.label);
}

export function GlobalSearch({ go }: { go: (r: Route) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(0);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const ensureIndex = () => {
    if (index || loading) return;
    setLoading(true);
    void Promise.allSettled(SOURCES.map(loadSource)).then((results) => {
      setIndex(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])));
      setFailed(results.filter((r) => r.status === 'rejected').length);
      setLoading(false);
    });
  };

  // "/" or Ctrl/Cmd+K focuses the search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, []);

  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const pages: Hit[] = NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(term)).map((n) => ({ key: `page/${n.name}`, group: 'Pages', label: n.label, icon: n.icon, route: { name: n.name } as Route }));
    const content = (index ?? []).filter((h) => h.label.toLowerCase().includes(term)).slice(0, 30);
    return [...pages, ...content];
  }, [q, index]);

  useEffect(() => setActive(0), [q]);

  const choose = (h: Hit) => {
    go(h.route);
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && hits[active]) { e.preventDefault(); choose(hits[active]); }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  let lastGroup = '';
  return (
    <div className="gsearch" ref={wrapRef}>
      <Icon name="search" size={16} />
      <input
        ref={inputRef}
        type="search"
        value={q}
        placeholder="Search content and pages…"
        aria-label="Search content and pages"
        aria-expanded={open && q.trim().length > 0}
        aria-controls="gsearch-results"
        role="combobox"
        aria-autocomplete="list"
        onFocus={() => { setOpen(true); ensureIndex(); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      <kbd>Ctrl K</kbd>
      {open && q.trim() ? (
        <div className="menu gsearch-results" id="gsearch-results" role="listbox">
          {loading ? <div className="small muted" style={{ padding: 10 }}>Loading content index…</div> : null}
          {!loading && hits.length === 0 ? <div className="small muted" style={{ padding: 10 }}>No matches for “{q.trim()}”.</div> : null}
          {hits.map((h, i) => {
            const header = h.group !== lastGroup ? <div className="gsearch-group">{h.group}</div> : null;
            lastGroup = h.group;
            return (
              <div key={h.key}>
                {header}
                <button type="button" role="option" aria-selected={i === active} className={`gsearch-item ${i === active ? 'on' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => choose(h)}>
                  <Icon name={h.icon} size={16} />
                  <span className="ellipsis">{h.label}</span>
                  {h.meta ? <span className="meta">{h.meta}</span> : null}
                </button>
              </div>
            );
          })}
          <div className="tiny muted" style={{ padding: '8px 10px 4px' }}>
            Searches page names and the {PER_SOURCE} most recent items in each content section.{failed ? ` ${failed} section(s) could not be searched.` : ''}
          </div>
        </div>
      ) : null}
    </div>
  );
}
