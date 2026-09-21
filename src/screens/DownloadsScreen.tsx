import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import { useDownloads } from '@/downloads/DownloadsContext';
import type { DownloadItem } from '@/types';
import { MESSAGES } from '@/utils/errors';
import { formatBytes } from '@/utils/format';

export function DownloadsScreen() {
  const nav = useNavigation();
  const dl = useDownloads();

  const open = (i: DownloadItem) => nav.navigate('TestimonyDetails', { id: i.id });

  return (
    <Screen>
      <TopBar title="Downloads" onNotifications={() => nav.navigate('Notifications')} onProfile={() => nav.navigate('Profile')} />
      <FlatList
        data={dl.items}
        keyExtractor={(i) => i.key}
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={dl.ready ? <EmptyState icon="download-outline" title="No downloads yet" message="Content you download appears here and works without internet." /> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => open(item)} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.status}`}>
            <View style={styles.thumb}>
              {item.thumbnail ? <Image source={item.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="document" size={26} color={colors.primaryLight} />}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              {item.status === 'downloading' ? (
                <>
                  <Text style={styles.meta}>{`Downloading... ${Math.round(item.progress * 100)}%`}</Text>
                  <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(item.progress * 100)}%` }]} /></View>
                </>
              ) : item.status === 'done' ? (
                <Text style={[styles.meta, { color: colors.success }]}>{`✓ DOWNLOADED${item.sizeBytes ? `  •  ${formatBytes(item.sizeBytes)}` : ''}`}</Text>
              ) : (
                <Text style={[styles.meta, { color: colors.danger }]}>{MESSAGES.download.replace('\n', ' ')}</Text>
              )}
            </View>
            {item.status === 'downloading' ? (
              <Pressable onPress={() => void dl.cancel(item.key)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Cancel download of ${item.title}`}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
              </Pressable>
            ) : (
              <Pressable onPress={() => void dl.remove(item.key)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`}>
                <Ionicons name="trash-outline" size={22} color={colors.textMuted} />
              </Pressable>
            )}
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  thumb: { width: 84, height: 60, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  title: { ...t.h3, fontSize: 15, color: colors.text },
  meta: { ...t.small, color: colors.textMuted },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.card, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.accent },
});
