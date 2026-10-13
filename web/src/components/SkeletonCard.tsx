import React from 'react';
import { colors, radius } from '../theme';

export function Skeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.sm,
        animation: 'shimmer 1.5s infinite alternate ease-in-out',
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ horizontal = false }: { horizontal?: boolean }) {
  if (horizontal) {
    return (
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
        <Skeleton style={{ width: '132px', height: '84px', borderRadius: radius.md, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton style={{ height: '14px', width: '90%' }} />
          <Skeleton style={{ height: '12px', width: '65%' }} />
          <Skeleton style={{ height: '12px', width: '40%' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
      <Skeleton style={{ height: '180px', borderRadius: radius.lg, width: '100%' }} />
      <Skeleton style={{ height: '16px', width: '80%' }} />
      <Skeleton style={{ height: '12px', width: '50%' }} />
    </div>
  );
}
