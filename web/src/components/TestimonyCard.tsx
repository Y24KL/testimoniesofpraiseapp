import React from 'react';
import { Play, CheckCircle } from 'lucide-react';
import { colors, gradients, radius } from '../theme';
import type { Testimony } from '../types';
import { useDownloads } from '../context/DownloadsContext';

interface Props {
  item: Testimony;
  onClick: () => void;
  variant?: 'row' | 'hero' | 'tile';
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export function TestimonyCard({ item, onClick, variant = 'row' }: Props) {
  const dl = useDownloads();
  const saved = dl.get(item.id)?.status === 'done';
  const dur = formatDuration(item.duration);
  const dateStr = formatDate(item.publishedAt ?? item.createdAt);
  const meta = [item.authorName, dateStr].filter(Boolean).join('  •  ');

  if (variant === 'hero') {
    return (
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        className="touch-btn"
        style={{
          height: '260px',
          borderRadius: radius.lg,
          overflow: 'hidden',
          backgroundColor: colors.card,
          position: 'relative',
          margin: '0 16px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          boxSizing: 'border-box',
        }}
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: colors.card }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: gradients.card }} />

        {/* Hero Play Button Top Right */}
        <div
          style={{
            position: 'absolute',
            right: '16px',
            top: '16px',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: `${colors.primary}dd`,
            border: `1px solid ${colors.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.text,
            zIndex: 2,
          }}
        >
          <Play size={22} fill="currentColor" />
        </div>

        {/* Hero Body */}
        <div style={{ position: 'relative', zIndex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div
            style={{
              alignSelf: 'flex-start',
              backgroundColor: colors.accent,
              borderRadius: radius.pill,
              padding: '3px 10px',
              fontSize: '10px',
              fontWeight: '800',
              letterSpacing: '0.8px',
              color: colors.bg,
              textTransform: 'uppercase',
            }}
          >
            {item.category ?? 'FEATURED'}
          </div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: '700',
              color: colors.text,
              margin: 0,
              lineHeight: '1.3',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.title}
          </h2>
          <span style={{ fontSize: '13px', color: colors.textMuted }}>{meta}</span>
        </div>
      </div>
    );
  }

  if (variant === 'tile') {
    return (
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        className="touch-btn"
        style={{
          width: '200px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            height: '112px',
            borderRadius: radius.md,
            overflow: 'hidden',
            backgroundColor: colors.card,
            position: 'relative',
          }}
        >
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt={item.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', backgroundColor: colors.card }} />
          )}
          {dur && (
            <span
              style={{
                position: 'absolute',
                right: '6px',
                bottom: '6px',
                backgroundColor: 'rgba(0,0,0,0.75)',
                borderRadius: '4px',
                padding: '2px 5px',
                fontSize: '11px',
                fontWeight: '700',
                color: '#fff',
              }}
            >
              {dur}
            </span>
          )}
        </div>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: '700',
            color: colors.text,
            margin: 0,
            lineHeight: '1.3',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.title}
        </h3>
        <span style={{ fontSize: '12px', color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meta}
        </span>
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
        display: 'flex',
        gap: '12px',
        padding: '8px 16px',
        alignItems: 'flex-start',
        cursor: 'pointer',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '132px',
          height: '84px',
          borderRadius: radius.md,
          overflow: 'hidden',
          backgroundColor: colors.card,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: colors.card }} />
        )}
        {dur && (
          <span
            style={{
              position: 'absolute',
              right: '6px',
              bottom: '6px',
              backgroundColor: 'rgba(0,0,0,0.75)',
              borderRadius: '4px',
              padding: '2px 5px',
              fontSize: '11px',
              fontWeight: '700',
              color: '#fff',
            }}
          >
            {dur}
          </span>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
        {item.category && (
          <span style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.8px', color: colors.accent, textTransform: 'uppercase' }}>
            {item.category}
          </span>
        )}
        <h3
          style={{
            fontSize: '15px',
            fontWeight: '700',
            color: colors.text,
            margin: 0,
            lineHeight: '1.3',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.title}
        </h3>
        <span style={{ fontSize: '12px', color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meta}
        </span>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <CheckCircle size={13} color={colors.success} />
            <span style={{ fontSize: '10px', fontWeight: '800', color: colors.success, letterSpacing: '0.6px' }}>
              SAVED
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
