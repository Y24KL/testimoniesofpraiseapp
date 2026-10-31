import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { AssistantReply } from './assistant';

/**
 * Assistant chats are saved to the signed-in account, so they follow the user to other devices. Each chat is
 * one document at users/{uid}/assistantChats/{chatId}; the security rules only let the owner read or change it.
 * A copy is kept in this browser so the list still opens when offline. Mirrors src/ai/chatHistory.ts in the app.
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
/** Firestore documents are limited to 1 MB; the rules allow 200,000 characters of turns. */
const MAX_TURNS_CHARS = 180_000;
const cacheKey = (uid: string) => `top:assistant-chats:v1:${uid}`;
const chatsRef = (uid: string) => collection(db, 'users', uid, 'assistantChats');

/** Keeps the newest turns so a very long chat still fits in one document. */
function fitTurns(turns: StoredTurn[]): StoredTurn[] {
  let kept = turns;
  while (kept.length > 2 && JSON.stringify(kept).length > MAX_TURNS_CHARS) kept = kept.slice(2);
  return kept;
}

function cacheConversations(uid: string, list: Conversation[]): void {
  try {
    window.localStorage.setItem(cacheKey(uid), JSON.stringify(list));
  } catch {
    // Storage can be full or blocked; the account copy still holds the chats.
  }
}

function readCache(uid: string): Conversation[] {
  try {
    const raw = window.localStorage.getItem(cacheKey(uid));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Conversation[]) : [];
  } catch {
    return [];
  }
}

/** The account's chats, newest first. Falls back to this browser's copy when offline. */
export async function loadConversations(uid: string): Promise<Conversation[]> {
  try {
    const snap = await getDocs(chatsRef(uid));
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        let turns: StoredTurn[] = [];
        try {
          turns = JSON.parse(String(data.turnsJson ?? '[]')) as StoredTurn[];
        } catch {
          turns = [];
        }
        return { id: d.id, title: String(data.title ?? ''), updatedAt: Number(data.updatedAt ?? 0), turns };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
    if (list.length === 0) {
      // Chats saved on this device before accounts stored them move to the account once.
      const local = await readCache(uid);
      for (const c of local) void saveConversation(uid, c).catch(() => undefined);
      if (local.length) return local.sort((x, y) => y.updatedAt - x.updatedAt);
    }
    cacheConversations(uid, list);
    return list;
  } catch {
    return readCache(uid).sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

async function saveConversation(uid: string, c: Conversation): Promise<void> {
  await setDoc(doc(chatsRef(uid), c.id), {
    title: c.title.slice(0, 80),
    turnsJson: JSON.stringify(fitTurns(c.turns)),
    updatedAt: c.updatedAt,
  });
}

async function deleteConversation(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(chatsRef(uid), id));
}

/**
 * Brings the account in line with the list on screen: saves changed chats, removes deleted ones, and keeps
 * this browser's copy current. Network errors are ignored; the next change to that chat saves it again.
 */
export function syncConversations(uid: string, prev: Conversation[], next: Conversation[]): void {
  cacheConversations(uid, next);
  const before = new Map(prev.map((c) => [c.id, c]));
  for (const c of next) {
    const old = before.get(c.id);
    if (!old || old.updatedAt !== c.updatedAt || old.title !== c.title) {
      void saveConversation(uid, c).catch(() => undefined);
    }
  }
  const kept = new Set(next.map((c) => c.id));
  for (const c of prev) {
    if (!kept.has(c.id)) void deleteConversation(uid, c.id).catch(() => undefined);
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
