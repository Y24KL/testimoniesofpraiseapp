import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { repo } from '@/api';
import { DownloadButton } from '@/components/DownloadButton';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { VideoPlayer } from '@/components/VideoPlayer';
import { colors, type as t } from '@/constants/theme';
import { downloadKey, useDownloads } from '@/downloads/DownloadsContext';
import type { RootStackParamList } from '@/navigation/types';
import type { LoveworldSingersVideo } from '@/types';
import { MESSAGES, messageFor, toAppError } from '@/utils/errors';
import { formatDate, formatDuration } from '@/utils/format';
import { shareMediaUrl } from '@/utils/links';
import { PrimaryButton } from '@/components/PrimaryButton';

/**
 * Player for one LoveWorld Singers video. Plays the saved copy when it is downloaded, so it works
 * offline. "Back to library" returns to the list the viewer came from.
 */
export function LoveworldSingerVideoScreen() {
  const nav = useNavigation();
  const { id } = useRoute<RouteProp<RootStackParamList, 'LoveworldSingerVideo'>>().params;
  const dl = useDownloads();
  const key = downloadKey('singers', id);
  const saved = dl.get(key);
  const [item, setItem] = useState<LoveworldSingersVideo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    repo
      .getLoveworldSingersVideo(id)
      .then((v) => {
        if (cancelled) return;
        if (!v) setNotFound(true); // unpublished or removed in the Admin Portal
        else setItem(v);
      })
      .catch((e) => {
        if (cancelled) return;
        // Offline with a saved copy: keep playing it.
        if (saved?.status !== 'done') setError(messageFor(e));
        else if (toAppError(e).kind === 'permission') setError(MESSAGES.generic);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  const local = dl.localUri(key);
  const uri = local ?? item?.videoUrl;
  const title = item?.title ?? saved?.title ?? 'Video';
  const backToLibrary = () => nav.goBack();

  return (
    <Screen>
      <TopBar title="LoveWorld Singers" onBack={backToLibrary} />
      {notFound && !item && !local ? (
        <ErrorState message="This video is no longer available." onRetry={backToLibrary} />
      ) : error && !item && !local ? (
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !item && !local ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadingSpinner label="LOADING PRAISE" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {uri ? (
            <VideoPlayer uri={uri} contentId={id} label={title} autoPlay />
          ) : (
            <ErrorState compact message={MESSAGES.video} />
          )}
          <View style={{ gap: 6 }}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            {item ? (
              <Text style={styles.meta}>{[formatDate(item.publishedAt), formatDuration(item.duration)].filter(Boolean).join('  •  ')}</Text>
            ) : null}
          </View>
          {item?.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          <View style={{ gap: 12 }}>
            {item ? <DownloadButton kind="singers" data={item} /> : null}
            {item ? (
              <PrimaryButton title="Share" icon="share-social-outline" variant="outline" onPress={() => void shareMediaUrl(item.title, item.videoUrl, 'video')} />
            ) : null}
            <PrimaryButton title="Back to library" icon="arrow-back" variant="outline" onPress={backToLibrary} />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  title: { ...t.h1, fontSize: 24, color: colors.text },
  meta: { ...t.small, color: colors.textMuted },
  desc: { ...t.body, color: colors.text },
});
