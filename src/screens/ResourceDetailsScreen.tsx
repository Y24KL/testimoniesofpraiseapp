import React, { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { repo } from '@/api';
import { track } from '@/analytics';
import { DownloadButton } from '@/components/DownloadButton';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { VideoPlayer } from '@/components/VideoPlayer';
import { colors, radius, type as t } from '@/constants/theme';
import { downloadKey, useDownloads } from '@/downloads/DownloadsContext';
import type { RootStackParamList } from '@/navigation/types';
import type { Resource } from '@/types';
import { messageFor } from '@/utils/errors';
import { formatDate } from '@/utils/format';
import { shareMessage } from '@/utils/links';
import { fileTypeLabel, isImageResource, isVideoResource } from '@/utils/resources';

export function ResourceDetailsScreen() {
  const nav = useNavigation();
  const { id } = useRoute<RouteProp<RootStackParamList, 'ResourceDetails'>>().params;
  const dl = useDownloads();
  const key = downloadKey('resource', id);
  const saved = dl.get(key);
  const [item, setItem] = useState<Resource | null>(saved?.status === 'done' ? (saved.data as Resource) : null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    repo
      .getResource(id)
      .then((r) => {
        if (cancelled) return;
        if (!r) setGone(true);
        else {
          setItem(r);
          track('resource_view', { contentId: id });
        }
      })
      .catch((e) => !cancelled && !(saved?.status === 'done') && setError(messageFor(e)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  const local = dl.localUri(key);
  const openLocal = async () => {
    if (local && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(local);
  };

  return (
    <Screen>
      <TopBar title="Resource" onBack={() => nav.goBack()} />
      {gone && !item ? (
        <ErrorState message="This resource is no longer available." onRetry={() => nav.goBack()} />
      ) : error && !item ? (
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !item ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner label="LOADING PRAISE" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {isVideoResource(item) ? (
            <VideoPlayer uri={local ?? item.fileUrl} contentId={`res-${item.id}`} label={item.title} />
          ) : isImageResource(item) ? (
            <Image source={local ?? item.fileUrl} style={styles.image} contentFit="contain" accessibilityLabel={item.title} />
          ) : (
            <View style={styles.doc}>
              {item.thumbnail ? <Image source={item.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="document-text" size={64} color={colors.primaryLight} />}
            </View>
          )}
          <View style={{ gap: 6 }}>
            <Text style={styles.cat}>{(item.category ?? 'RESOURCE').toUpperCase()}  •  {fileTypeLabel(item)}</Text>
            <Text style={styles.title} accessibilityRole="header">{item.title}</Text>
            <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
          </View>
          {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          <View style={{ gap: 12 }}>
            <DownloadButton kind="resource" data={item} />
            {local ? <PrimaryButton title="OPEN / SAVE TO DEVICE" icon="open-outline" variant="outline" onPress={openLocal} /> : null}
            <PrimaryButton title="SHARE" icon="share-social-outline" variant="outline" onPress={() => void Share.share({ message: shareMessage(item.title) })} />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  image: { width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.card },
  doc: { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cat: { ...t.caps, fontSize: 11, color: colors.accent },
  title: { ...t.h1, fontSize: 24, color: colors.text },
  meta: { ...t.small, color: colors.textMuted },
  desc: { ...t.body, color: colors.text },
});
