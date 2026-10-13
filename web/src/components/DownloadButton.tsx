import React from 'react';
import { Download, CheckCircle, RefreshCw, X } from 'lucide-react';
import { colors, radius } from '../theme';
import { useDownloads } from '../context/DownloadsContext';
import type { Testimony } from '../types';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  data: Testimony;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function DownloadButton({ data }: Props) {
  const dl = useDownloads();
  const item = dl.get(data.id);

  if (!data.isDownloadable && !item) return null;

  if (item?.status === 'downloading') {
    const pct = Math.round(item.progress * 100);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: colors.text }}>
          <span>Downloading... {pct}%</span>
          <button
            type="button"
            onClick={() => dl.cancel(data.id)}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
            }}
          >
            <X size={14} /> Cancel
          </button>
        </div>
        <div
          style={{
            height: '8px',
            borderRadius: '4px',
            backgroundColor: colors.card,
            overflow: 'hidden',
            width: '100%',
          }}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: colors.accent,
              width: `${pct}%`,
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      </div>
    );
  }

  if (item?.status === 'done') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          minHeight: '48px',
          borderRadius: radius.pill,
          border: `1.5px solid ${colors.success}`,
          backgroundColor: 'rgba(61, 220, 151, 0.08)',
          color: colors.success,
          fontSize: '14px',
          fontWeight: '700',
          letterSpacing: '0.6px',
        }}
      >
        <CheckCircle size={18} color={colors.success} />
        <span>✓ SAVED FOR OFFLINE</span>
        {item.sizeBytes && (
          <span style={{ fontSize: '12px', color: colors.textMuted, marginLeft: '4px' }}>
            ({formatBytes(item.sizeBytes)})
          </span>
        )}
      </div>
    );
  }

  if (item?.status === 'failed') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        <span style={{ fontSize: '13px', color: colors.danger, textAlign: 'center' }}>
          Download failed. Please try again.
        </span>
        <PrimaryButton
          title="RETRY DOWNLOAD"
          icon={<RefreshCw size={16} />}
          onClick={() => dl.start(data)}
        />
      </div>
    );
  }

  return (
    <PrimaryButton
      title="DOWNLOAD"
      icon={<Download size={18} />}
      onClick={() => dl.start(data)}
    />
  );
}
