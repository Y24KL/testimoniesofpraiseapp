import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, type as t } from '@/constants/theme';
import { downloadKey, useDownloads } from '@/downloads/DownloadsContext';
import type { Resource, Testimony } from '@/types';
import { MESSAGES } from '@/utils/errors';
import { formatBytes } from '@/utils/format';
import { PrimaryButton } from './PrimaryButton';

type Props = { kind: 'testimony'; data: Testimony } | { kind: 'resource'; data: Resource };

/** Renders nothing unless the Admin Portal allowed downloads (isDownloadable). */
export function DownloadButton({ kind, data }: Props) {
  const dl = useDownloads();
  const key = downloadKey(kind, data.id);
  const item = dl.get(key);
  const go = () => void dl.start({ kind, data } as Parameters<typeof dl.start>[0]);

  if (!data.isDownloadable && !item) return null;

  if (item?.status === 'downloading') {
    const pct = Math.round(item.progress * 100);
    return (
      <View style={styles.box}>
        <Text style={styles.status} accessibilityLiveRegion="polite">{`Downloading... ${pct}%`}</Text>
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        <PrimaryButton title="CANCEL" variant="outline" icon="close" onPress={() => void dl.cancel(key)} />
      </View>
    );
  }

  if (item?.status === 'done') {
    return (
      <View style={[styles.done]} accessible accessibilityLabel="Downloaded">
        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        <Text style={styles.doneText}>✓ DOWNLOADED</Text>
        {item.sizeBytes ? <Text style={styles.size}>{formatBytes(item.sizeBytes)}</Text> : null}
      </View>
    );
  }

  if (item?.status === 'failed') {
    const why =
      item.failure === 'storage'
        ? 'Not enough storage space on your device.'
        : item.failure === 'unsupported'
          ? 'This live-style video can’t be saved for offline viewing.'
          : MESSAGES.download;
    return (
      <View style={styles.box}>
        <Text style={styles.error} accessibilityRole="alert">{why}</Text>
        {item.failure !== 'unsupported' ? <PrimaryButton title="RETRY" icon="refresh" onPress={() => { void dl.remove(key).then(go); }} /> : null}
      </View>
    );
  }

  return <PrimaryButton title="DOWNLOAD" icon="download-outline" onPress={go} accessibilityHint="Saves this for offline viewing" />;
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  status: { ...t.small, color: colors.text, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.card, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.accent },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', minHeight: 52, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.success },
  doneText: { ...t.h3, color: colors.success, letterSpacing: 0.6 },
  size: { ...t.small, color: colors.textMuted },
  error: { ...t.body, color: colors.danger, textAlign: 'center' },
});
