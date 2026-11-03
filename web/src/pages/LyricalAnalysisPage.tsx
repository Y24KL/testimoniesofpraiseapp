import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Music, Play, Search, X } from 'lucide-react';
import { repo } from '../api/repository';
import { TopBar } from '../components/TopBar';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { colors, gradients, radius } from '../theme';
import type { LyricalAnalysis } from '../types';
import { formatDate, formatDuration } from '../utils/format';

const PAGE = 12;

interface Props {
  onBack: () => void;
  onSelect: (id: string) => void;
}

/** Lyrical Analysis library: hero, search, a responsive card grid, and "Load more" paging. */
export function LyricalAnalysisPage({ onBack, onSelect }: Props) {
  const [items, setItems] = useState<LyricalAnalysis[]>([]);
  const [cursor, setCursor] = useState<unknown>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const busy = useRef(false);

  const loadFirst = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(false);
    repo
      .getLyricalAnalyses({ limit: PAGE })
      .then((page) => {
        setItems(page.items);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      })
      .catch(() => setError(true))
      .finally(() => {
        busy.current = false;
        setLoading(false);
      });
  }, []);

  useEffect(loadFirst, [loadFirst]);

  const loadMore = () => {
    if (busy.current || !hasMore) return;
    busy.current = true;
    setLoadingMore(true);
    repo
      .getLyricalAnalyses({ limit: PAGE, cursor })
      .then((page) => {
        setItems((cur) => [...cur, ...page.items.filter((n) => !cur.some((c) => c.id === n.id))]);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      })
      .catch(() => setError(true))
      .finally(() => {
        busy.current = false;
        setLoadingMore(false);
      });
  };

  const q = search.trim().toLowerCase();
  const shown = items.filter((i) => !q || [i.title, i.songTitle, i.artistName, i.description].some((v) => v?.toLowerCase().includes(q)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: colors.bg }}>
      <TopBar title="Lyrical Analysis" onBack={onBack} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '1100px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <section
          style={{ background: gradients.hero, borderRadius: radius.lg, padding: '28px', border: `1px solid ${colors.accentSoft}`, display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          <Music size={26} color={colors.accent} aria-hidden="true" />
          <h1 style={{ margin: 0, fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 800, color: colors.text, lineHeight: 1.2 }}>Lyrical Analysis</h1>
          <p style={{ margin: 0, fontSize: '16px', color: colors.textMuted, lineHeight: 1.5, maxWidth: '640px' }}>
            Discover the message, inspiration and depth behind the songs of the LoveWorld Singers.
          </p>
        </section>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '46px', padding: '0 14px', borderRadius: radius.pill, background: colors.surface, border: `1px solid ${colors.border}` }}>
          <Search size={18} color={colors.textSubtle} aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by song, singer or topic"
            aria-label="Search lyrical analyses"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: colors.text, fontSize: '15px' }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <X size={18} color={colors.textSubtle} />
            </button>
          )}
        </label>

        {loading ? (
          <div style={{ color: colors.textMuted, textAlign: 'center', padding: '40px 0' }}>Loading praise…</div>
        ) : error && items.length === 0 ? (
          <ErrorState message="Unable to load lyrical analyses. Please check your internet connection." onRetry={loadFirst} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Music size={44} color={colors.primaryLight} />}
            title="Coming soon"
            message={'New lyrical analyses are coming soon.\nCheck back to discover more about the songs of the LoveWorld Singers.'}
          />
        ) : shown.length === 0 ? (
          <EmptyState title="No matches" message="Try another song, singer or word." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' }}>
            {shown.map((v) => (
              <AnalysisCard key={v.id} item={v} onSelect={() => onSelect(v.id)} />
            ))}
          </div>
        )}

        {hasMore && !q && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            style={{ alignSelf: 'center', padding: '12px 26px', borderRadius: radius.pill, border: `1px solid ${colors.accent}`, background: 'transparent', color: colors.accent, fontWeight: 700, cursor: 'pointer', opacity: loadingMore ? 0.6 : 1 }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
        {error && items.length > 0 && <p style={{ margin: 0, textAlign: 'center', color: colors.danger, fontSize: '14px' }}>Couldn’t load more. Try again.</p>}
      </div>
    </div>
  );
}

/** One analysis card: thumbnail (lazy-loaded), analysis title, song, singer or minister, description, date and duration. */
function AnalysisCard({ item, onSelect }: { item: LyricalAnalysis; onSelect: () => void }) {
  const meta = [formatDate(item.publicationDate), formatDuration(item.duration)].filter(Boolean).join('  •  ');
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${item.title}, ${item.songTitle}`}
      style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', padding: 0, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, overflow: 'hidden', color: colors.text, cursor: 'pointer' }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: colors.card }}>
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Music size={34} color={colors.primaryLight} aria-hidden="true" />
          </div>
        )}
        <span style={{ position: 'absolute', right: '12px', bottom: '12px', width: '38px', height: '38px', borderRadius: '50%', background: colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={16} color={colors.onAccent} aria-hidden="true" />
        </span>
      </div>
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '17px', fontWeight: 700 }}>{item.title}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: colors.accent }}>{item.songTitle}</span>
        {item.artistName && <span style={{ fontSize: '13px', color: colors.textMuted }}>{item.artistName}</span>}
        {item.description && (
          <span style={{ fontSize: '14px', color: colors.textMuted, lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {item.description}
          </span>
        )}
        {meta && <span style={{ fontSize: '12px', color: colors.textSubtle, marginTop: '4px' }}>{meta}</span>}
      </div>
    </button>
  );
}
