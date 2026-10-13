import React from 'react';
import { Download, Trash2, XCircle } from 'lucide-react';
import { colors, radius } from '../theme';
import { TopBar } from '../components/TopBar';
import { EmptyState } from '../components/EmptyState';
import { useDownloads } from '../context/DownloadsContext';
import type { DownloadItem } from '../types';

interface Props {
  onNotifications: () => void;
  onProfile: () => void;
  onSelectTestimony: (id: string) => void;
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

export function DownloadsPage({ onNotifications, onProfile, onSelectTestimony }: Props) {
  const dl = useDownloads();

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
        title="Downloads"
        onNotifications={onNotifications}
        onProfile={onProfile}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {dl.items.length === 0 ? (
          <EmptyState
            icon={<Download size={44} color={colors.primaryLight} />}
            title="No downloads yet"
            message="Content you download appears here and works without an internet connection."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {dl.items.map((item) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  backgroundColor: colors.bg,
                }}
              >
                {/* Thumbnail */}
                <div
                  onClick={() => onSelectTestimony(item.id)}
                  style={{
                    width: '84px',
                    height: '60px',
                    borderRadius: radius.sm,
                    overflow: 'hidden',
                    backgroundColor: colors.card,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Download size={24} color={colors.primaryLight} />
                  )}
                </div>

                {/* Details */}
                <div
                  onClick={() => onSelectTestimony(item.id)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}
                >
                  <h4
                    style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: colors.text,
                      margin: 0,
                      lineHeight: '1.3',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title}
                  </h4>
                  {item.status === 'downloading' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '90%' }}>
                      <span style={{ fontSize: '11px', color: colors.textMuted }}>
                        Downloading... {Math.round(item.progress * 100)}%
                      </span>
                      <div style={{ height: '4px', backgroundColor: colors.card, borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round(item.progress * 100)}%`, backgroundColor: colors.accent }} />
                      </div>
                    </div>
                  ) : item.status === 'done' ? (
                    <span style={{ fontSize: '12px', fontWeight: '700', color: colors.success }}>
                      ✓ SAVED FOR OFFLINE {item.sizeBytes ? ` • ${formatBytes(item.sizeBytes)}` : ''}
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: colors.danger }}>
                      Download failed.
                    </span>
                  )}
                </div>

                {/* Action Button */}
                {item.status === 'downloading' ? (
                  <button
                    type="button"
                    onClick={() => dl.cancel(item.id)}
                    aria-label="Cancel download"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.textMuted,
                      cursor: 'pointer',
                      padding: '8px',
                    }}
                  >
                    <XCircle size={22} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => dl.remove(item.id)}
                    aria-label="Delete download"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.textMuted,
                      cursor: 'pointer',
                      padding: '8px',
                    }}
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
