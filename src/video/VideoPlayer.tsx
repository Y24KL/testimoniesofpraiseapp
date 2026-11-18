import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEvent, useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';
import { colors, radius } from '@/constants/theme';
import { track } from '@/analytics';
import { useAudioPlayer } from '@/audio/AudioPlayerContext';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/auth/AuthContext';
import { MESSAGES } from '@/utils/errors';
import { isHls } from '@/utils/format';
import { getProgress, type SaveInput } from '@/library/service';
import { resumeFrom } from '@/library/rules';
import { ProgressRecorder } from '@/library/progress';

interface Props {
  /** https URL (mp4 / m3u8) or a local file:// URI for downloaded content */
  uri: string;
  /** used for resume + analytics. Omit for live. */
  contentId?: string;
  live?: boolean;
  autoPlay?: boolean;
  label: string;
  /** Start at this second (a moment found by search). Takes priority over the saved resume position. */
  startAt?: number;
  /**
   * My T.O.P.: when given and the person is signed in, the position is saved to their account, so it resumes on
   * their other devices. Without it the player keeps its on-device resume only.
   */
  library?: SaveInput;
}

export function VideoPlayer({ uri, contentId, live, autoPlay, label, startAt, library }: Props) {
  const [failed, setFailed] = useState(false);
  const resumed = useRef(false);
  const played = useRef(false);
  const recorder = useRef<ProgressRecorder | null>(null);
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const libraryKind = library?.kind;
  const libraryId = library?.id;
  const libraryTitle = library?.title;
  const libraryThumb = library?.thumbnail;
  const libraryActive = Boolean(uid && library && !live && contentId);

  const source = { uri, contentType: isHls(uri) ? ('hls' as const) : ('auto' as const) };
  const player = useVideoPlayer(source, (p) => {
    p.timeUpdateEventInterval = 5;
    p.loop = false;
    if (autoPlay) p.play();
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // A moment found by search: jump straight to it once the video is ready.
  useEffect(() => {
    if (live || !startAt || status !== 'readyToPlay' || resumed.current) return;
    resumed.current = true;
    player.currentTime = Math.max(0, startAt);
    player.play();
  }, [status, live, startAt, player]);

  // The recorder that keeps the account's position in step (My T.O.P.). Only for signed-in viewers of recorded videos.
  useEffect(() => {
    recorder.current = libraryActive && uid && libraryKind && libraryId ? new ProgressRecorder(uid, { kind: libraryKind, id: libraryId, title: libraryTitle ?? '', thumbnail: libraryThumb }) : null;
  }, [libraryActive, uid, libraryKind, libraryId, libraryTitle, libraryThumb]);

  // Resume where the viewer left off. The furthest of this device and the account wins (recorded videos only).
  useEffect(() => {
    if (live || !contentId || status !== 'readyToPlay' || resumed.current) return;
    resumed.current = true;
    void (async () => {
      const localRaw = await AsyncStorage.getItem(STORAGE_KEYS.playbackPrefix + contentId).catch(() => null);
      const remote = libraryActive && uid && libraryKind && libraryId ? await getProgress(uid, libraryKind, libraryId).catch(() => null) : null;
      const at = resumeFrom({
        localSec: localRaw === null ? null : Number(localRaw),
        remoteSec: remote?.positionSec,
        remoteCompleted: remote?.completed,
        durationSec: player.duration > 0 ? player.duration : undefined,
      });
      if (at > 0) player.currentTime = at;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, live, contentId, player, libraryActive, uid, libraryKind, libraryId]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (live || !contentId || currentTime < 5) return;
    void AsyncStorage.setItem(STORAGE_KEYS.playbackPrefix + contentId, String(Math.floor(currentTime)));
    recorder.current?.update(currentTime, player.duration, false);
  });

  // Pausing saves the exact position at once, so another device never resumes from a stale point.
  useEffect(() => {
    if (!isPlaying && played.current && recorder.current && player.currentTime > 0) {
      recorder.current.update(player.currentTime, player.duration, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  useEventListener(player, 'playToEnd', () => {
    if (contentId) {
      void AsyncStorage.removeItem(STORAGE_KEYS.playbackPrefix + contentId);
      track('video_complete', { contentId });
    }
    if (recorder.current && player.duration > 0) recorder.current.update(player.duration, player.duration, true);
  });

  // Starting a video pauses radio / audio testimonies so two soundtracks never overlap.
  const audio = useAudioPlayer();
  useEffect(() => {
    if (isPlaying && audio.status === 'playing') audio.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

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
