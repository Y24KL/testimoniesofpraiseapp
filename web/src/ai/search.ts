import { auth } from '../api/firebase';
import type { Testimony } from '../types';

export interface ExternalSearchSource {
  title: string;
  url: string;
  snippet: string;
  summary?: string;
  siteName?: string;
  date?: string | null;
}

export interface DeepSeekSearchResult {
  answer: string;
  sources: ExternalSearchSource[];
  provider: 'deepseek';
  model?: string;
}

const WORKER_URL = (import.meta.env.VITE_AI_API_URL || 'https://top-push-relay.gtrusouth116.workers.dev').replace(/\/$/, '');

async function postAi<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to use AI search.');
  const token = await user.getIdToken();
  const response = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'AI search is temporarily unavailable.');
  }
  return payload as T;
}

export async function searchExternalWithDeepSeek(query: string): Promise<DeepSeekSearchResult> {
  const clean = query.trim();
  if (!clean) throw new Error('Enter a question to search the web.');
  return postAi<DeepSeekSearchResult>('/api/ai/search', { query: clean });
}

interface SemanticSearchResponse {
  results: Testimony[];
  dimensions: number;
  model: string;
}

export async function searchTestimoniesByMeaning(query: string, limit = 8): Promise<Testimony[]> {
  const clean = query.trim();
  if (!clean) return [];
  const response = await postAi<SemanticSearchResponse>('/api/ai/semantic-search', { query: clean, limit });
  if (!Array.isArray(response.results)) throw new Error('The semantic-search response was invalid.');
  return response.results.filter((item) => item && typeof item.id === 'string' && item.isPublished === true);
}
