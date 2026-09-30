import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  addDoc,
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/api/firebase';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius, type as t } from '@/constants/theme';
import { initials } from '@/utils/format';

interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text: string;
  createdAt: Timestamp | null;
}

const MAX_LEN = 300;
const SEND_COOLDOWN_MS = 2000; // a light client-side brake on spam; real limits live in the Firestore rules

export function LiveChat({ sessionId }: { sessionId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    setMessages([]);
    setError('');
    const col = collection(db, 'liveChat', sessionId, 'messages');
    return onSnapshot(
      query(col, orderBy('createdAt', 'asc'), limitToLast(200)),
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) })));
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      },
      (e) => {
        console.log('CHAT LOAD ERROR', e);
        setError(__DEV__ ? `Chat couldn’t load: ${e.code}` : 'Chat couldn’t load.');
      },
    );
  }, [sessionId]);

  const send = async () => {
    const value = text.trim();
    if (!value || !user || sending) return;
    setSending(true);
    setText('');
    try {
      await addDoc(collection(db, 'liveChat', sessionId, 'messages'), {
        uid: user.uid,
        name: user.displayName?.trim() || (user.email ? user.email.split('@')[0] : 'Friend'),
        text: value.slice(0, MAX_LEN),
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.log('CHAT SEND ERROR', e);
      const code = (e as { code?: string })?.code;
      setError(
        __DEV__
          ? `Your message didn’t send: ${code ?? (e as Error)?.message ?? 'unknown error'}`
          : 'Your message didn’t send. Please try again.',
      );
    }
    setTimeout(() => setSending(false), SEND_COOLDOWN_MS);
  };

  const report = (m: ChatMessage) => {
    if (m.uid === user?.uid) return; // no point reporting your own message
    Alert.alert('Report this message?', `"${m.text}"`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () =>
          void addDoc(collection(db, 'liveChatReports'), {
            sessionId,
            messageId: m.id,
            text: m.text,
            authorUid: m.uid,
            reporterUid: user?.uid,
            createdAt: serverTimestamp(),
          }).catch(() => undefined),
      },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
      <Text style={styles.header}>LIVE CHAT</Text>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.list}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <Pressable onLongPress={() => report(item)} style={styles.row} accessibilityLabel={`${item.name}: ${item.text}`}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(item.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.msg}>{item.text}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Say something! Long-press a message to report it.</Text>}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Say something…"
          placeholderTextColor={colors.textMuted + '99'}
          style={styles.input}
          maxLength={MAX_LEN}
          multiline
          accessibilityLabel="Chat message"
        />
        <Pressable
          onPress={() => void send()}
          disabled={!text.trim() || sending}
          style={[styles.send, (!text.trim() || sending) && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          <Ionicons name="send" size={18} color={colors.text} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 380, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  header: { ...t.caps, fontSize: 11, color: colors.accent, padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  list: { flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...t.small, fontSize: 10, color: colors.accent, fontWeight: '700' },
  name: { ...t.small, fontSize: 12, color: colors.accent, fontWeight: '700' },
  msg: { ...t.body, fontSize: 14, color: colors.text },
  empty: { ...t.small, color: colors.textMuted, textAlign: 'center', padding: 20 },
  error: { ...t.small, color: colors.danger, textAlign: 'center', paddingBottom: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 90, color: colors.text, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
