import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { NotificationCard } from '@/components/NotificationCard';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { colors } from '@/constants/theme';
import { openTarget } from '@/notifications/routing';
import { cacheGet, cacheSet } from '@/storage/cache';
import type { AppNotification } from '@/types';
import { messageFor } from '@/utils/errors';

export function NotificationsScreen() {
  const nav = useNavigation();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await repo.getNotifications(50);
      setItems(list);
      setError(null);
      void cacheSet('notifications', list);
    } catch (e) {
      const cached = await cacheGet<AppNotification[]>('notifications');
      if (cached) setItems(cached);
      else setError(messageFor(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <TopBar title="Notifications" onBack={() => nav.goBack()} />
      {error ? (
        <ErrorState message={error} onRetry={() => { setError(null); void load(); }} />
      ) : !items ? (
        <LoadingSpinner label="LOADING PRAISE" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <NotificationCard item={item} onPress={() => openTarget(item)} />}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListEmptyComponent={<EmptyState icon="notifications-outline" title="You’re all caught up" message="Announcements and new content alerts will appear here." />}
        />
      )}
    </Screen>
  );
}
