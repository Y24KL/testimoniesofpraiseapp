import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PromotionCard } from '@/components/PromotionCard';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { colors } from '@/constants/theme';
import type { Promotion } from '@/types';
import { messageFor } from '@/utils/errors';

export function PromotionsScreen() {
  const nav = useNavigation();
  const [items, setItems] = useState<Promotion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await repo.getPromotions();
      setItems(list);
      setError(null);
    } catch (e) {
      setError(messageFor(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <TopBar title="Promotions & Highlights" onBack={() => nav.goBack()} />
      {error ? (
        <ErrorState message={error} onRetry={() => { setError(null); void load(); }} />
      ) : !items ? (
        <LoadingSpinner label="LOADING HIGHLIGHTS" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PromotionCard item={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.accent}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="megaphone-outline"
              title="No Promotions Active"
              message="Check back soon for upcoming events, programs, and announcements."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 16,
    paddingBottom: 32,
  },
});
