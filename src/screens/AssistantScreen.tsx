import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { ASSISTANT_TARGETS, AssistantError, askAssistant, type AssistantMessage } from '@/ai/assistant';
import { groupByDate, loadConversations, previewOf, saveConversations, titleFrom, type Conversation, type StoredTurn } from '@/ai/chatHistory';
import { useAuth } from '@/auth/AuthContext';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { colors, radius, type as t } from '@/constants/theme';
import { isWebUrl } from '@/utils/openExternal';

const MAX_CHARS = 1000;
/** The Worker accepts at most 12 messages per request, so only the latest ones are sent. */
const MAX_HISTORY_MESSAGES = 12;
const WELCOME_HINT = 'Discover testimonies, explore resources, get answers and find your way around Testimonies of Praise.';

type Suggestion = { label: string; icon: string; prompt: string | null };
const SUGGESTIONS: Suggestion[] = [
  { label: 'Find a testimony', icon: 'search-outline', prompt: 'Help me find a testimony.' },
  { label: 'Explore resources', icon: 'library-outline', prompt: 'What resources can I explore in the app?' },
  { label: 'Help with my account', icon: 'person-circle-outline', prompt: null },
  { label: 'Where can I watch live?', icon: 'videocam-outline', prompt: 'Where can I watch live?' },
  { label: 'Ask me anything', icon: 'chatbubble-ellipses-outline', prompt: '' },
];

type AccountItem =
  | { label: string; icon: string; prompt: string }
  | { label: string; icon: string; screen: string; params?: Record<string, unknown> };
const ACCOUNT_HELP: AccountItem[] = [
  { label: 'I forgot my password', icon: 'key-outline', screen: 'ForgotPassword' },
  { label: 'I cannot sign in', icon: 'log-in-outline', screen: 'EmailAuth', params: { mode: 'signin' } },
  { label: 'Google sign-in is not working', icon: 'logo-google', prompt: 'Google sign-in is not working for me. What should I try?' },
  { label: "I haven't received my verification code", icon: 'mail-unread-outline', screen: 'VerifyEmail' },
  { label: 'I need help accessing my account', icon: 'help-circle-outline', prompt: 'I need help accessing my account. What can I do?' },
];

const FOLLOW_UPS: { label: string; prompt: string }[] = [
  { label: 'Explain further', prompt: 'Please explain that in more detail.' },
  { label: 'Find related testimonies', prompt: 'Find testimonies related to that.' },
  { label: 'I need more help', prompt: 'I need more help with this.' },
];

/** Opens on KingsChat if the app is installed, otherwise in the browser. */
const SUPPORT_URL = 'https://kingschat.online/user/topappsupport';

const timeLabel = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function withConversation(list: Conversation[], id: string, title: string, turns: StoredTurn[], now: number): Conversation[] {
  const existing = list.find((c) => c.id === id);
  const updated: Conversation = { id, title: existing?.title ?? title, updatedAt: now, turns };
  return [updated, ...list.filter((c) => c.id !== id)].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function AssistantScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [keyboardLift, setKeyboardLift] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList<StoredTurn>>(null);
  const inputRef = useRef<TextInput>(null);
  const lastQuestion = useRef<string | null>(null);
  const latest = useRef<Conversation[]>([]);
  const uidRef = useRef<string | null>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const turns = active?.turns ?? [];
  const lastTurn = turns[turns.length - 1];

  // Load this account's chats. Switching account or signing out clears what is on screen first.
  useEffect(() => {
    let cancelled = false;
    uidRef.current = uid;
    abortRef.current?.abort();
    setActiveId(null);
    setError(null);
    setBusy(false);
    if (!uid) {
      latest.current = [];
      setConversations([]);
      return;
    }
    void loadConversations(uid).then((list) => {
      if (cancelled) return;
      latest.current = list;
      setConversations(list);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Keep the newest message in view and the composer above the Android keyboard.
  // iOS uses KeyboardAvoidingView; Android does not resize the window here, so lift by the keyboard height.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      if (Platform.OS === 'android') setKeyboardLift(Math.max(0, e.endCoordinates.height - tabBarHeight));
      listRef.current?.scrollToEnd({ animated: true });
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [tabBarHeight]);

  const commit = (next: Conversation[]) => {
    const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
    latest.current = sorted;
    setConversations(sorted);
    const owner = uidRef.current;
    if (owner) void saveConversations(owner, sorted);
  };

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    if (question.length > MAX_CHARS) return setError(`Keep your question under ${MAX_CHARS} characters.`);
    setError(null);
    lastQuestion.current = question;

    const now = Date.now();
    const id = activeId ?? `c${now}`;
    const base = latest.current.find((c) => c.id === id);
    const sent: StoredTurn[] = [...(base?.turns ?? []), { id: `u${now}`, role: 'user', content: question, at: now }];
    commit(withConversation(latest.current, id, titleFrom(question), sent, now));
    setActiveId(id);
    setInput('');
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const history: AssistantMessage[] = sent.slice(-MAX_HISTORY_MESSAGES).map(({ role, content }) => ({ role, content }));
      const answer = await askAssistant(history, controller.signal);
      const replyAt = Date.now();
      const reply: StoredTurn = {
        id: `a${replyAt}`,
        role: 'assistant',
        content: answer.reply || 'I could not find an answer to that.',
        at: replyAt,
        testimonies: answer.testimonies,
        clips: answer.clips,
        sources: answer.sources,
        navigate: answer.navigate,
      };
      commit(withConversation(latest.current, id, titleFrom(question), [...sent, reply], replyAt));
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

  const newChat = () => {
    setActiveId(null);
    setError(null);
    setHistoryOpen(false);
  };

  const openChat = (c: Conversation) => {
    setActiveId(c.id);
    setError(null);
    setHistoryOpen(false);
  };

  const deleteChat = (c: Conversation) => {
    Alert.alert('Delete this chat?', `“${c.title}” will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          commit(latest.current.filter((x) => x.id !== c.id));
          if (activeId === c.id) setActiveId(null);
        },
      },
    ]);
  };

  const saveRename = () => {
    const title = renameText.trim();
    if (renamingId && title) {
      commit(latest.current.map((c) => (c.id === renamingId ? { ...c, title: title.slice(0, 80) } : c)));
    }
    setRenamingId(null);
  };

  const copy = async (turn: StoredTurn) => {
    await Clipboard.setStringAsync(turn.content);
    setCopiedId(turn.id);
    setTimeout(() => setCopiedId((cur) => (cur === turn.id ? null : cur)), 1500);
  };

  const openScreen = (key: string) => {
    const target = ASSISTANT_TARGETS[key];
    if (!target) return;
    if (target.route === 'Tabs') nav.navigate('Tabs', { screen: target.screen });
    else nav.navigate(target.screen);
  };

  const runSuggestion = (prompt: string | null) => {
    if (prompt === null) return;
    if (prompt === '') inputRef.current?.focus();
    else void send(prompt);
  };

  const openSupport = async () => {
    try {
      await Linking.openURL(SUPPORT_URL);
    } catch {
      Alert.alert('Could not open KingsChat', `Visit ${SUPPORT_URL} in your browser.`);
    }
  };

  const runAccount = (item: AccountItem) => {
    if ('prompt' in item) void send(item.prompt);
    else nav.navigate(item.screen, item.params);
  };

  const filtered = search.trim()
    ? conversations.filter((c) => `${c.title} ${previewOf(c)}`.toLowerCase().includes(search.trim().toLowerCase()))
    : conversations;
  const groups = groupByDate(filtered);

  const welcome = (
    <View style={styles.welcome}>
      <Text style={styles.hello}>Hello! I’m your TOP AI Assistant.</Text>
      <Text style={styles.howCan}>How can I help you today?</Text>
      <Text style={styles.hint}>{WELCOME_HINT}</Text>
      <View style={styles.grid}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s.label}
            onPress={() => (s.label === 'Help with my account' ? setAccountOpen((open) => !open) : runSuggestion(s.prompt))}
            style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={s.label}
          >
            <Ionicons name={s.icon as any} size={20} color={colors.accent} />
            <Text style={styles.suggestionText}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
      {accountOpen ? (
        <View style={styles.account}>
          <Text style={styles.sectionTitle}>How can I help with your account?</Text>
          {ACCOUNT_HELP.map((item) => (
            <Pressable key={item.label} onPress={() => runAccount(item)} style={styles.accountRow} accessibilityRole="button">
              <Ionicons name={item.icon as any} size={18} color={colors.accent} />
              <Text style={styles.accountText}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
            </Pressable>
          ))}
          <Text style={styles.support}>
            Still having trouble? Contact the Testimonies of Praise support team for further assistance.
          </Text>
          <Pressable onPress={() => void openSupport()} style={styles.supportButton} accessibilityRole="link" accessibilityLabel="Contact TOP support on KingsChat">
            <Ionicons name="chatbubbles-outline" size={18} color={colors.onAccent} />
            <Text style={styles.supportButtonText}>Contact @topappsupport on KingsChat</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const renderTurn = ({ item, index }: { item: StoredTurn; index: number }) => {
    const isLast = index === turns.length - 1;
    return (
      <View style={[styles.row, item.role === 'user' && styles.rowMe]}>
        <View style={[styles.bubble, item.role === 'user' ? styles.me : styles.bot]}>
          <Text selectable style={[styles.text, item.role === 'user' && { color: colors.onAccent }]}>{item.content}</Text>

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

          {item.clips && item.clips.length > 0 ? (
            <View style={{ gap: 6, marginTop: 8 }}>
              <Text style={styles.label}>Moments in videos</Text>
              {item.clips.map((c) => (
                <Pressable
                  key={`${c.testimonyId}-${c.startSec}`}
                  onPress={() => nav.navigate('TestimonyDetails', { id: c.testimonyId, startAt: c.startSec })}
                  style={styles.card}
                  accessibilityRole="link"
                  accessibilityLabel={`Watch ${c.title} at ${c.startLabel}`}
                >
                  <Text style={styles.cardTitle} numberOfLines={2}>{c.title}</Text>
                  {c.description ? <Text style={styles.cardText} numberOfLines={2}>{c.description}</Text> : null}
                  <Text style={styles.linkText}>Watch at {c.startLabel}</Text>
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

          {item.role === 'assistant' ? (
            <Pressable onPress={() => void copy(item)} hitSlop={8} style={styles.copy} accessibilityRole="button" accessibilityLabel="Copy response">
              <Ionicons name={copiedId === item.id ? 'checkmark' : 'copy-outline'} size={14} color={colors.textMuted} />
              <Text style={styles.copyText}>{copiedId === item.id ? 'Copied' : 'Copy'}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.time}>{timeLabel(item.at)}</Text>

        {isLast && item.role === 'assistant' && !busy ? (
          <View style={styles.chips}>
            {FOLLOW_UPS.map((f) => (
              <Pressable key={f.label} onPress={() => void send(f.prompt)} style={styles.chip} accessibilityRole="button">
                <Text style={styles.chipText}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen>
      <TopBar
        title="T.O.P AI Assistant"
        onBack={() => nav.goBack()}
        right={
          <View style={styles.headerActions}>
            {active ? (
              <Pressable onPress={() => deleteChat(active)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Delete this chat">
                <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
              </Pressable>
            ) : null}
            <Pressable onPress={newChat} hitSlop={10} accessibilityRole="button" accessibilityLabel="New chat">
              <Ionicons name="create-outline" size={20} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => setHistoryOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Chat history">
              <Ionicons name="time-outline" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        }
      />
      <View style={styles.status}>
        <View style={[styles.dot, busy && { backgroundColor: colors.accent }]} />
        <Text style={styles.statusText}>{busy ? 'Thinking…' : 'Ready'}</Text>
        {uid ? <Text style={styles.storage}>Chats are saved on this device only.</Text> : null}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          keyboardDismissMode="on-drag"
          data={turns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={turns.length === 0 ? welcome : null}
          renderItem={renderTurn}
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

        <View style={[styles.composer, { marginBottom: keyboardLift }]}>
          <TextInput
            ref={inputRef}
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

      <Modal visible={historyOpen} animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
        <Screen>
          <TopBar title="Chat history" onBack={() => setHistoryOpen(false)} />
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={colors.textSubtle} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search chats"
              placeholderTextColor={colors.textSubtle}
              style={styles.searchInput}
              accessibilityLabel="Search saved chats"
            />
          </View>
          <ScrollView contentContainerStyle={styles.historyList}>
            {groups.length === 0 ? (
              <Text style={styles.empty}>{uid ? 'No saved chats yet. Ask a question to start one.' : 'Sign in to save your chats on this device.'}</Text>
            ) : null}
            {groups.map((group) => (
              <View key={group.label} style={{ gap: 8 }}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                {group.items.map((c) =>
                  renamingId === c.id ? (
                    <View key={c.id} style={styles.renameRow}>
                      <TextInput
                        value={renameText}
                        onChangeText={setRenameText}
                        style={styles.renameInput}
                        maxLength={80}
                        autoFocus
                        accessibilityLabel="Chat name"
                        onSubmitEditing={saveRename}
                      />
                      <Pressable onPress={saveRename} accessibilityRole="button">
                        <Text style={styles.retry}>Save</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View key={c.id} style={styles.historyRow}>
                      <Pressable style={{ flex: 1, gap: 2 }} onPress={() => openChat(c)} accessibilityRole="button" accessibilityLabel={`Open ${c.title}`}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                        <Text style={styles.cardText} numberOfLines={1}>{previewOf(c)}</Text>
                        <Text style={styles.time}>{timeLabel(c.updatedAt)}</Text>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => {
                          setRenamingId(c.id);
                          setRenameText(c.title);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Rename ${c.title}`}
                      >
                        <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
                      </Pressable>
                      <Pressable hitSlop={8} onPress={() => deleteChat(c)} accessibilityRole="button" accessibilityLabel={`Delete ${c.title}`}>
                        <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  ),
                )}
              </View>
            ))}
            <Text style={styles.privacy}>
              Chats are kept on this device, for this account only. They are not synced to other devices yet.
            </Text>
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success ?? colors.textSubtle },
  statusText: { ...t.caption, color: colors.textMuted },
  storage: { ...t.caption, color: colors.textSubtle, marginLeft: 'auto' },
  list: { padding: 16, gap: 14, flexGrow: 1 },
  welcome: { gap: 10, paddingVertical: 12 },
  hello: { ...t.h2, color: colors.text },
  howCan: { ...t.body, color: colors.text },
  hint: { ...t.small, color: colors.textMuted, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  suggestionText: { ...t.small, color: colors.text, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  account: { gap: 8, marginTop: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  sectionTitle: { ...t.small, color: colors.text, fontWeight: '700' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  accountText: { ...t.small, color: colors.text, flex: 1 },
  support: { ...t.caption, color: colors.textMuted, marginTop: 4 },
  supportButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginTop: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.accent },
  supportButtonText: { ...t.small, color: colors.onAccent, fontWeight: '700' },
  row: { gap: 4, maxWidth: '100%' },
  rowMe: { alignItems: 'flex-end' },
  bubble: { maxWidth: '88%', padding: 12, borderRadius: radius.md, gap: 4 },
  me: { backgroundColor: colors.accent },
  bot: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  time: { ...t.caption, color: colors.textSubtle, paddingHorizontal: 4 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4 },
  copyText: { ...t.caption, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.accent },
  chipText: { ...t.caption, color: colors.accent, fontWeight: '700' },
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 10, fontSize: 15 },
  historyList: { padding: 16, paddingTop: 0, gap: 16 },
  groupLabel: { ...t.caption, color: colors.textSubtle, fontWeight: '700', textTransform: 'uppercase' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent },
  renameInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 6 },
  empty: { ...t.small, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  privacy: { ...t.caption, color: colors.textSubtle, textAlign: 'center', marginTop: 8 },
});
