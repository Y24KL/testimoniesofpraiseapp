import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, type as t } from '@/constants/theme';
import { downloadKey, useDownloads } from '@/downloads/DownloadsContext';
import type { Resource } from '@/types';
import { formatDate } from '@/utils/format';
import { fileTypeLabel, resourceGroup } from '@/utils/resources';

const ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  VIDEOS: 'videocam',
  GRAPHICS: 'color-palette',
  ECARDS: 'mail',
  PHOTOS: 'image',
  DOCUMENTS: 'document-text',
  ADOTOPOC: 'sunny',
  OTHER: 'document',
};

export function ResourceCard({ item, onPress }: { item: Resource; onPress: () => void }) {
  const dl = useDownloads().get(downloadKey('resource', item.id));
  const group = resourceGroup(item);
  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${group.toLowerCase()}, ${fileTypeLabel(item)}${item.isDownloadable ? ', download available' : ''}`}
    >
      <View style={styles.thumb}>
        {item.thumbnail ? <Image source={item.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Ionicons name={ICON[group]} size={30} color={colors.primaryLight} />}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Text style={styles.cat}>{(item.category ?? group).toUpperCase()}</Text>
          <View style={styles.type}><Text style={styles.typeText}>{fileTypeLabel(item)}</Text></View>
        </View>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
          {dl?.status === 'done' ? (
            <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={13} color={colors.success} />
              <Text style={[styles.meta, { color: colors.success }]}>SAVED</Text>
            </View>
          ) : item.isDownloadable ? (
            <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
              <Ionicons name="download-outline" size={13} color={colors.textMuted} />
              <Text style={styles.meta}>Downloadable</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  thumb: { width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  cat: { ...t.caps, fontSize: 10, color: colors.accent },
  type: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 5 },
  typeText: { ...t.caps, fontSize: 9, color: colors.textMuted },
  title: { ...t.h3, fontSize: 15, color: colors.text },
  desc: { ...t.small, color: colors.textMuted },
  meta: { ...t.small, fontSize: 12, color: colors.textMuted },
});
