import React from 'react';
import { Radio } from 'lucide-react';
import { colors, gradients, radius } from '../theme';
import type { LiveConfig } from '../types';
import { Skeleton } from './SkeletonCard';

export function LiveBadge() {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: colors.live,
        borderRadius: radius.pill,
        padding: '4px 10px',
        fontSize: '11px',
        fontWeight: '800',
        letterSpacing: '1px',
        color: '#fff',
        textTransform: 'uppercase',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          animation: 'pulse 1.4s infinite ease-in-out',
          display: 'inline-block',
        }}
      />
      <span>LIVE NOW</span>
    </div>
  );
}

interface Props {
  live: LiveConfig | null;
  onClick: () => void;
}

export function LiveCard({ live, onClick }: Props) {
  if (!live) {
    return (
      <div style={{ padding: '0 16px' }}>
        <Skeleton style={{ height: '130px', borderRadius: radius.lg }} />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className="touch-btn"
      style={{
        margin: '0 16px',
        minHeight: '130px',
        borderRadius: radius.lg,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        boxSizing: 'border-box',
      }}
    >
      {live.thumbnail && (
        <img
          src={live.thumbnail}
          alt="Live thumbnail"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: live.isLive
            ? 'linear-gradient(180deg, rgba(75,0,110,0.55) 0%, rgba(18,0,28,0.95) 100%)'
            : gradients.card,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {live.isLive ? (
          <LiveBadge />
        ) : (
          <span
            style={{
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '1px',
              color: colors.textMuted,
              textTransform: 'uppercase',
            }}
          >
            LIVE STREAM IS CURRENTLY OFFLINE
          </span>
        )}
        <h3
          style={{
            fontSize: '18px',
            fontWeight: '700',
            color: colors.text,
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {live.isLive ? live.title ?? 'Watch Live' : 'WATCH LIVE'}
        </h3>
        <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0 }}>
          {live.isLive ? 'Tap to join the broadcast' : "We'll notify you when we go live"}
        </p>
      </div>
    </div>
  );
}
