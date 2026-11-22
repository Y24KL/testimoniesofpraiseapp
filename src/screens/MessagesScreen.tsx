import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import type { RootStackParamList } from '@/navigation/types';
import { CATEGORY_LABELS, subscribeThreads, type SupportThread } from '@/support/service';

const when = (ms: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString();
};

/** Private messages from the Testimonies of Praise support team. Separate from the public notification list. */
export function MessagesScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [threads, setThreads] = useState<SupportThread[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    setError('');
    return subscribeThreads(user.uid, setThreads, () => setError('We couldn’t load your messages. Check your connection.'));
  }, [user, attempt]);

  return (
    <Screen>
      <TopBar title="Messages" onBack={() => nav.goBack()} />
      {error ? (
        <ErrorState message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : threads === null ? (
        <LoadingSpinner />
      ) : threads.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="No messages yet" message="When the Testimonies of Praise team writes to you about a request, a submission or your account, it appears here." />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const unread = item.unreadForUser > 0;
            return (
              <Pressable
                onPress={() => nav.navigate('Conversation', { threadId: item.id })}
                style={[styles.row, unread && styles.rowUnread]}
                accessibilityRole="button"
                accessibilityLabel={`${unread ? 'Unread. ' : ''}${item.subject}. From Testimonies of Praise Support Team. ${item.lastMessagePreview}`}
              >
                <View style={styles.avatar}><Ionicons name="chatbubble-ellipses" size={20} color={colors.accent} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.top}>
                    <Text style={[styles.subject, unread && { color: colors.accent }]} numberOfLines={1}>{item.subject}</Text>
                    <Text style={styles.when}>{when(item.lastMessageAt)}</Text>
                  </View>
                  <Text style={styles.from} numberOfLines={1}>
                    Testimonies of Praise Support Team{item.related?.label ? ` · ${item.related.label}` : CATEGORY_LABELS[item.category] ? ` · ${CATEGORY_LABELS[item.category]}` : ''}
                  </Text>
                  <Text style={styles.preview} numberOfLines={2}>{item.lastSender === 'user' ? 'You: ' : ''}{item.lastMessagePreview}</Text>
                  {item.status === 'resolved' ? <Text style={styles.resolved}>Resolved</Text> : null}
                </View>
                {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{item.unreadForUser > 9 ? '9+' : item.unreadForUser}</Text></View> : null}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'flex-start' },
  rowUnread: { borderColor: 'rgba(245,197,66,0.5)', backgroundColor: 'rgba(245,197,66,0.06)' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  subject: { ...t.h3, color: colors.text, flexShrink: 1 },
  when: { ...t.caption, color: colors.textSubtle },
  from: { ...t.caption, color: colors.textSubtle, marginTop: 2 },
  preview: { ...t.small, color: colors.textMuted, marginTop: 4 },
  resolved: { ...t.label, color: colors.success, marginTop: 6 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  badgeText: { ...t.label, color: colors.onAccent },
});
