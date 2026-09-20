import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEvent, useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';
import { colors, radius } from '@/constants/theme';
import { track } from '@/analytics';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { MESSAGES } from '@/utils/errors';
import { isHls } from '@/utils/format';

interface Props {
  /** https URL (mp4 / m3u8) or a local file:// URI for downloaded content */
  uri: string;
  /** used for resume + analytics. Omit for live. */
  contentId?: string;
  live?: boolean;
  autoPlay?: boolean;
  label: string;
}

export function VideoPlayer({ uri, contentId, live, autoPlay, label }: Props) {
  const [failed, setFailed] = useState(false);
  const resumed = useRef(false);
  const played = useRef(false);

  const source = { uri, contentType: isHls(uri) ? ('hls' as const) : ('auto' as const) };
  const player = useVideoPlayer(source, (p) => {
    p.timeUpdateEventInterval = 5;
    p.loop = false;
    if (autoPlay) p.play();
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Resume where the viewer left off (recorded videos only)
  useEffect(() => {
    if (live || !contentId || status !== 'readyToPlay' || resumed.current) return;
    resumed.current = true;
    AsyncStorage.getItem(STORAGE_KEYS.playbackPrefix + contentId).then((v) => {
      const t = Number(v);
      if (t > 5) player.currentTime = t;
    });
  }, [status, live, contentId, player]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (live || !contentId || currentTime < 5) return;
    void AsyncStorage.setItem(STORAGE_KEYS.playbackPrefix + contentId, String(Math.floor(currentTime)));
  });

  useEventListener(player, 'playToEnd', () => {
    if (contentId) {
      void AsyncStorage.removeItem(STORAGE_KEYS.playbackPrefix + contentId);
      track('video_complete', { contentId });
    }
  });

  useEffect(() => {
    if (isPlaying && !played.current) {
      played.current = true;
      track(live ? 'live_play' : 'video_play', contentId ? { contentId } : {});
    }
  }, [isPlaying, live, contentId]);

  useEffect(() => {
    setFailed(status === 'error');
  }, [status]);

  const retry = useCallback(() => {
    setFailed(false);
    player.replace(source);
    player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, uri]);

  return (
    <View style={styles.wrap}>
      {failed ? (
        <ErrorState compact message={MESSAGES.video} onRetry={retry} />
      ) : (
        <>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            nativeControls
            allowsFullscreen
            allowsPictureInPicture
            contentFit="contain"
            accessibilityLabel={label}
          />
          {status === 'loading' ? (
            <View style={styles.loading} pointerEvents="none">
              <LoadingSpinner size={36} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: radius.md, overflow: 'hidden', justifyContent: 'center' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay },
});
