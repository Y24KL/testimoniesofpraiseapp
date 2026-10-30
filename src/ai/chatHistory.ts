import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';
import type { AssistantReply } from '@/ai/assistant';

/**
 * Assistant chats are kept on this device only, one list per signed-in account (keyed by uid), so
 * conversations never mix between accounts. Nothing here is sent to the server. Cross-device sync is
 * not built yet; this module is the single place to change if it is added later.
 */

export interface StoredTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  at: number;
  testimonies?: AssistantReply['testimonies'];
  clips?: AssistantReply['clips'];
  sources?: AssistantReply['sources'];
  navigate?: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  turns: StoredTurn[];
}

const DAY = 24 * 60 * 60 * 1000;
const key = (uid: string) => `${STORAGE_KEYS.assistantChatsPrefix}${uid}`;

export async function loadConversations(uid: string): Promise<Conversation[]> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Conversation[]).sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export async function saveConversations(uid: string, list: Conversation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key(uid), JSON.stringify(list));
  } catch {
    // Storage can be full or unavailable; the chat still works for this session.
  }
}

export function titleFrom(question: string): string {
  const clean = question.replace(/\s+/g, ' ').trim();
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
}

export function previewOf(conversation: Conversation): string {
  const last = conversation.turns[conversation.turns.length - 1];
  return last ? last.content.replace(/\s+/g, ' ').slice(0, 90) : '';
}

export interface ConversationGroup {
  label: 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older';
  items: Conversation[];
}

/** Groups conversations (newest first) into Today, Yesterday, Previous 7 days and Older. */
export function groupByDate(list: Conversation[], now = Date.now()): ConversationGroup[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const startToday = today.getTime();
  const groups: ConversationGroup[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ];
  for (const conversation of list) {
    if (conversation.updatedAt >= startToday) groups[0].items.push(conversation);
    else if (conversation.updatedAt >= startToday - DAY) groups[1].items.push(conversation);
    else if (conversation.updatedAt >= startToday - 7 * DAY) groups[2].items.push(conversation);
    else groups[3].items.push(conversation);
  }
  return groups.filter((group) => group.items.length > 0);
}
