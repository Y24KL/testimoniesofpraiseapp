import React, { useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import { colors, radius } from '../theme';
import { isHls } from '../api/repository';
import { track } from '../api/analytics';
import { ErrorState } from './ErrorState';
import { useAudioPlayer } from '../audio/AudioPlayerContext';

interface Props {
  uri: string;
  contentId?: string;
  live?: boolean;
  autoPlay?: boolean;
  label?: string;
  /** Start at this second (a moment found by search). Takes priority over the saved resume position. */
  startAt?: number;
}

const PLAYBACK_PREFIX = 'top:playback:v1:';

export function VideoPlayer({ uri, contentId, live = false, autoPlay = true, label, startAt }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const playedRef = useRef(false);
  const resumedRef = useRef(false);
  const audio = useAudioPlayer();
  const pauseAudioRef = useRef(audio.pause);
  const audioPlayingRef = useRef(false);
  pauseAudioRef.current = audio.pause;
  audioPlayingRef.current = audio.status === 'playing';

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !uri) return;

    setError(false);
    setLoading(true);
    let hls: Hls | null = null;
    let cancelled = false;

    const isHlsStream = isHls(uri);

    // iOS Safari has native HLS support
    if (isHlsStream && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = uri;
      if (autoPlay) {
        video.play().catch(() => {});
      }
    } else if (isHlsStream) {
      // hls.js is ~590 KB: fetch it only when an HLS stream is actually opened.
      import('hls.js')
        .then(({ default: HlsLib }) => {
          if (cancelled) return;
          if (!HlsLib.isSupported()) {
            setError(true);
            return;
          }
          const h = new HlsLib({ enableWorker: true, lowLatencyMode: true });
          hls = h;
          h.loadSource(uri);
          h.attachMedia(video);
          h.on(HlsLib.Events.MANIFEST_PARSED, () => {
            setLoading(false);
            if (autoPlay) video.play().catch(() => {});
          });
          h.on(HlsLib.Events.ERROR, (_event, data) => {
            if (data.fatal) setError(true);
          });
        })
        .catch(() => setError(true));
    } else {
      // Standard MP4 or video source
      video.src = uri;
      if (autoPlay) {
        video.play().catch(() => {});
      }
    }

    const onPlay = () => {
      setLoading(false);
      // Starting a video pauses radio / audio testimonies so two soundtracks never overlap.
      if (audioPlayingRef.current) pauseAudioRef.current();
      if (!playedRef.current) {
        playedRef.current = true;
        track(live ? 'live_play' : 'video_play', contentId ? { contentId } : {});
      }
    };

    const onLoadedMetadata = () => {
      setLoading(false);
      // A moment found by search: start there (browsers allow autoplay here because the user tapped a result).
      if (!live && startAt && startAt > 0 && !resumedRef.current) {
        resumedRef.current = true;
        video.currentTime = Math.min(startAt, Math.max(0, video.duration - 1));
        void video.play().catch(() => undefined);
        return;
      }
      // Resume playback timestamp if not live
      if (!live && contentId && !resumedRef.current) {
        resumedRef.current = true;
        const saved = localStorage.getItem(PLAYBACK_PREFIX + contentId);
        const sec = Number(saved);
        if (sec > 5 && sec < video.duration - 10) {
          video.currentTime = sec;
        }
      }
    };

    const onTimeUpdate = () => {
      if (!live && contentId && video.currentTime > 5) {
        localStorage.setItem(PLAYBACK_PREFIX + contentId, String(Math.floor(video.currentTime)));
      }
    };

    const onEnded = () => {
      if (contentId) {
        localStorage.removeItem(PLAYBACK_PREFIX + contentId);
        track('video_complete', { contentId });
      }
    };

    const onError = () => {
      setError(true);
      setLoading(false);
    };

    video.addEventListener('playing', onPlay);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('playing', onPlay);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      cancelled = true;
      if (hls) {
        hls.destroy();
      }
    };
  }, [uri, contentId, live, autoPlay]);

  if (error) {
    return (
      <div
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          backgroundColor: '#000',
          borderRadius: radius.md,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ErrorState
          compact
          message="Unable to play this video. Please try again."
          onRetry={() => {
            setError(false);
            setLoading(true);
            if (videoRef.current) {
              videoRef.current.load();
              videoRef.current.play().catch(() => {});
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        backgroundColor: '#000',
        borderRadius: radius.md,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <video
        ref={videoRef}
        controls
        playsInline
        webkit-playsinline="true"
        x-webkit-airplay="allow"
        aria-label={label ?? 'Video player'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000',
        }}
      />
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              border: `3px solid ${colors.border}`,
              borderTopColor: colors.accent,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}
    </div>
  );
}
