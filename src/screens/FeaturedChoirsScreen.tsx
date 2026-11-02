import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { SkeletonCard } from '@/components/SkeletonCard';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import type { FeaturedChoir } from '@/types';
import { messageFor } from '@/utils/errors';
import { formatDuration } from '@/utils/format';

/** Showcase of previously featured choir/group videos. Admins add entries in the Admin Portal. */
export function FeaturedChoirsScreen() {
  const nav = useNavigation();
  const [items, setItems] = useState<FeaturedChoir[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const busy = useRef(false);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (busy.current) return;
    busy.current = true;
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      setItems(await repo.getFeaturedChoirs());
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      busy.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  return (
    <Screen>
      <TopBar title="Featured choirs" onBack={() => nav.goBack()} />
      {loading ? (
        <View style={{ padding: 16, gap: 16 }}>
          {[0, 1].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState message={messageFor(error)} onRetry={() => void load('initial')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={colors.accent} />}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No featured choirs yet" message="Featured choirs and groups will appear here." />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => nav.navigate('FeaturedChoir', { id: item.id })}
              accessibilityRole="button"
              accessibilityLabel={`${item.groupName}, ${item.songTitle}`}
            >
              <View style={styles.thumb}>
                {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="people" size={30} color={colors.primaryLight} />}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.group} numberOfLines={1}>{item.groupName}</Text>
                <Text style={styles.song} numberOfLines={2}>{item.songTitle}</Text>
                {item.duration ? <Text style={styles.meta}>{formatDuration(item.duration)}</Text> : null}
              </View>
              <Ionicons name="play-circle" size={28} color={colors.accent} />
            </Pressable>
          )}
        />
      )}
      {/* Floating "+" opens the submission form. */}
      <Pressable
        style={styles.fab}
        onPress={() => nav.navigate('ChoirRequest')}
        accessibilityRole="button"
        accessibilityLabel="Submit your choir or group"
      >
        <Ionicons name="add" size={30} color={colors.onAccent} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, paddingBottom: 110 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 96, height: 64, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  group: { ...t.h3, fontSize: 15, color: colors.text },
  song: { ...t.small, color: colors.textMuted },
  meta: { ...t.caption, color: colors.textSubtle },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
