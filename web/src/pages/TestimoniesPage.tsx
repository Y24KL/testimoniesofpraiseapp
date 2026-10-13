import React, { useState } from 'react';
import { colors, radius } from '../theme';
import { TopBar } from '../components/TopBar';
import { SkeletonCard } from '../components/SkeletonCard';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { TestimonyCard } from '../components/TestimonyCard';
import { useTestimonies } from '../hooks/useContent';

interface Props {
  onSearch: () => void;
  onNotifications: () => void;
  onProfile: () => void;
  onSelectTestimony: (id: string) => void;
}

export function TestimoniesPage({
  onSearch,
  onNotifications,
  onProfile,
  onSelectTestimony,
}: Props) {
  const { items, loading, loadingMore, error, hasMore, loadMore, retry } = useTestimonies({ limit: 16 });
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Extract unique categories
  const categories = ['All', ...Array.from(new Set(items.map((t) => t.category).filter(Boolean))) as string[]];

  const filteredItems = selectedCategory === 'All'
    ? items
    : items.filter((t) => t.category?.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        backgroundColor: colors.bg,
        paddingBottom: 'calc(var(--sab, 0px) + 84px)',
        boxSizing: 'border-box',
      }}
    >
      <TopBar
        title="Testimonies"
        onSearch={onSearch}
        onNotifications={onNotifications}
        onProfile={onProfile}
      />

      {/* Category Filter Pills */}
      {categories.length > 2 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            padding: '12px 16px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            touchAction: 'pan-x pan-y',
          }}
        >
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 14px',
                  borderRadius: radius.pill,
                  backgroundColor: active ? colors.accent : colors.surface,
                  color: active ? colors.bg : colors.textMuted,
                  border: `1px solid ${active ? colors.accent : colors.border}`,
                  fontSize: '12px',
                  fontWeight: '700',
                  letterSpacing: '0.4px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {cat.toUpperCase()}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} horizontal />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={retry} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="No testimonies found"
          message="Check back soon for inspiring stories."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {filteredItems.map((item) => (
            <TestimonyCard
              key={item.id}
              item={item}
              variant="row"
              onClick={() => onSelectTestimony(item.id)}
            />
          ))}

          {hasMore && (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <button
                type="button"
                disabled={loadingMore}
                onClick={loadMore}
                style={{
                  padding: '10px 24px',
                  borderRadius: radius.pill,
                  backgroundColor: colors.surface,
                  border: `1.5px solid ${colors.border}`,
                  color: colors.text,
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: loadingMore ? 'default' : 'pointer',
                  opacity: loadingMore ? 0.6 : 1,
                }}
              >
                {loadingMore ? 'Loading more…' : 'Load more testimonies'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
