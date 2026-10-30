import { auth } from './firebase';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantTestimony {
  id: string;
  title: string;
  description: string;
}

export interface AssistantClip {
  testimonyId: string;
  title: string;
  startSec: number;
  startLabel: string;
  description: string;
}

export interface AssistantSource {
  title: string;
  url: string;
  snippet: string;
}

export interface AssistantReply {
  reply: string;
  testimonies: AssistantTestimony[];
  /** Moments inside testimony videos, each with the second to start from. */
  clips: AssistantClip[];
  /** External web sources. Shown separately and labelled, never mixed with app content. */
  sources: AssistantSource[];
  /** A screen the assistant suggested; the site only opens names from its own list. */
  navigate: string | null;
}

/** The screens the assistant may open on the website. Anything else is ignored. */
export const ASSISTANT_ROUTES = ['live', 'radio', 'adotopoc', 'written', 'testimonies', 'sponsor', 'downloads'] as const;

const BASE = ((import.meta.env.VITE_AI_API_URL as string | undefined) ?? '').replace(/\/+$/, '');

export class AssistantError extends Error {}

/** Sends the chat so far and returns the next answer. Pass an AbortSignal to support "Stop". */
export async function askAssistant(messages: AssistantMessage[], signal?: AbortSignal): Promise<AssistantReply> {
  const user = auth.currentUser;
  if (!user) throw new AssistantError('Sign in to use the T.O.P AI Assistant.');
  if (!BASE) throw new AssistantError('The assistant is not configured on this site yet.');
  const token = await user.getIdToken();

  let response: Response;
  try {
    response = await fetch(`${BASE}/api/ai/assistant`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new AssistantError('No connection. Check your internet and try again.');
  }

  const data = (await response.json().catch(() => null)) as (Partial<AssistantReply> & { error?: string }) | null;
  if (!response.ok || !data) {
    throw new AssistantError(data?.error || 'The assistant is not available right now. Please try again.');
  }
  return {
    reply: String(data.reply ?? ''),
    testimonies: Array.isArray(data.testimonies) ? data.testimonies : [],
    clips: Array.isArray((data as { clips?: unknown }).clips) ? ((data as { clips: AssistantClip[] }).clips) : [],
    sources: Array.isArray(data.sources) ? data.sources : [],
    navigate: typeof data.navigate === 'string' && (ASSISTANT_ROUTES as readonly string[]).includes(data.navigate) ? data.navigate : null,
  };
}
