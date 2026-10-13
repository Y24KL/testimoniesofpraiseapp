import React from 'react';
import { Radio, Bell } from 'lucide-react';
import { colors, radius } from '../theme';
import { TopBar } from '../components/TopBar';
import { LiveBadge } from '../components/LiveCard';
import { VideoPlayer } from '../components/VideoPlayer';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { LiveChat } from '../components/LiveChat';
import { EmptyState } from '../components/EmptyState';
import { useLive } from '../hooks/useContent';
import { useLiveViewer } from '../hooks/useLiveViewer';

interface Props {
  onNotifications: () => void;
  onProfile: () => void;
}

function parseYouTubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|live\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function LivePage({ onNotifications, onProfile }: Props) {
  const { live, error } = useLive();

  // Heartbeat presence for admin portal viewer count
  useLiveViewer(live?.sessionId, !!live?.isLive);

  const youtubeId = live?.streamUrl ? parseYouTubeId(live.streamUrl) : null;

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
        title="Watch Live"
        onNotifications={onNotifications}
        onProfile={onProfile}
      />

      <div
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {!live ? (
          <div style={{ padding: '40px', textAlign: 'center', color: colors.textMuted }}>
            Loading stream…
          </div>
        ) : live.isLive && live.streamUrl ? (
          <>
            {live.sourceType === 'youtube' && youtubeId ? (
              <YouTubePlayer key={live.streamUrl} videoId={youtubeId} label={live.title} />
            ) : (
              <VideoPlayer key={live.streamUrl} uri={live.streamUrl} live autoPlay label={live.title} />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <LiveBadge />
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: colors.text, margin: 0 }}>
                {live.title ?? 'Live Now'}
              </h2>
              {live.description && (
                <p style={{ fontSize: '14px', color: colors.textMuted, margin: 0, lineHeight: '1.4' }}>
                  {live.description}
                </p>
              )}
            </div>

            {live.sessionId && <LiveChat sessionId={live.sessionId} />}
          </>
        ) : (
          <>
            <div
              style={{
                aspectRatio: '16 / 9',
                borderRadius: radius.md,
                overflow: 'hidden',
                backgroundColor: colors.card,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {live.thumbnail && (
                <img
                  src={live.thumbnail}
                  alt="Offline banner"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    filter: 'blur(8px)',
                  }}
                />
              )}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: colors.overlay,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '16px',
                  textAlign: 'center',
                }}
              >
                <Radio size={44} color={colors.textMuted} />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '800',
                    letterSpacing: '1.5px',
                    color: colors.text,
                    textTransform: 'uppercase',
                  }}
                >
                  LIVE STREAM IS CURRENTLY OFFLINE
                </span>
              </div>
            </div>

            {error ? (
              <p style={{ fontSize: '14px', color: colors.textMuted, textAlign: 'center' }}>
                Unable to connect to live stream service.
              </p>
            ) : (
              <EmptyState
                icon={<Bell size={40} color={colors.primaryLight} />}
                title="We’ll let you know"
                message="Turn on Live notifications in your profile to be alerted when we go live."
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
