import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, FileText, Search, X } from 'lucide-react';
import { repo } from '../api/repository';
import { TopBar } from '../components/TopBar';
import { ErrorState } from '../components/ErrorState';
import type { WrittenTestimony } from '../types';
import { formatDate } from '../utils/format';

interface Props {
  onBack: () => void;
  onOpen: (id: string) => void;
}

const PAGE = 15;
const ALL = 'All';

export const initialsOf = (n?: string) =>
  (n ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || 'T';

/** Gold-ringed photo (or initials), as on the Testimonies of Praise quote cards. */
export function TestifierAvatar({ name, photoUrl, size = 52 }: { name?: string; photoUrl?: string; size?: number }) {
  return (
    <span style={{ width: size + 8, height: size + 8, borderRadius: '50%', background: '#F5C542', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {photoUrl ? (
        <img src={photoUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <span style={{ width: size, height: size, borderRadius: '50%', background: '#4B006E', color: '#F5C542', fontWeight: 800, fontSize: size * 0.36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}

/** Library of published written testimonies: search, category chips and "load more". */
export function WrittenTestimoniesPage({ onBack, onOpen }: Props) {
  const [items, setItems] = useState<WrittenTestimony[]>([]);
  const [cursor, setCursor] = useState<unknown>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const busy = useRef(false);

  const loadFirst = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const page = await repo.getWrittenTestimonies({ limit: PAGE });
      setItems(page.items);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch {
      setError('Couldn’t load written testimonies. Check your connection and try again.');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (busy.current || !hasMore) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const page = await repo.getWrittenTestimonies({ limit: PAGE, cursor });
      setItems((cur) => [...cur, ...page.items.filter((n) => !cur.some((c) => c.id === n.id))]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      setMoreError(false);
    } catch {
      setMoreError(true);
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter((c): c is string => !!c));
    return set.size ? [ALL, ...Array.from(set).sort()] : [];
  }, [items]);
  const q = search.trim().toLowerCase();
  const shown = items.filter(
    (i) => (category === ALL || i.category === category) && (!q || [i.title, i.authorName, i.churchZone, i.body].some((v) => v?.toLowerCase().includes(q))),
  );

  return (
    <div data-page style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--nav-h, 0px) + env(safe-area-inset-bottom) + 24px)' }}>
      <TopBar title="Written testimonies" onBack={onBack} />
      <div className="page-pad page-width" style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Read what God is doing in the lives of people around the world.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 46, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Search size={18} color="var(--text-subtle)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, church or words"
            aria-label="Search written testimonies"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', font: 'inherit', fontSize: 15 }}
          />
          {search ? (
            <button type="button" className="link-btn" onClick={() => setSearch('')} aria-label="Clear search">
              <X size={16} />
            </button>
          ) : null}
        </label>
        {categories.length ? (
          <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 13,
                  border: `1px solid ${category === c ? '#F5C542' : 'var(--border)'}`,
                  background: category === c ? '#F5C542' : 'var(--surface)',
                  color: category === c ? 'var(--on-gold)' : 'var(--text-muted)',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
        {q && hasMore ? <p className="comments-muted" style={{ textAlign: 'center' }}>Searching the testimonies loaded so far. Load more to search further.</p> : null}

        {loading ? (
          [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 170 }} aria-hidden="true" />)
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadFirst()} />
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
            <FileText size={40} color="var(--gold)" />
            <h3 style={{ color: 'var(--text)', margin: '10px 0 4px' }}>{items.length === 0 ? 'No written testimonies yet' : 'No matches'}</h3>
            <p style={{ margin: 0 }}>{items.length === 0 ? 'New testimonies will appear here as soon as they are published.' : 'Try another name, church or word.'}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
            {shown.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => onOpen(w.id)}
                aria-label={`Read ${w.title}${w.authorName ? ` by ${w.authorName}` : ''}`}
                style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 20, background: 'var(--surface)', border: '1px solid rgba(245,197,66,0.22)' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <TestifierAvatar name={w.authorName} photoUrl={w.authorPhotoUrl} size={44} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.authorName || 'Testimonies of Praise'}</span>
                    {w.churchZone ? <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)' }}>{w.churchZone}</span> : null}
                  </span>
                  <span aria-hidden="true" style={{ fontSize: 44, lineHeight: '44px', fontWeight: 900, color: '#7A1FA2' }}>”</span>
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#F5C542', lineHeight: 1.3 }}>{w.title}</span>
                <span style={{ color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{w.excerpt}</span>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-subtle)' }}>
                  {[w.category, formatDate(w.publishedAt ?? w.createdAt)].filter(Boolean).join('  ·  ')}
                  <span style={{ color: '#F5C542', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Read <ArrowRight size={14} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        {hasMore && !loading ? (
          <button type="button" className="btn btn-outline" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : moreError ? 'Couldn’t load more. Try again' : 'Load more testimonies'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
