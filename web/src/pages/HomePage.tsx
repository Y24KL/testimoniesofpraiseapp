import React, { useEffect, useState } from 'react';
import { Heart, Radio, BookOpen, Megaphone, Library, Play } from 'lucide-react';
import { colors, radius } from '../theme';
import { TopBar } from '../components/TopBar';
import { EmailVerifyBanner } from '../components/EmailVerifyBanner';
import { SkeletonCard } from '../components/SkeletonCard';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { TestimonyCard } from '../components/TestimonyCard';
import { LiveCard } from '../components/LiveCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { useTestimonies, useLive } from '../hooks/useContent';
import { repo } from '../api/repository';
import type { Promotion, RadioConfig } from '../types';

interface Props {
  onSearch: () => void;
  onNotifications: () => void;
  onProfile: () => void;
  onSelectTestimony: (id: string) => void;
  onGoToLive: () => void;
  onGoToTestimonies: () => void;
  onShareTestimony: () => void;
  onGoToRadio: () => void;
  onGoToAdotopoc: () => void;
  onGoToArticles: () => void;
  onGoToPromotions: () => void;
}

export function HomePage({
  onSearch,
  onNotifications,
  onProfile,
  onSelectTestimony,
  onGoToLive,
  onGoToTestimonies,
  onShareTestimony,
  onGoToRadio,
  onGoToAdotopoc,
  onGoToArticles,
  onGoToPromotions,
}: Props) {
  const feat = useTestimonies({ featuredOnly: true, limit: 1 });
  const latest = useTestimonies({ limit: 10 });
  const { live } = useLive();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [radioConfig, setRadioConfig] = useState<RadioConfig | null>(null);

  useEffect(() => {
    repo.getPromotions().then(setPromotions).catch(() => undefined);
    const unsub = repo.subscribeRadio(setRadioConfig);
    return unsub;
  }, []);

  const hero = feat.items[0] ?? latest.items[0];
  const rest = latest.items.filter((i) => i.id !== hero?.id);

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
        brand
        onSearch={onSearch}
        onNotifications={onNotifications}
        onProfile={onProfile}
      />

      <EmailVerifyBanner />

      {/* Live Radio Quick Bar (shown when radio is on air) */}
      {radioConfig?.isLive && (
        <div
          onClick={onGoToRadio}
          style={{
            margin: '12px 16px 4px',
            padding: '12px 16px',
            borderRadius: radius.md,
            backgroundColor: 'rgba(75, 0, 110, 0.7)',
            border: `1px solid ${colors.accent}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(245, 197, 66, 0.15)',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(52, 199, 89, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Radio size={20} color="#34C759" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 800,
                color: colors.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {radioConfig.currentProgramme || 'TOP Radio — On Air'}
            </div>
            <div style={{ fontSize: '12px', color: colors.accent, fontWeight: 600 }}>
              Live 24/7 Broadcast • Tap to tune in
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: radius.pill,
              backgroundColor: colors.accent,
              color: colors.bg,
              fontSize: '11px',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            <Play size={12} fill={colors.bg} />
            <span>LISTEN</span>
          </div>
        </div>
      )}

      {/* Quick Discover Navigation Grid (2x2) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          padding: '12px 16px',
        }}
      >
        <button
          type="button"
          onClick={onGoToRadio}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px',
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(245, 197, 66, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Radio size={18} color={colors.accent} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: colors.text }}>TOP Radio</div>
            <div style={{ fontSize: '11px', color: colors.textMuted }}>Audio Stream</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onGoToAdotopoc}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px',
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(127, 4, 4, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Library size={18} color="#FBFAF5" />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: colors.text }}>ADOTOPOC</div>
            <div style={{ fontSize: '11px', color: colors.textMuted }}>Resource Center</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onGoToArticles}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px',
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(186, 104, 200, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BookOpen size={18} color={colors.primaryLight} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: colors.text }}>Articles</div>
            <div style={{ fontSize: '11px', color: colors.textMuted }}>Study & Faith</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onGoToPromotions}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px',
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(245, 197, 66, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Megaphone size={18} color={colors.accent} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: colors.text }}>Highlights</div>
            <div style={{ fontSize: '11px', color: colors.textMuted }}>Events & News</div>
          </div>
        </button>
      </div>

      {/* Promotions Horizontal Carousel */}
      {promotions.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 16px 8px',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '1px',
                color: colors.accent,
                textTransform: 'uppercase',
              }}
            >
              HIGHLIGHTS & EVENTS
            </span>
            <button
              type="button"
              onClick={onGoToPromotions}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              See all
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              padding: '0 16px',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}
          >
            {promotions.map((p) => (
              <div
                key={p.id}
                onClick={onGoToPromotions}
                style={{
                  minWidth: '240px',
                  maxWidth: '280px',
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {p.imageUrl && (
                  <div style={{ width: '100%', height: '110px', backgroundColor: colors.surface }}>
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <div style={{ padding: '10px 12px' }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: colors.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.title}
                  </div>
                  {p.description && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: colors.textMuted,
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {latest.loading && !hero ? (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SkeletonCard />
          <SkeletonCard horizontal />
          <SkeletonCard horizontal />
        </div>
      ) : latest.error && !hero ? (
        <ErrorState onRetry={latest.retry} />
      ) : hero ? (
        <>
          {/* Section: FEATURED */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', color: colors.accent, textTransform: 'uppercase' }}>
              FEATURED
            </span>
          </div>
          <TestimonyCard
            item={hero}
            variant="hero"
            onClick={() => onSelectTestimony(hero.id)}
          />

          {/* Section: LATEST TESTIMONIES */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 16px 12px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', color: colors.accent, textTransform: 'uppercase' }}>
              LATEST TESTIMONIES
            </span>
            <button
              type="button"
              onClick={onGoToTestimonies}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              See all
            </button>
          </div>

          {rest.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '12px',
                overflowX: 'auto',
                padding: '0 16px',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                touchAction: 'pan-x pan-y',
              }}
            >
              {rest.map((item) => (
                <TestimonyCard
                  key={item.id}
                  item={item}
                  variant="tile"
                  onClick={() => onSelectTestimony(item.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title="No testimonies yet"
          message="New testimonies will appear here as soon as they’re published."
        />
      )}

      {/* Section: WATCH LIVE */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 16px 12px' }}>
        <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', color: colors.accent, textTransform: 'uppercase' }}>
          WATCH LIVE
        </span>
      </div>
      <LiveCard live={live} onClick={onGoToLive} />

      {/* CTA: Share your testimony */}
      <div
        style={{
          margin: '28px 16px 16px',
          padding: '20px',
          borderRadius: radius.lg,
          backgroundColor: colors.primary,
          border: `1px solid ${colors.primaryLight}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxSizing: 'border-box',
        }}
      >
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: colors.text, margin: 0 }}>
          Share your testimony
        </h2>
        <p style={{ fontSize: '14px', color: colors.textMuted, margin: 0, lineHeight: '1.4' }}>
          What has God done for you? Someone needs to hear it.
        </p>
        <div style={{ marginTop: '4px' }}>
          <PrimaryButton
            title="SHARE YOUR TESTIMONY"
            icon={<Heart size={18} />}
            onClick={onShareTestimony}
          />
        </div>
      </div>

      {/* Section: RECENTLY ADDED */}
      {rest.length > 3 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 16px 8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', color: colors.accent, textTransform: 'uppercase' }}>
              RECENTLY ADDED
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {rest.slice(-4).map((i) => (
              <TestimonyCard
                key={i.id}
                item={i}
                variant="row"
                onClick={() => onSelectTestimony(i.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
