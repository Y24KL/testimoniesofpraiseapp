import React from 'react';
import { Heart } from 'lucide-react';
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
import type { Testimony } from '../types';

interface Props {
  onSearch: () => void;
  onNotifications: () => void;
  onProfile: () => void;
  onSelectTestimony: (id: string) => void;
  onGoToLive: () => void;
  onGoToTestimonies: () => void;
  onShareTestimony: () => void;
}

export function HomePage({
  onSearch,
  onNotifications,
  onProfile,
  onSelectTestimony,
  onGoToLive,
  onGoToTestimonies,
  onShareTestimony,
}: Props) {
  const feat = useTestimonies({ featuredOnly: true, limit: 1 });
  const latest = useTestimonies({ limit: 10 });
  const { live } = useLive();

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 16px 12px' }}>
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
