import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useEvent, useEventListener } from 'expo';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer, type VideoSource } from 'expo-video';
import { useAuth } from '@/auth/AuthContext';
import { CONFIG } from '@/constants/config';
import { useRadioListener } from '@/hooks/useRadioListener';
import { isHls } from '@/utils/format';

/**
 * One app-wide audio player (TOP Radio + audio testimonies).
 *
 * It lives above the navigator, so playback keeps going when the user switches tabs or opens other
 * screens, and there can never be two audio streams at once. It reuses expo-video (already used
 * for video) instead of adding a second media library: with the `expo-video` config plugin's
 * `supportsBackgroundPlayback` enabled (app.config.ts) it keeps playing with the screen locked or
 * the app in the background, and `showNowPlayingNotification` gives Android notification /
 * lock-screen controls and the iOS Now Playing / Control Center controls.
 *
 * iOS caveat (the cause of "audio stops when I lock my iPhone"): AVPlayer pauses content that has a
 * VIDEO track when the app is backgrounded, unless its background policy is "continuesIfPossible".
 * expo-video only sets that policy for players attached to a VideoView, and TOP Radio's stream is an
 * HLS video+audio stream. So while audio is loaded the player is attached to an invisible 1x1
 * VideoView below; expo-video then keeps it playing in the background (Android is unaffected:
 * ExoPlayer keeps decoding audio without a surface, inside expo-video's foreground media service).
 */

export interface AudioTrack {
  /** Stable id, e.g. `radio:<sessionId>` or `audio:<docId>` */
  id: string;
  url: string;
  title: string;
  artist?: string;
  artwork?: string;
  /** Continuous stream (TOP Radio): no seeking, reconnects on drop-outs. */
  live?: boolean;
  /** Radio session id, used for the listener-count heartbeat. */
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

// Bounded reconnects for live streams: never an infinite retry loop.
const RETRY_DELAYS_MS = [2000, 5000, 10000];
const DEFAULT_ARTWORK = `${CONFIG.websiteUrl}/logo.png`;

function toSource(t: AudioTrack): VideoSource {
  return {
    uri: t.url,
    contentType: isHls(t.url) ? 'hls' : 'auto',
    metadata: { title: t.title, artist: t.artist ?? 'Testimonies of Praise', artwork: t.artwork ?? DEFAULT_ARTWORK },
  };
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  // What the USER asked for. We only resume/reconnect while this is true, so an explicit pause or
  // stop is always respected and nothing starts on its own.
  const wantsPlay = useRef(false);
  const retries = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackRef = useRef<AudioTrack | null>(null);

  const player = useVideoPlayer(null, (p) => {
    p.staysActiveInBackground = true;
    p.showNowPlayingNotification = true;
    p.audioMixingMode = 'doNotMix';
    p.loop = false;
    // Attaching the hidden VideoView must not keep the screen awake during audio.
    p.keepScreenOnWhilePlaying = false;
  });

  const { status: playerStatus } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  const clearRetry = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  };

  useEventListener(player, 'statusChange', ({ status, error: e }) => {
    const current = trackRef.current;
    if (status === 'readyToPlay') {
      retries.current = 0;
      setReconnecting(false);
      setError(null);
      if (wantsPlay.current && !player.playing) player.play();
      return;
    }
    if (status !== 'error' || !current) return;
    if (current.live && wantsPlay.current && retries.current < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[retries.current++];
      setReconnecting(true);
      clearRetry();
      retryTimer.current = setTimeout(() => {
        if (!wantsPlay.current || trackRef.current?.id !== current.id) return;
        player.replace(toSource(current));
        player.play();
      }, delay);
      return;
    }
    setReconnecting(false);
    wantsPlay.current = false;
    setError(e?.message ? 'This audio could not be played right now.' : 'Playback failed. Check your connection and try again.');
  });

  useEventListener(player, 'playToEnd', () => {
    wantsPlay.current = false;
  });

  useEffect(() => clearRetry, []);

  const play = useCallback(
    (next: AudioTrack) => {
      clearRetry();
      retries.current = 0;
      setError(null);
      setReconnecting(false);
      wantsPlay.current = true;
      if (trackRef.current?.id === next.id && trackRef.current.url === next.url && player.status !== 'error') {
        player.play();
        return;
      }
      trackRef.current = next;
      setTrack(next);
      player.replace(toSource(next));
      player.play();
    },
    [player],
  );

  const pause = useCallback(() => {
    wantsPlay.current = false;
    clearRetry();
    setReconnecting(false);
    player.pause();
  }, [player]);

  const stop = useCallback(() => {
    wantsPlay.current = false;
    clearRetry();
    setReconnecting(false);
    setError(null);
    player.pause();
    player.replace(null);
    trackRef.current = null;
    setTrack(null);
  }, [player]);

  const toggle = useCallback(() => {
    const current = trackRef.current;
    if (!current) return;
    if (player.playing) pause();
    else play(current);
  }, [player, pause, play]);

  const status: AudioStatus = !track
    ? 'idle'
    : error
      ? 'error'
      : reconnecting
        ? 'reconnecting'
        : isPlaying
          ? 'playing'
          : playerStatus === 'loading' && wantsPlay.current
            ? 'loading'
            : 'paused';

  // Signing out ends playback (the next account starts with a clean player).
  const { user } = useAuth();
  useEffect(() => {
    if (!user && trackRef.current) stop();
  }, [user, stop]);

  // Listener count for TOP Radio follows real playback, wherever the user is in the app.
  useRadioListener(track?.live ? track.sessionId : undefined, status === 'playing');

  const value = useMemo(() => ({ track, status, error, play, toggle, pause, stop }), [track, status, error, play, toggle, pause, stop]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {track ? (
        <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <VideoView player={player} style={styles.hidden} nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false} />
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  // Must stay mounted (and on screen) so expo-video registers it; invisible and untouchable.
  hidden: { position: 'absolute', left: 0, bottom: 0, width: 1, height: 1, opacity: 0.01 },
});

export function useAudioPlayer(): AudioValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAudioPlayer must be used inside AudioPlayerProvider');
  return v;
}
