import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { colors, radius } from '../theme';
import { isHls } from '../api/repository';
import { track } from '../api/analytics';
import { ErrorState } from './ErrorState';

interface Props {
  uri: string;
  contentId?: string;
  live?: boolean;
  autoPlay?: boolean;
  label?: string;
}

const PLAYBACK_PREFIX = 'top:playback:v1:';

export function VideoPlayer({ uri, contentId, live = false, autoPlay = true, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const playedRef = useRef(false);
  const resumedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !uri) return;

    setError(false);
    setLoading(true);
    let hls: Hls | null = null;

    const isHlsStream = isHls(uri);

    // iOS Safari has native HLS support
    if (isHlsStream && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = uri;
      if (autoPlay) {
        video.play().catch(() => {});
      }
    } else if (isHlsStream && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.loadSource(uri);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        if (autoPlay) {
          video.play().catch(() => {});
        }
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError(true);
        }
      });
    } else {
      // Standard MP4 or video source
      video.src = uri;
      if (autoPlay) {
        video.play().catch(() => {});
      }
    }

    const onPlay = () => {
      setLoading(false);
      if (!playedRef.current) {
        playedRef.current = true;
        track(live ? 'live_play' : 'video_play', contentId ? { contentId } : {});
      }
    };

    const onLoadedMetadata = () => {
      setLoading(false);
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
