import React from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LiveCard } from '@/components/LiveCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ResourceCard } from '@/components/ResourceCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Skeleton, SkeletonCard } from '@/components/SkeletonCard';
import { TestimonyCard } from '@/components/TestimonyCard';
import { TopBar } from '@/components/TopBar';
import { VideoCard } from '@/components/VideoCard';
import { colors, radius, type as t } from '@/constants/theme';
import { useLive, useResources, useTestimonies } from '@/hooks/useContent';
import { messageFor } from '@/utils/errors';

export function HomeScreen() {
  const nav = useNavigation();
  const feat = useTestimonies({ featuredOnly: true, limit: 1 });
  const latest = useTestimonies({ limit: 10 });
  const resources = useResources({ limit: 4 });
  const { live } = useLive();

  const hero = feat.items[0] ?? latest.items[0];
  const rest = latest.items.filter((i) => i.id !== hero?.id);
  const refreshing = latest.refreshing || resources.refreshing || feat.refreshing;
  const onRefresh = () => {
    void feat.refresh();
    void latest.refresh();
    void resources.refresh();
  };

  return (
    <Screen>
      <TopBar brand onSearch={() => nav.navigate('Search')} onNotifications={() => nav.navigate('Notifications')} onProfile={() => nav.navigate('Profile')} />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />} contentContainerStyle={{ paddingBottom: 32 }}>
        {latest.loading && !hero ? (
          <View style={{ paddingHorizontal: 16, gap: 16 }}><SkeletonCard /><SkeletonCard horizontal /><SkeletonCard horizontal /></View>
        ) : latest.error && !hero ? (
          <ErrorState message={messageFor(latest.error)} onRetry={latest.retry} />
        ) : hero ? (
          <>
            <SectionHeader title="FEATURED" />
            <TestimonyCard item={hero} variant="hero" onPress={() => nav.navigate('TestimonyDetails', { id: hero.id })} />

            <SectionHeader title="LATEST TESTIMONIES" action="See all" onAction={() => nav.navigate('Tabs', { screen: 'Testimonies' })} />
            {rest.length ? (
              <FlatList
                horizontal
                data={rest}
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                renderItem={({ item }) => <VideoCard item={item} onPress={() => nav.navigate('TestimonyDetails', { id: item.id })} />}
              />
            ) : null}
          </>
        ) : (
          <EmptyState icon="videocam-outline" title="No testimonies yet" message="New testimonies will appear here as soon as they’re published." />
        )}

        <SectionHeader title="WATCH LIVE" />
        <LiveCard live={live} onPress={() => nav.navigate('Tabs', { screen: 'Live' })} />

        <View style={styles.cta}>
          <Text style={styles.ctaTitle}>Share your testimony</Text>
          <Text style={styles.ctaText}>What has God done for you? Someone needs to hear it.</Text>
          <PrimaryButton title="SHARE YOUR TESTIMONY" icon="heart-outline" onPress={() => nav.navigate('ShareTestimony')} />
        </View>

        <SectionHeader title="RESOURCE CENTER" action="See all" onAction={() => nav.navigate('Tabs', { screen: 'Resources' })} />
        {resources.loading && !resources.items.length ? (
          <View style={{ paddingHorizontal: 16 }}><Skeleton style={{ height: 84, borderRadius: radius.md }} /></View>
        ) : (
          resources.items.slice(0, 3).map((r) => <ResourceCard key={r.id} item={r} onPress={() => nav.navigate('ResourceDetails', { id: r.id })} />)
        )}

        {rest.length > 3 ? (
          <>
            <SectionHeader title="RECENTLY ADDED" />
            {rest.slice(-3).map((i) => <TestimonyCard key={i.id} item={i} onPress={() => nav.navigate('TestimonyDetails', { id: i.id })} />)}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cta: { margin: 16, marginTop: 24, padding: 18, gap: 10, borderRadius: radius.lg, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primaryLight },
  ctaTitle: { ...t.h2, color: colors.text },
  ctaText: { ...t.body, color: colors.textMuted },
});
