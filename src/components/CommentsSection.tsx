import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { commentsAvailable, countComments, deleteMyComment, getMyComment, saveComment, subscribeComments } from '@/api/comments';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius, type as t } from '@/constants/theme';
import type { CommentMediaType, TestimonyComment } from '@/types';
import { MAX_COMMENT_LENGTH, commentTextError, normalizeCommentText } from '@/utils/commentText';
import { formatRelative, initials } from '@/utils/format';
import { PrimaryButton } from './PrimaryButton';

const PAGE = 20;

interface Props {
  type: CommentMediaType;
  mediaId: string;
  mediaTitle: string;
}

/**
 * Comments for ONE video or audio testimony. Real-time list of visible comments (newest first),
 * the signed-in user's own comment (one per account per item: posting again edits it), and a
 * composer with validation, character count and duplicate-submit protection.
 */
export function CommentsSection({ type, mediaId, mediaTitle }: Props) {
  const nav = useNavigation();
  const { user } = useAuth();
  const [items, setItems] = useState<TestimonyComment[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [max, setMax] = useState(PAGE);
  const [count, setCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mine, setMine] = useState<TestimonyComment | null>(null);
  const [mineLoaded, setMineLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const submitting = useRef(false);

  const refreshCount = useCallback(() => {
    countComments(type, mediaId).then(setCount).catch(() => undefined);
  }, [type, mediaId]);

  const refreshMine = useCallback(async () => {
    if (!user) return;
    try {
      setMine(await getMyComment(type, mediaId, user.uid));
    } catch {
      /* the list still works; the composer falls back to "new comment" */
    } finally {
      setMineLoaded(true);
    }
  }, [type, mediaId, user]);

  // Real-time list: moderation (hide/delete) disappears from every phone without a refresh.
  useEffect(() => {
    setLoadError(null);
    return subscribeComments(
      type,
      mediaId,
      max,
      (list, more) => {
        setItems(list);
        setHasMore(more);
        setLoadError(null);
      },
      (e) => {
        setLoadError(e.message);
        setItems((cur) => cur ?? []);
      },
    );
  }, [type, mediaId, max]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount, items?.length]);

  useEffect(() => {
    setMine(null);
    setMineLoaded(!user);
    void refreshMine();
  }, [refreshMine, user]);

  const startEdit = () => {
    setText(mine?.text ?? '');
    setEditing(true);
    setFormError(null);
    setNotice(null);
  };

  const submit = async () => {
    if (!user || submitting.current) return;
    const problem = commentTextError(text);
    if (problem) return setFormError(problem);
    submitting.current = true;
    setBusy(true);
    setFormError(null);
    try {
      await saveComment({ type, mediaId, mediaTitle, uid: user.uid, displayName: user.displayName, text, existing: Boolean(mine) });
      setNotice(mine ? 'Your comment was updated.' : 'Thank you! Your comment is posted.');
      setText('');
      setEditing(false);
      await refreshMine();
      refreshCount();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete your comment?', 'This removes it for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          try {
            await deleteMyComment(type, mediaId, user.uid);
            setMine(null);
            setNotice('Your comment was deleted.');
            refreshCount();
          } catch (e) {
            setFormError((e as Error).message);
          }
        },
      },
    ]);

  const others = (items ?? []).filter((c) => c.uid !== user?.uid);
  const left = MAX_COMMENT_LENGTH - normalizeCommentText(text).length;
  const showComposer = Boolean(user) && mineLoaded && (!mine || editing);

  return (
    <View style={styles.wrap} accessibilityLabel="Comments">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Comments
        </Text>
        <View style={styles.count} accessibilityLabel={`${count ?? 0} comments`}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.accent} />
          <Text style={styles.countText}>{count === null ? '…' : count}</Text>
        </View>
      </View>

      {!commentsAvailable ? (
        <Text style={styles.muted}>Comments are not available in this build.</Text>
      ) : !user ? (
        <View style={styles.signIn}>
          <Text style={styles.muted}>Sign in to join the conversation.</Text>
          <PrimaryButton title="Sign in" compact variant="outline" onPress={() => nav.navigate('EmailAuth' as never)} />
        </View>
      ) : (
        <>
          {mine && !editing ? (
            <View style={[styles.comment, styles.mine]}>
              <View style={styles.commentTop}>
                <Text style={styles.name}>Your comment</Text>
                <Text style={styles.time}>{formatRelative(mine.updatedAt ?? mine.createdAt)}</Text>
              </View>
              <Text style={styles.text}>{mine.text}</Text>
              {mine.status === 'hidden' ? <Text style={styles.hiddenNote}>Hidden by a moderator: only you can see it.</Text> : null}
              <View style={styles.mineActions}>
                <Pressable onPress={startEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit your comment">
                  <Text style={styles.action}>Edit</Text>
                </Pressable>
                <Pressable onPress={remove} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete your comment">
                  <Text style={[styles.action, { color: colors.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {showComposer ? (
            <View style={styles.composer}>
              <TextInput
                value={text}
                onChangeText={(v) => {
                  setText(v);
                  if (formError) setFormError(null);
                }}
                placeholder={mine ? 'Edit your comment' : 'Share how this testimony blessed you…'}
                placeholderTextColor={colors.textSubtle}
                multiline
                maxLength={MAX_COMMENT_LENGTH + 50}
                style={styles.input}
                editable={!busy}
                accessibilityLabel="Comment text"
              />
              <View style={styles.composerRow}>
                <Text style={[styles.counter, left < 0 && { color: colors.danger }]}>{left} left</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {editing ? <PrimaryButton title="Cancel" compact variant="ghost" onPress={() => setEditing(false)} disabled={busy} /> : null}
                  <PrimaryButton title={mine ? 'Update' : 'Post'} compact onPress={submit} loading={busy} disabled={busy || !normalizeCommentText(text)} />
                </View>
              </View>
              <Text style={styles.hint}>One comment per person on each testimony. You can edit it later.</Text>
            </View>
          ) : null}
          {formError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}
          {notice && !formError ? <Text style={styles.notice}>{notice}</Text> : null}
        </>
      )}

      {items === null ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
      ) : loadError ? (
        <Text style={styles.error}>{loadError}</Text>
      ) : others.length === 0 ? (
        <Text style={styles.muted}>{mine ? 'No other comments yet.' : 'No comments yet. Be the first to share.'}</Text>
      ) : (
        others.map((c) => (
          <View key={c.id} style={styles.comment}>
            <View style={styles.commentTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(c.displayName)}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {c.displayName}
              </Text>
              <Text style={styles.time}>{formatRelative(c.createdAt)}</Text>
            </View>
            <Text style={styles.text}>{c.text}</Text>
          </View>
        ))
      )}
      {hasMore ? <PrimaryButton title="Show more comments" compact variant="ghost" onPress={() => setMax((m) => m + PAGE)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...t.h2, color: colors.text },
  count: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  countText: { ...t.small, color: colors.accent, fontWeight: '800' },
  signIn: { gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  composer: { gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  input: { minHeight: 80, maxHeight: 200, color: colors.text, fontSize: 15, textAlignVertical: 'top', padding: 0 },
  composerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { ...t.caption, color: colors.textSubtle },
  hint: { ...t.caption, color: colors.textSubtle },
  comment: { gap: 6, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  mine: { borderColor: 'rgba(245,197,66,0.4)', backgroundColor: 'rgba(245,197,66,0.06)' },
  commentTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 11, fontWeight: '800', color: colors.accent },
  name: { ...t.small, flex: 1, color: colors.text, fontWeight: '700' },
  time: { ...t.caption, color: colors.textSubtle },
  text: { ...t.body, color: colors.textMuted },
  hiddenNote: { ...t.caption, color: colors.danger },
  mineActions: { flexDirection: 'row', gap: 18, marginTop: 2 },
  action: { ...t.small, color: colors.accent, fontWeight: '700' },
  muted: { ...t.small, color: colors.textSubtle },
  error: { ...t.small, color: colors.danger },
  notice: { ...t.small, color: colors.success },
});
