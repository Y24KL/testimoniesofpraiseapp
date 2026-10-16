import React, { useEffect, useState } from 'react';
import { BookOpen, Check } from 'lucide-react';
import { repo } from '../api/repository';
import { TopBar } from '../components/TopBar';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { colors, radius } from '../theme';
import type { Article } from '../types';

interface Props {
  onBack: () => void;
  onSelectArticle: (id: string) => void;
}

export function ArticlesPage({ onBack, onSelectArticle }: Props) {
  const [items, setItems] = useState<Article[] | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const list = await repo.getArticles(50);
      setItems(list);
      try {
        const stored = localStorage.getItem('top:articles:read:v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          setReadIds(new Set(Array.isArray(parsed) ? parsed : []));
        }
      } catch {
        /* best effort */
      }
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load articles');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

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
      <TopBar title="Articles & Insights" onBack={onBack} />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !items ? (
        <div style={{ padding: '32px', textAlign: 'center', color: colors.textMuted }}>
          Loading articles...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={44} color={colors.accent} />}
          title="No Articles Published"
          message="Inspiring write-ups and study publications will appear here once published."
        />
      ) : (
        <div
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '680px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {items.map((item) => {
            const isRead = readIds.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => onSelectArticle(item.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.cardBorder}`,
                  overflow: 'hidden',
                  padding: '12px',
                  gap: '14px',
                  cursor: 'pointer',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: radius.sm,
                    backgroundColor: colors.primary,
                    flexShrink: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.coverImageUrl ? (
                    <img
                      src={item.coverImageUrl}
                      alt={item.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <BookOpen size={28} color={colors.accent} />
                  )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {item.category && (
                      <span
                        style={{
                          backgroundColor: 'rgba(245, 197, 66, 0.15)',
                          border: '1px solid rgba(245, 197, 66, 0.35)',
                          color: colors.accent,
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: radius.pill,
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.category}
                      </span>
                    )}

                    {!isRead ? (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px',
                          fontWeight: 800,
                          color: colors.accent,
                          backgroundColor: 'rgba(245, 197, 66, 0.2)',
                          padding: '2px 6px',
                          borderRadius: radius.pill,
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: colors.accent,
                          }}
                        />
                        NEW
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontSize: '10px',
                          fontWeight: 600,
                          color: colors.textMuted,
                        }}
                      >
                        <Check size={12} />
                        READ
                      </span>
                    )}
                  </div>

                  <h3
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: 700,
                      color: colors.text,
                      lineHeight: '20px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.title}
                  </h3>

                  <span style={{ fontSize: '12px', color: colors.textMuted }}>
                    {[item.author, formatDate(item.publishedAt ?? item.createdAt)]
                      .filter(Boolean)
                      .join('  •  ')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
