import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ASSISTANT_TARGETS, AssistantError, askAssistant, type AssistantMessage, type AssistantReply } from '@/ai/assistant';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import { isWebUrl } from '@/utils/openExternal';

interface Turn extends AssistantMessage {
  id: string;
  testimonies?: AssistantReply['testimonies'];
  sources?: AssistantReply['sources'];
  navigate?: string | null;
}

const MAX_CHARS = 1000;
const WELCOME = 'Hi, I’m the T.O.P AI Assistant. Ask me how to use the app, find a testimony by what it is about, or ask a general question.';

export function AssistantScreen() {
  const nav = useNavigation<any>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQuestion = useRef<string | null>(null);

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    if (question.length > MAX_CHARS) return setError(`Keep your question under ${MAX_CHARS} characters.`);
    setError(null);
    lastQuestion.current = question;
    const next: Turn[] = [...turns, { id: `u${Date.now()}`, role: 'user', content: question }];
    setTurns(next);
    setInput('');
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const history = next.map(({ role, content }) => ({ role, content }));
      const answer = await askAssistant(history, controller.signal);
      setTurns((cur) => [
        ...cur,
        { id: `a${Date.now()}`, role: 'assistant', content: answer.reply || 'I could not find an answer to that.', testimonies: answer.testimonies, sources: answer.sources, navigate: answer.navigate },
      ]);
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setError('Stopped. You can ask again.');
      } else {
        setError(e instanceof AssistantError ? e.message : 'Something went wrong. Please try again.');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const stop = () => abortRef.current?.abort();
  const clear = () => {
    Alert.alert('Clear this chat?', 'The conversation will be removed from this screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { setTurns([]); setError(null); } },
    ]);
  };

  const openScreen = (key: string) => {
    const target = ASSISTANT_TARGETS[key];
    if (!target) return;
    if (target.route === 'Tabs') nav.navigate('Tabs', { screen: target.screen });
    else nav.navigate(target.screen);
  };

  const data: Turn[] = turns.length ? turns : [{ id: 'welcome', role: 'assistant', content: WELCOME }];

  return (
    <Screen>
      <TopBar
        title="T.O.P AI Assistant"
        onBack={() => nav.goBack()}
        right={
          turns.length > 0 ? (
            <Pressable onPress={clear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear chat">
              <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
            </Pressable>
          ) : undefined
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.me : styles.bot]}>
              <Text style={[styles.text, item.role === 'user' && { color: colors.onAccent }]}>{item.content}</Text>

              {item.testimonies && item.testimonies.length > 0 ? (
                <View style={{ gap: 6, marginTop: 8 }}>
                  <Text style={styles.label}>From the app</Text>
                  {item.testimonies.map((tm) => (
                    <Pressable key={tm.id} onPress={() => nav.navigate('TestimonyDetails', { id: tm.id })} style={styles.card} accessibilityRole="link">
                      <Text style={styles.cardTitle} numberOfLines={2}>{tm.title}</Text>
                      {tm.description ? <Text style={styles.cardText} numberOfLines={2}>{tm.description}</Text> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {item.sources && item.sources.length > 0 ? (
                <View style={{ gap: 6, marginTop: 8 }}>
                  <Text style={styles.label}>From the web (not from the app)</Text>
                  {item.sources.filter((s) => isWebUrl(s.url)).map((s) => (
                    <Pressable key={s.url} onPress={() => void Linking.openURL(s.url)} style={styles.card} accessibilityRole="link">
                      <Text style={styles.cardTitle} numberOfLines={2}>{s.title}</Text>
                      <Text style={styles.linkText} numberOfLines={1}>{s.url}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {item.navigate ? (
                <Pressable onPress={() => openScreen(item.navigate!)} style={styles.open} accessibilityRole="button">
                  <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.accent} />
                  <Text style={styles.openText}>Open this screen</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          ListFooterComponent={
            busy ? (
              <View style={styles.typing} accessibilityLabel="The assistant is answering">
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.label}>Thinking…</Text>
                <Pressable onPress={stop} hitSlop={8} accessibilityRole="button" accessibilityLabel="Stop answering">
                  <Text style={styles.stop}>Stop</Text>
                </Pressable>
              </View>
            ) : null
          }
        />

        {error ? (
          <View style={styles.errorRow} accessibilityRole="alert">
            <Text style={styles.error}>{error}</Text>
            {lastQuestion.current && !busy ? (
              <Pressable onPress={() => void send(lastQuestion.current!)} accessibilityRole="button">
                <Text style={styles.retry}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question…"
            placeholderTextColor={colors.textSubtle}
            multiline
            maxLength={MAX_CHARS}
            style={styles.input}
            editable={!busy}
            accessibilityLabel="Message the assistant"
          />
          <Pressable
            onPress={() => void send()}
            disabled={busy || !input.trim()}
            style={[styles.send, (busy || !input.trim()) && { opacity: 0.4 }]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Ionicons name="send" size={18} color={colors.onAccent} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  bubble: { maxWidth: '88%', padding: 12, borderRadius: radius.md, gap: 4 },
  me: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  bot: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  text: { ...t.body, color: colors.text },
  label: { ...t.caption, color: colors.textSubtle, fontWeight: '700' },
  card: { padding: 10, borderRadius: radius.sm, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, gap: 2 },
  cardTitle: { ...t.small, color: colors.text, fontWeight: '700' },
  cardText: { ...t.caption, color: colors.textMuted },
  linkText: { ...t.caption, color: colors.accent },
  open: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  openText: { ...t.small, color: colors.accent, fontWeight: '700' },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 },
  stop: { ...t.small, color: colors.danger, fontWeight: '700' },
  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  error: { ...t.small, color: colors.danger, flex: 1 },
  retry: { ...t.small, color: colors.accent, fontWeight: '800' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  input: { flex: 1, maxHeight: 120, minHeight: 44, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
