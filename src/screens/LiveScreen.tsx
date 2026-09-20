import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/EmptyState';
import { LiveBadge } from '@/components/LiveCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { VideoPlayer } from '@/components/VideoPlayer';
import { colors, radius, type as t } from '@/constants/theme';
import { useLive } from '@/hooks/useContent';
import { MESSAGES } from '@/utils/errors';
import { useNavigation } from '@react-navigation/native';

export function LiveScreen() {
  const nav = useNavigation();
  const { live, error } = useLive();
  return (
    <Screen>
      <TopBar title="Watch Live" onNotifications={() => nav.navigate('Notifications')} onProfile={() => nav.navigate('Profile')} />
      {!live ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner label="LOADING PRAISE" /></View>
      ) : live.isLive && live.streamUrl ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* key forces a fresh player if the admin swaps the stream URL while we're watching */}
          <VideoPlayer key={live.streamUrl} uri={live.streamUrl} live autoPlay label={live.title ?? 'Live stream'} />
          <LiveBadge />
          <Text style={styles.title}>{live.title ?? 'Live now'}</Text>
          {live.description ? <Text style={styles.desc}>{live.description}</Text> : null}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.offlineBox}>
            {live.thumbnail ? <Image source={live.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={8} /> : null}
            <View style={styles.offlineOverlay}>
              <Ionicons name="radio-outline" size={44} color={colors.textMuted} />
              <Text style={styles.offlineText} accessibilityRole="header">LIVE STREAM IS CURRENTLY OFFLINE.</Text>
            </View>
          </View>
          {error ? <Text style={styles.note}>{MESSAGES.network}</Text> : <EmptyState icon="notifications-outline" title="We’ll let you know" message="Turn on Live notifications in your profile to be alerted when we go live." />}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  title: { ...t.h2, color: colors.text },
  desc: { ...t.body, color: colors.textMuted },
  offlineBox: { aspectRatio: 16 / 9, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.card },
  offlineOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.overlay, padding: 16 },
  offlineText: { ...t.caps, fontSize: 13, color: colors.text, textAlign: 'center' },
  note: { ...t.body, color: colors.textMuted, textAlign: 'center' },
});
