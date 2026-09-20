import React, { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { repo } from '@/api';
import { DownloadButton } from '@/components/DownloadButton';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { VideoPlayer } from '@/components/VideoPlayer';
import { colors, type as t } from '@/constants/theme';
import { downloadKey, useDownloads } from '@/downloads/DownloadsContext';
import type { RootStackParamList } from '@/navigation/types';
import type { Testimony } from '@/types';
import { MESSAGES, messageFor, toAppError } from '@/utils/errors';
import { formatDate, formatDuration } from '@/utils/format';
import { shareMessage } from '@/utils/links';

export function TestimonyDetailsScreen() {
  const nav = useNavigation();
  const { id } = useRoute<RouteProp<RootStackParamList, 'TestimonyDetails'>>().params;
  const dl = useDownloads();
  const key = downloadKey('testimony', id);
  const saved = dl.get(key);
  const [item, setItem] = useState<Testimony | null>(saved?.status === 'done' ? (saved.data as Testimony) : null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    repo
      .getTestimony(id)
      .then((t) => {
        if (cancelled) return;
        if (!t) setNotFound(true); // unpublished / removed by the Admin Portal
        else setItem(t);
      })
      .catch((e) => {
        if (cancelled) return;
        // Offline with a downloaded copy: keep showing it.
        if (!(saved?.status === 'done')) setError(messageFor(e));
        else if (toAppError(e).kind === 'permission') setError(MESSAGES.generic);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  const local = dl.localUri(key);
  const uri = local ?? item?.videoUrl;

  return (
    <Screen>
      <TopBar title="Testimony" onBack={() => nav.goBack()} />
      {notFound && !item ? (
        <ErrorState message="This testimony is no longer available." onRetry={() => nav.goBack()} />
      ) : error && !item ? (
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !item ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner label="LOADING PRAISE" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {uri ? <VideoPlayer uri={uri} contentId={item.id} label={item.title} autoPlay /> : <ErrorState compact message={MESSAGES.video} />}
          <View style={{ gap: 6 }}>
            {item.category ? <Text style={styles.cat}>{item.category.toUpperCase()}</Text> : null}
            <Text style={styles.title} accessibilityRole="header">{item.title}</Text>
            <Text style={styles.meta}>{[item.authorName, formatDate(item.publishedAt ?? item.createdAt), formatDuration(item.duration)].filter(Boolean).join('  •  ')}</Text>
          </View>
          {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          <View style={{ gap: 12 }}>
            <DownloadButton kind="testimony" data={item} />
            <PrimaryButton title="SHARE" icon="share-social-outline" variant="outline" onPress={() => void Share.share({ message: shareMessage(item.title) })} />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  cat: { ...t.caps, color: colors.accent },
  title: { ...t.h1, fontSize: 24, color: colors.text },
  meta: { ...t.small, color: colors.textMuted },
  desc: { ...t.body, color: colors.text },
});
