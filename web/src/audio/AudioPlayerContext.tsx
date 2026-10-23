import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type Hls from 'hls.js';
import { isHls } from '../api/repository';
import { useRadioListener } from '../hooks/useRadioListener';
import { useAuth } from '../context/AuthContext';

/**
 * One audio element for the whole site (TOP Radio + audio testimonies). It lives above the router,
 * so playback continues while the visitor moves between pages and two streams can never overlap.
 *
 * Background playback on the web is best-effort: desktop browsers and Android Chrome usually keep
 * an <audio> element playing in a background tab or with the screen off; iOS Safari may pause it
 * when the page is backgrounded or the device locks, and any browser may suspend a tab to save
 * power. The Media Session API adds lock-screen / notification controls where supported.
 */

export interface AudioTrack {
  id: string;
  url: string;
  title: string;
  artist?: string;
  artwork?: string;
  live?: boolean;
  sessionId?: string;
}

export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'reconnecting' | 'error';

interface AudioValue {
  track: AudioTrack | null;
  status: AudioStatus;
  error: string | null;
  play(track: AudioTrack): void;
  toggle(): void;
  pause(): void;
  stop(): void;
}

const Ctx = createContext<AudioValue | null>(null);
const RETRY_DELAYS_MS = [2000, 5000, 10000];

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const trackRef = useRef<AudioTrack | null>(null);
  const wantsPlay = useRef(false);
  const retries = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [status, setStatus] = useState<AudioStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const el = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'none';
      a.setAttribute('playsinline', '');
      audioRef.current = a;
    }
    return audioRef.current;
  };

  const clearRetry = () => {
    if (retryTimer.current) window.clearTimeout(retryTimer.current);
    retryTimer.current = null;
  };

  const detach = () => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
  };

  const startPlayback = useCallback(async () => {
    try {
      await el().play();
    } catch (e) {
      // Autoplay policy: we only ever call this from a user gesture, but a reconnect may be blocked.
      if ((e as DOMException)?.name === 'NotAllowedError') {
        wantsPlay.current = false;
        setStatus('paused');
      }
    }
  }, []);

  const load = useCallback(
    async (t: AudioTrack) => {
      const a = el();
      detach();
      setStatus('loading');
      const nativeHls = a.canPlayType('application/vnd.apple.mpegurl') !== '';
      if (isHls(t.url) && !nativeHls) {
        // hls.js (~590 KB) is only downloaded the first time someone plays an HLS stream.
        const { default: HlsLib } = await import('hls.js');
        if (trackRef.current?.id !== t.id) return;
        if (HlsLib.isSupported()) {
          const hls = new HlsLib({ enableWorker: true, lowLatencyMode: false });
          hlsRef.current = hls;
          hls.on(HlsLib.Events.ERROR, (_e, data) => {
            if (data.fatal) a.dispatchEvent(new Event('error'));
          });
          hls.loadSource(t.url);
          hls.attachMedia(a);
        } else {
          a.src = t.url;
        }
      } else {
        a.src = t.url;
      }
      if (wantsPlay.current) void startPlayback();
    },
    [startPlayback],
  );

  // Element events -> status
  useEffect(() => {
    const a = el();
    const onPlaying = () => {
      retries.current = 0;
      setError(null);
      setStatus('playing');
    };
    const onPause = () => setStatus((s) => (s === 'reconnecting' || s === 'error' ? s : 'paused'));
    const onWaiting = () => setStatus((s) => (s === 'playing' || s === 'loading' ? 'loading' : s));
    const onEnded = () => {
      wantsPlay.current = false;
      setStatus('paused');
    };
    const onError = () => {
      const t = trackRef.current;
      if (!t || !a.src && !hlsRef.current) return;
      if (t.live && wantsPlay.current && retries.current < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[retries.current++];
        setStatus('reconnecting');
        clearRetry();
        retryTimer.current = window.setTimeout(() => {
          if (wantsPlay.current && trackRef.current?.id === t.id) void load(t);
        }, delay);
        return;
      }
      wantsPlay.current = false;
      setStatus('error');
      setError(navigator.onLine === false ? 'You are offline.' : 'This audio could not be played right now.');
    };
    a.addEventListener('playing', onPlaying);
    a.addEventListener('pause', onPause);
    a.addEventListener('waiting', onWaiting);
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    return () => {
      a.removeEventListener('playing', onPlaying);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('waiting', onWaiting);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
    };
  }, [load]);

  const play = useCallback(
    (next: AudioTrack) => {
      clearRetry();
      retries.current = 0;
      setError(null);
      wantsPlay.current = true;
      const same = trackRef.current?.id === next.id && trackRef.current.url === next.url;
      if (same && status !== 'error') {
        void startPlayback();
        return;
      }
      trackRef.current = next;
      setTrack(next);
      void load(next);
    },
    [load, startPlayback, status],
  );

  const pause = useCallback(() => {
    wantsPlay.current = false;
    clearRetry();
    el().pause();
    setStatus('paused');
  }, []);

  const stop = useCallback(() => {
    wantsPlay.current = false;
    clearRetry();
    const a = el();
    a.pause();
    detach();
    a.removeAttribute('src');
    a.load();
    trackRef.current = null;
    setTrack(null);
    setStatus('idle');
    setError(null);
  }, []);

  const toggle = useCallback(() => {
    const t = trackRef.current;
    if (!t) return;
    if (status === 'playing' || status === 'loading') pause();
    else play(t);
  }, [status, pause, play]);

  // Lock screen / notification / hardware media keys
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    if (!track) {
      ms.metadata = null;
      return;
    }
    ms.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist ?? 'Testimonies of Praise',
      album: track.live ? 'TOP Radio' : 'Audio testimonies',
      artwork: [{ src: track.artwork || '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
    ms.setActionHandler('play', () => trackRef.current && play(trackRef.current));
    ms.setActionHandler('pause', pause);
    ms.setActionHandler('stop', stop);
    return () => {
      ms.setActionHandler('play', null);
      ms.setActionHandler('pause', null);
      ms.setActionHandler('stop', null);
    };
  }, [track, play, pause, stop]);

  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = status === 'playing' ? 'playing' : track ? 'paused' : 'none';
    // Lets the layout reserve room for the floating mini player.
    document.documentElement.style.setProperty('--player-h', track ? '76px' : '0px');
  }, [status, track]);

  // Coming back online while a live stream wanted to play: try again once.
  useEffect(() => {
    const onOnline = () => {
      const t = trackRef.current;
      if (t && (status === 'error' || status === 'reconnecting') && t.live) {
        wantsPlay.current = true;
        retries.current = 0;
        void load(t);
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [status, load]);

  useEffect(() => () => {
    clearRetry();
    detach();
  }, []);

  // Signing out ends playback.
  const { user } = useAuth();
  useEffect(() => {
    if (!user && trackRef.current) stop();
  }, [user, stop]);

  useRadioListener(track?.live ? track.sessionId : undefined, status === 'playing');

  const value = useMemo(() => ({ track, status, error, play, toggle, pause, stop }), [track, status, error, play, toggle, pause, stop]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudioPlayer(): AudioValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAudioPlayer must be used inside AudioPlayerProvider');
  return v;
}
