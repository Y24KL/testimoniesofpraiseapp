import type { AppNotification, LiveConfig, Page, Testimony } from '@/types';

export interface PageOptions {
  limit: number;
  cursor?: unknown;
  featuredOnly?: boolean;
}

export interface SubmissionInput {
  fullName: string;
  churchZone: string;
  testimony: string;
  userId?: string;
  userEmail?: string | null;
}

/** The only surface the UI talks to. Implementations: Firestore (default) and REST. */
export interface ContentRepository {
  getTestimonies(opts: PageOptions): Promise<Page<Testimony>>;
  getTestimony(id: string): Promise<Testimony | null>;
  getNotifications(max: number): Promise<AppNotification[]>;
  /** Calls `cb` immediately and whenever the Admin Portal changes the live config. Returns unsubscribe. */
  subscribeLive(cb: (live: LiveConfig) => void, onError?: (e: unknown) => void): () => void;
  submitTestimony(input: SubmissionInput): Promise<void>;
  registerPushToken(input: { token: string; uid: string; platform: string; prefs: Record<string, boolean> }): Promise<void>;
  unregisterPushToken(token: string): Promise<void>;
  recordEvent(event: string, params: Record<string, string | number | boolean | undefined>, uid?: string): Promise<void>;
}
