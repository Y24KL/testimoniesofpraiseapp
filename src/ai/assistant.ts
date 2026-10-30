import { auth } from '@/api/firebase';
import { CONFIG } from '@/constants/config';

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
  /** A screen the assistant suggested; the app only opens names from its own list. */
  navigate: string | null;
}

/** The screens the assistant may open, mapped to real app routes. Anything else is ignored. */
export const ASSISTANT_TARGETS: Record<string, { route: 'Tabs' | 'Stack'; screen: string; params?: object }> = {
  live: { route: 'Tabs', screen: 'Live' },
  radio: { route: 'Tabs', screen: 'Listen' },
  adotopoc: { route: 'Stack', screen: 'Adotopoc' },
  written: { route: 'Stack', screen: 'WrittenTestimonies' },
  testimonies: { route: 'Tabs', screen: 'Testimonies' },
  sponsor: { route: 'Stack', screen: 'Sponsor' },
  downloads: { route: 'Tabs', screen: 'Downloads' },
};

export class AssistantError extends Error {}

/** Sends the chat so far and returns the next answer. Pass an AbortSignal to support "Stop". */
export async function askAssistant(messages: AssistantMessage[], signal?: AbortSignal): Promise<AssistantReply> {
  const user = auth.currentUser;
  if (!user) throw new AssistantError('Sign in to use the T.O.P AI Assistant.');
  const token = await user.getIdToken();

  let response: Response;
  try {
    response = await fetch(`${CONFIG.authApiUrl}/api/ai/assistant`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new AssistantError('No connection. Check your internet and try again.');
  }

  const data = (await response.json().catch(() => null)) as Partial<AssistantReply> & { error?: string } | null;
  if (!response.ok || !data) {
    throw new AssistantError(data?.error || 'The assistant is not available right now. Please try again.');
  }
  return {
    reply: String(data.reply ?? ''),
    testimonies: Array.isArray(data.testimonies) ? data.testimonies : [],
    clips: Array.isArray((data as { clips?: unknown }).clips) ? ((data as { clips: AssistantClip[] }).clips) : [],
    sources: Array.isArray(data.sources) ? data.sources : [],
    navigate: typeof data.navigate === 'string' && ASSISTANT_TARGETS[data.navigate] ? data.navigate : null,
  };
}
