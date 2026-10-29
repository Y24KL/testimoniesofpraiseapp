import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { colors, radius } from '../theme';
import { TopBar } from '../components/TopBar';
import { TestimonyCard } from '../components/TestimonyCard';
import { EmptyState } from '../components/EmptyState';
import { repo } from '../api/repository';
import type { Testimony } from '../types';
import { AISearchPanel } from '../components/AISearchPanel';

interface Props {
  onBack: () => void;
  onSelectTestimony: (id: string) => void;
}

export function SearchPage({ onBack, onSelectTestimony }: Props) {
  const [queryText, setQueryText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [testimonies, setTestimonies] = useState<Testimony[] | null>(null);

  useEffect(() => {
    repo.getTestimonies({ limit: 100 }).then((res) => {
      setTestimonies(res.items);
    }).catch(() => {
      setTestimonies([]);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(queryText.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(timer);
  }, [queryText]);

  const results = useMemo(() => {
    if (!debounced || !testimonies) return [];
    return testimonies.filter((t) => {
      const matchIn = [
        t.title,
        t.authorName ?? '',
        t.category ?? '',
        ...t.keywords,
        t.description,
      ];
      return matchIn.some((str) => str.toLowerCase().includes(debounced));
    });
  }, [debounced, testimonies]);

  const loading = testimonies === null;
  const noResults = debounced && !loading && results.length === 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        backgroundColor: colors.bg,
        paddingBottom: 'calc(var(--sab, 0px) + 36px)',
        boxSizing: 'border-box',
      }}
    >
      <TopBar title="Search" onBack={onBack} />

      {/* Search Input Bar */}
      <div style={{ padding: '12px 16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0 14px',
            minHeight: '48px',
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
            border: `1.5px solid ${colors.border}`,
          }}
        >
          <Search size={20} color={colors.textMuted} />
          <input
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search testimonies..."
            autoFocus
            autoCorrect="off"
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: colors.text,
              fontSize: '16px',
            }}
          />
          {queryText && (
            <button
              type="button"
              onClick={() => setQueryText('')}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: colors.textMuted }}>
            Loading search index…
          </div>
        ) : noResults ? (
          <EmptyState
            icon={<Search size={44} color={colors.primaryLight} />}
            title="No results found"
            message={`No testimonies matching "${queryText}". Try a different keyword or topic.`}
          />
        ) : results.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ padding: '8px 16px', fontSize: '11px', fontWeight: '800', letterSpacing: '1px', color: colors.accent }}>
              FOUND {results.length} TESTIMONIES
            </div>
            {results.map((item) => (
              <TestimonyCard
                key={item.id}
                item={item}
                variant="row"
                onClick={() => onSelectTestimony(item.id)}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: colors.textMuted, fontSize: '14px', lineHeight: '1.5' }}>
            Search testimonies by title, testifier name, zone, or keyword.
          </div>
        )}
      </div>
      <AISearchPanel query={queryText} onSelectTestimony={onSelectTestimony} />
    </div>
  );
}
