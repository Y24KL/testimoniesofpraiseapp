import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { SkeletonCard } from '@/components/SkeletonCard';
import { TestimonyCard } from '@/components/TestimonyCard';
import { TopBar } from '@/components/TopBar';
import { colors, type as t } from '@/constants/theme';
import { useTestimonies } from '@/hooks/useContent';
import { messageFor } from '@/utils/errors';

export function TestimoniesScreen() {
  const nav = useNavigation();
  const q = useTestimonies();
  return (
    <Screen>
      <TopBar title="Testimonies" onSearch={() => nav.navigate('Search')} onNotifications={() => nav.navigate('Notifications')} onProfile={() => nav.navigate('Profile')} />
      {q.fromCache ? <Text style={styles.cached}>Showing saved content</Text> : null}
      {q.loading ? (
        <View style={{ padding: 16, gap: 16 }}>{[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} horizontal />)}</View>
      ) : q.error ? (
        <ErrorState message={messageFor(q.error)} onRetry={q.retry} />
      ) : (
        <FlatList
          data={q.items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <TestimonyCard item={item} onPress={() => nav.navigate('TestimonyDetails', { id: item.id })} />}
          onEndReached={q.loadMore}
          onEndReachedThreshold={0.6}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.accent} />}
          ListEmptyComponent={<EmptyState icon="videocam-outline" title="No testimonies yet" message="Check back soon." />}
          ListFooterComponent={q.loadingMore ? <ActivityIndicator color={colors.accent} style={{ margin: 16 }} /> : null}
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ cached: { ...t.small, color: colors.textMuted, textAlign: 'center', paddingBottom: 6 } });
