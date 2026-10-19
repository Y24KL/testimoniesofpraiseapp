import React, { useEffect, useRef, useState } from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import { repo, normalizeRadio } from '../api/repository';
import { TopBar } from '../components/TopBar';
import { colors, radius } from '../theme';
import type { AudioTestimony, RadioConfig } from '../types';

interface Props {
  onBack: () => void;
}

function WaveBar({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '40px' }}>
      {[0.4, 0.8, 0.5, 1, 0.6, 0.9, 0.3].map((h, i) => (
        <div
          key={i}
          style={{
            width: '5px',
            borderRadius: '3px',
            backgroundColor: colors.accent,
            height: isPlaying ? undefined : '6px',
            animation: isPlaying ? `wave 0.${6 + i}s ease-in-out infinite alternate` : 'none',
            minHeight: '6px',
            maxHeight: '36px',
            flex: 1,
            transition: 'height 0.3s',
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          from { height: 6px; }
          to { height: 36px; }
        }
      `}</style>
    </div>
  );
}

export function RadioPage({ onBack }: Props) {
  const [radioConfig, setRadioConfig] = useState<RadioConfig>({
    isLive: false,
    streamUrl: '',
    currentProgramme: 'TOP Radio',
  });
  const [library, setLibrary] = useState<AudioTestimony[]>([]);
  const [activeTab, setActiveTab] = useState<'live' | 'library'>('live');
  const [selectedTrack, setSelectedTrack] = useState<AudioTestimony | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Subscribe to live radio config
  useEffect(() => {
    const unsub = repo.subscribeRadio(setRadioConfig);
    return unsub;
  }, []);

  // Load audio testimonies library
  useEffect(() => {
    repo.getAudioTestimonies(50).then(setLibrary).catch(() => undefined);
  }, []);

  // Audio element management
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.addEventListener('playing', () => { setIsPlaying(true); setIsBuffering(false); });
      audioRef.current.addEventListener('pause', () => setIsPlaying(false));
      audioRef.current.addEventListener('waiting', () => setIsBuffering(true));
      audioRef.current.addEventListener('ended', () => setIsPlaying(false));
    }

    // Register MediaSession for lockscreen / notification controls
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: selectedTrack?.title ?? radioConfig.currentProgramme,
        artist: selectedTrack?.speaker ?? 'Testimonies of Praise',
        album: 'TOP Radio',
      });
      navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
      navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    }
  }, [selectedTrack, radioConfig]);

  const getActiveUrl = () => {
    if (activeTab === 'library' && selectedTrack) return selectedTrack.audioUrl;
    if (radioConfig.isLive && radioConfig.streamUrl) return radioConfig.streamUrl;
    return '';
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const url = getActiveUrl();
    if (!url) return;

    if (audio.src !== url) {
      audio.src = url;
    }

    if (isPlaying) {
      audio.pause();
    } else {
      setIsBuffering(true);
      audio.play().catch(() => setIsBuffering(false));
    }
  };

  const selectTrack = (track: AudioTestimony) => {
    const audio = audioRef.current;
    if (!audio) return;
    setSelectedTrack(track);
    audio.src = track.audioUrl;
    audio.play().catch(() => undefined);
  };

  const formatDur = (sec?: number) => {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const segmentBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: radius.pill,
    backgroundColor: active ? colors.accent : 'transparent',
    color: active ? colors.bg : colors.textMuted,
    fontWeight: 700,
    fontSize: '13px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

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
      <TopBar title="TOP Radio" onBack={onBack} />

      {/* Segment tabs */}
      <div
        style={{
          display: 'flex',
          margin: '12px 16px',
          padding: '4px',
          backgroundColor: colors.surface,
          borderRadius: radius.pill,
          border: `1px solid ${colors.border}`,
        }}
      >
        <button style={segmentBtnStyle(activeTab === 'live')} onClick={() => setActiveTab('live')}>
          <Radio size={14} />
          Live Broadcast
        </button>
        <button style={segmentBtnStyle(activeTab === 'library')} onClick={() => setActiveTab('library')}>
          🎵 Audio Archive
        </button>
      </div>

      {activeTab === 'live' ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 20px',
            gap: '20px',
          }}
        >
          {/* On-air badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: radius.pill,
              backgroundColor: radioConfig.isLive
                ? 'rgba(255,59,78,0.18)'
                : 'rgba(255,255,255,0.08)',
              border: `1px solid ${radioConfig.isLive ? 'rgba(255,59,78,0.45)' : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            {radioConfig.isLive && (
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: colors.live,
                  animation: 'pulse 1.5s infinite',
                }}
              />
            )}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: radioConfig.isLive ? colors.live : colors.textMuted,
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              {radioConfig.isLive ? 'ON AIR' : 'OFF AIR'}
            </span>
          </div>

          {/* Dial card */}
          <div
            style={{
              width: '100%',
              maxWidth: '360px',
              padding: '28px',
              borderRadius: '20px',
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '18px',
            }}
          >
            <div
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                backgroundColor: `rgba(245,197,66,${radioConfig.isLive ? '0.15' : '0.06'})`,
                border: `1px solid rgba(245,197,66,${radioConfig.isLive ? '0.4' : '0.15'})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
              }}
            >
              📻
            </div>

            <WaveBar isPlaying={isPlaying && radioConfig.isLive} />

            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: colors.text }}>
                {radioConfig.currentProgramme || 'TOP Radio Live'}
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: colors.textMuted, lineHeight: '18px' }}>
                {radioConfig.description ||
                  '24/7 Gospel Music, Prophetic Prayers & Exhilarating Testimonies'}
              </p>
            </div>
          </div>

          {/* Play button */}
          <button
            onClick={togglePlayback}
            disabled={!radioConfig.isLive || !radioConfig.streamUrl}
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor:
                radioConfig.isLive && radioConfig.streamUrl ? colors.accent : colors.surface,
              border: 'none',
              cursor: radioConfig.isLive && radioConfig.streamUrl ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              opacity: radioConfig.isLive ? 1 : 0.5,
              boxShadow: radioConfig.isLive
                ? `0 6px 24px rgba(245,197,66,0.4)`
                : 'none',
              transition: 'all 0.2s',
            }}
          >
            {isBuffering ? (
              <RefreshCw size={28} color={colors.bg} style={{ animation: 'spin 1s linear infinite' }} />
            ) : isPlaying ? (
              '⏸'
            ) : (
              '▶'
            )}
          </button>

          <p style={{ margin: 0, fontSize: '13px', color: colors.textMuted }}>
            {radioConfig.isLive
              ? isPlaying
                ? 'Streaming live broadcast'
                : 'Tap to tune in'
              : 'Broadcast currently off-air. Check back soon!'}
          </p>
        </div>
      ) : (
        /* Audio Archive tab */
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {library.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: colors.textMuted,
                fontSize: '15px',
              }}
            >
              🎵 No audio testimonies yet. Check back soon.
            </div>
          ) : (
            library.map((track) => {
              const isCurrent = selectedTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => selectTrack(track)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: radius.md,
                    backgroundColor: isCurrent ? 'rgba(245,197,66,0.08)' : colors.surface,
                    border: `1px solid ${isCurrent ? colors.accent : colors.border}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: isCurrent ? colors.accent : 'rgba(245,197,66,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: '18px', color: isCurrent ? colors.bg : colors.accent }}>
                      {isCurrent && isPlaying ? '⏸' : '▶'}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: colors.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {track.title}
                    </div>
                    <div style={{ fontSize: '12px', color: colors.textMuted }}>
                      {[track.speaker, formatDur(track.duration)].filter(Boolean).join('  •  ')}
                    </div>
                  </div>
                  {track.category && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: colors.textMuted,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        padding: '2px 6px',
                        borderRadius: radius.pill,
                        textTransform: 'uppercase',
                        flexShrink: 0,
                      }}
                    >
                      {track.category}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
