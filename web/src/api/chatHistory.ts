import type { AssistantReply } from './assistant';

/**
 * Assistant chats are kept in this browser only, one list per signed-in account (keyed by uid), so
 * conversations never mix between accounts. Nothing here is sent to the server. Cross-device sync is not
 * built yet. Mirrors src/ai/chatHistory.ts in the app.
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
const key = (uid: string) => `top:assistant-chats:v1:${uid}`;

export function loadConversations(uid: string): Conversation[] {
  try {
    const raw = window.localStorage.getItem(key(uid));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Conversation[]).sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export function saveConversations(uid: string, list: Conversation[]): void {
  try {
    window.localStorage.setItem(key(uid), JSON.stringify(list));
  } catch {
    // Storage can be full or blocked; the chat still works for this visit.
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
