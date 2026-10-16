import React, { useEffect, useState } from 'react';
import { Megaphone, ExternalLink, ArrowRight } from 'lucide-react';
import { repo } from '../api/repository';
import { TopBar } from '../components/TopBar';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { colors, radius, gradients } from '../theme';
import type { Promotion } from '../types';

interface Props {
  onBack: () => void;
  onNavigateInternal: (route: string) => void;
}

export function PromotionsPage({ onBack, onNavigateInternal }: Props) {
  const [items, setItems] = useState<Promotion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const list = await repo.getPromotions();
      setItems(list);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load promotions');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleClick = (item: Promotion) => {
    if (!item.destinationUrl) return;
    if (
      item.target === 'external' ||
      item.destinationUrl.startsWith('http://') ||
      item.destinationUrl.startsWith('https://')
    ) {
      window.open(item.destinationUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    onNavigateInternal(item.destinationUrl);
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
      <TopBar title="Promotions & Highlights" onBack={onBack} />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !items ? (
        <div style={{ padding: '32px', textAlign: 'center', color: colors.textMuted }}>
          Loading highlights...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={44} color={colors.accent} />}
          title="No Promotions Active"
          message="Check back soon for upcoming events, programs, and church announcements."
        />
      ) : (
        <div
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxWidth: '680px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => handleClick(item)}
              style={{
                borderRadius: radius.lg,
                overflow: 'hidden',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.cardBorder}`,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
            >
              <div
                style={{
                  height: '180px',
                  width: '100%',
                  position: 'relative',
                  backgroundColor: colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Megaphone size={40} color={colors.accent} />
                )}
                {item.category && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      backgroundColor: 'rgba(245, 197, 66, 0.25)',
                      border: '1px solid rgba(245, 197, 66, 0.5)',
                      color: colors.accent,
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: radius.pill,
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.category}
                  </span>
                )}
              </div>

              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: colors.text }}>
                  {item.title}
                </h3>
                {item.description && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      lineHeight: '20px',
                      color: colors.textMuted,
                    }}
                  >
                    {item.description}
                  </p>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '6px',
                    color: colors.accent,
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  <span>{item.target === 'external' ? 'Learn More' : 'Explore'}</span>
                  {item.target === 'external' ? (
                    <ExternalLink size={14} />
                  ) : (
                    <ArrowRight size={14} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
