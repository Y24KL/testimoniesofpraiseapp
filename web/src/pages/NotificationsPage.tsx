import React, { useEffect, useState } from 'react';
import { PlayCircle, Radio, Megaphone, Star, Bell } from 'lucide-react';
import { colors, radius } from '../theme';
import { TopBar } from '../components/TopBar';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { repo } from '../api/repository';
import { navigate } from '../router';
import type { AppNotification } from '../types';

interface Props {
  onBack: () => void;
  onSelectTestimony: (id: string) => void;
  onGoToLive: () => void;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function NotificationsPage({ onBack, onSelectTestimony, onGoToLive }: Props) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repo.getNotifications(50);
      setItems(data);
    } catch (err: any) {
      console.error('Notifications load error:', err);
      setError('Could not load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleClick = (item: AppNotification) => {
    if (item.type === 'testimony' && item.contentId) {
      onSelectTestimony(item.contentId);
    } else if (item.type === 'live') {
      onGoToLive();
    } else if (item.type === 'written') {
      navigate(item.contentId ? { name: 'writtenTestimony', id: item.contentId } : { name: 'written' });
    }
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'testimony':
        return <PlayCircle size={22} color={colors.accent} />;
      case 'live':
        return <Radio size={22} color={colors.live} />;
      case 'featured':
        return <Star size={22} color={colors.accent} />;
      default:
        return <Megaphone size={22} color={colors.accent} />;
    }
  };

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
      <TopBar title="Notifications" onBack={onBack} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: colors.textMuted }}>
            Loading notifications…
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell size={44} color={colors.primaryLight} />}
            title="You’re all caught up"
            message="Announcements, new testimonies, and live alerts will appear here."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleClick(item)}
                style={{
                  display: 'flex',
                  gap: '12px',
                  margin: '6px 16px',
                  padding: '14px',
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  cursor: item.contentId || item.type === 'live' ? 'pointer' : 'default',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '20px',
                    backgroundColor: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {getIcon(item.type)}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: colors.text }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.4' }}>
                    {item.message}
                  </span>
                  <span style={{ fontSize: '12px', color: colors.textMuted, marginTop: '2px' }}>
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
