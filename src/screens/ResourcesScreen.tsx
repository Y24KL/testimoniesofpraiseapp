import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ResourceCard } from '@/components/ResourceCard';
import { Screen } from '@/components/Screen';
import { SkeletonCard } from '@/components/SkeletonCard';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import { useResources } from '@/hooks/useContent';
import type { ResourceGroup } from '@/types';
import { messageFor } from '@/utils/errors';
import { RESOURCE_GROUPS, resourceGroup } from '@/utils/resources';

export function ResourcesScreen() {
  const nav = useNavigation();
  const q = useResources({ limit: 24 });
  const [group, setGroup] = useState<ResourceGroup>('ALL');
  const data = useMemo(() => (group === 'ALL' ? q.items : q.items.filter((r) => resourceGroup(r) === group)), [q.items, group]);

  return (
    <Screen>
      <TopBar title="Resource Center" onSearch={() => nav.navigate('Search')} onNotifications={() => nav.navigate('Notifications')} onProfile={() => nav.navigate('Profile')} />
      <View>
        <FlatList
          horizontal
          data={RESOURCE_GROUPS}
          keyExtractor={(g) => g}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}
          renderItem={({ item: g }) => {
            const on = g === group;
            return (
              <Pressable onPress={() => setGroup(g)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={g}>
                <Text style={[styles.chipText, on && { color: colors.bg }]}>{g}</Text>
              </Pressable>
            );
          }}
        />
        {group === 'ADOTOPOC' ? <Text style={styles.adot}>A DAY OF TESTIMONIES OF PRAISE OUTREACHES AND CRUSADES</Text> : null}
      </View>
      {q.loading ? (
        <View style={{ padding: 16, gap: 16 }}>{[0, 1, 2, 3].map((i) => <SkeletonCard key={i} horizontal />)}</View>
      ) : q.error ? (
        <ErrorState message={messageFor(q.error)} onRetry={q.retry} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <ResourceCard item={item} onPress={() => nav.navigate('ResourceDetails', { id: item.id })} />}
          onEndReached={q.loadMore}
          onEndReachedThreshold={0.6}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.accent} />}
          ListEmptyComponent={<EmptyState icon="albums-outline" title="No resources here yet" message="New resources will appear as soon as they’re published." />}
          ListFooterComponent={q.loadingMore ? <ActivityIndicator color={colors.accent} style={{ margin: 16 }} /> : null}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...t.caps, fontSize: 11, color: colors.textMuted },
  adot: { ...t.caps, fontSize: 10, color: colors.accent, paddingHorizontal: 16, paddingBottom: 8 },
});
