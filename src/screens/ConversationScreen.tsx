import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import type { RootStackParamList } from '@/navigation/types';
import { openSupportAction } from '@/support/actions';
import { MAX_REPLY, markRead, sendReply, subscribeMessages, subscribeThread, type SupportMessage, type SupportThread } from '@/support/service';

const stamp = (ms: number) => new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** One conversation with the support team: messages, action buttons, read receipts and replies. */
export function ConversationScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Conversation'>>();
  const { user } = useAuth();
  const [thread, setThread] = useState<SupportThread | null | undefined>(undefined);
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const list = useRef<FlatList<SupportMessage>>(null);

  useEffect(() => subscribeThread(params.threadId, setThread, () => setThread(null)), [params.threadId]);
  useEffect(() => subscribeMessages(params.threadId, setMessages, () => setError('We couldn’t load this conversation.')), [params.threadId]);
  useEffect(() => {
    if (thread && messages) void markRead(thread, messages);
  }, [thread, messages]);

  const send = async () => {
    if (!user || !reply.trim()) return;
    setSending(true);
    setError('');
    try {
      await sendReply(params.threadId, user.uid, reply);
      setReply('');
    } catch {
      setError('Your reply was not sent. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  if (thread === null) {
    return (
      <Screen>
        <TopBar title="Message" onBack={() => nav.goBack()} />
        <EmptyState icon="chatbubbles-outline" title="Conversation not found" message="It may have been removed, or it belongs to another account." />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title={thread?.subject ?? 'Message'} onBack={() => nav.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        {thread?.related?.label ? <Text style={styles.about}>About: {thread.related.label}</Text> : null}
        {messages === null ? (
          <LoadingSpinner />
        ) : (
          <FlatList
            ref={list}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = item.senderType === 'user';
              return (
                <View style={[styles.msgRow, mine ? styles.mineRow : styles.theirsRow]}>
                  {!mine ? <Text style={styles.sender}>Testimonies of Praise Support Team</Text> : null}
                  <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    <Text style={styles.body} selectable>{item.body}</Text>
                    {item.action ? (
                      <Pressable onPress={() => openSupportAction(item.action!)} style={styles.action} accessibilityRole="button" accessibilityLabel={item.action.label}>
                        <Text style={styles.actionText}>{item.action.label}</Text>
                        <Ionicons name={item.action.url ? 'open-outline' : 'chevron-forward'} size={16} color={colors.onAccent} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={styles.meta}>{stamp(item.createdAt)}{mine && item.readAt ? ' · Seen' : ''}</Text>
                </View>
              );
            }}
          />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {thread?.status === 'resolved' ? <Text style={styles.resolved}>This conversation is resolved. You can still reply if you need more help.</Text> : null}
        <View style={styles.composer}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder="Write a reply…"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            multiline
            maxLength={MAX_REPLY}
            accessibilityLabel="Reply"
          />
          <Pressable onPress={() => void send()} disabled={sending || !reply.trim()} style={[styles.send, (sending || !reply.trim()) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Send reply">
            {sending ? <ActivityIndicator color={colors.onAccent} /> : <Ionicons name="send" size={18} color={colors.onAccent} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  about: { ...t.caption, color: colors.textSubtle, paddingHorizontal: 16, paddingTop: 8 },
  msgRow: { maxWidth: '86%' },
  mineRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirsRow: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  sender: { ...t.label, color: colors.textSubtle, marginBottom: 4 },
  bubble: { padding: 12, borderRadius: radius.lg, borderWidth: 1 },
  theirs: { backgroundColor: colors.primary, borderColor: colors.primaryLight, borderBottomLeftRadius: 6 },
  mine: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSoft, borderBottomRightRadius: 6 },
  body: { ...t.body, color: colors.text },
  action: { marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.accent },
  actionText: { ...t.small, fontWeight: '800', color: colors.onAccent },
  meta: { ...t.caption, color: colors.textSubtle, marginTop: 4 },
  error: { ...t.small, color: colors.danger, paddingHorizontal: 16, paddingBottom: 6 },
  resolved: { ...t.caption, color: colors.success, paddingHorizontal: 16, paddingBottom: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft, backgroundColor: colors.surface },
  input: { flex: 1, ...t.body, color: colors.text, minHeight: 44, maxHeight: 140, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
