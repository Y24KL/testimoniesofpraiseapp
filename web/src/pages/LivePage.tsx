import React from 'react';
import { Radio, Bell, Clock } from 'lucide-react';
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

  // live > pre-live > offline. Only one branch renders, so the pre-live player is removed (stopped)
  // the moment the real broadcast starts or the admin turns pre-live playback off.
  const mode: 'loading' | 'live' | 'prelive' | 'offline' = !live ? 'loading' : live.isLive && live.streamUrl ? 'live' : live.preLive ? 'prelive' : 'offline';
  const prevMode = React.useRef(mode);
  const [switchNote, setSwitchNote] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (prevMode.current === 'prelive' && mode === 'live') setSwitchNote('We’re live! The broadcast has started, so we switched you to it.');
    else if (prevMode.current === 'prelive' && mode === 'offline') setSwitchNote('Pre-live playback has ended. We’ll be live soon.');
    else if (prevMode.current === 'live') setSwitchNote(null);
    prevMode.current = mode;
  }, [mode]);
  const pre = live?.preLive;
  const preYouTubeId = pre?.sourceType === 'youtube' ? parseYouTubeId(pre.url) : null;
  const note = switchNote ? (
    <p role="status" style={{ margin: 0, fontSize: 14, color: colors.accent, textAlign: 'center' }}>
      {switchNote}
    </p>
  ) : null;

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

            {note}
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
        ) : mode === 'prelive' && pre ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, background: 'rgba(245,197,66,0.08)', border: '1px solid rgba(245,197,66,0.35)' }}>
              <Clock size={22} color="#f5c542" />
              <div>
                <div style={{ fontWeight: 700, color: colors.text }}>We’re not live yet</div>
                <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>Watch while you wait. The live broadcast takes over here automatically when it starts.</div>
              </div>
            </div>
            {preYouTubeId ? (
              <YouTubePlayer key={pre.url} videoId={preYouTubeId} label={pre.title} />
            ) : (
              <VideoPlayer key={pre.url} uri={pre.url} autoPlay={false} label={pre.title} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: '#f5c542' }}>WHILE YOU WAIT</span>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: colors.text, margin: 0 }}>{pre.title}</h2>
              {pre.description ? <p style={{ fontSize: '14px', color: colors.textMuted, margin: 0, lineHeight: '1.4' }}>{pre.description}</p> : null}
            </div>
            {note}
          </>
        ) : (
          <>
            {note}
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
