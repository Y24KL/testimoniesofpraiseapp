import type {
  AdotopocConfig,
  LyricalAnalysis,
  FeaturedChoir,
  LoveworldSingersVideo,
  AppNotification,
  Article,
  AudioTestimony,
  LiveConfig,
  Page,
  Promotion,
  RadioConfig,
  Testimony,
  WrittenTestimony,
} from '@/types';

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

export interface ChoirRequestInput {
  groupName: string;
  churchZone: string;
  ministrationUrl: string;
  songTitle: string;
}

export interface CreateArticleInput {
  title: string;
  author: string;
  category: string;
  body: string;
  coverImageUrl?: string;
  isPublished?: boolean;
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

  // Upgraded Feature Methods
  getPromotions(): Promise<Promotion[]>;
  getArticles(limit?: number): Promise<Article[]>;
  getArticle(id: string): Promise<Article | null>;
  publishArticle(input: CreateArticleInput): Promise<string>;
  getAudioTestimonies(limit?: number): Promise<AudioTestimony[]>;
  /** One published audio testimony, or null when it is unpublished / removed. */
  getAudioTestimony(id: string): Promise<AudioTestimony | null>;
  getRadioConfig(): Promise<RadioConfig>;
  subscribeRadio(cb: (cfg: RadioConfig) => void, onError?: (e: unknown) => void): () => void;
  getAdotopocConfig(): Promise<AdotopocConfig>;
  /** Published written testimonies, newest first (paged). */
  getWrittenTestimonies(opts: PageOptions): Promise<Page<WrittenTestimony>>;
  /** One published written testimony, or null when it is unpublished / removed. */
  getWrittenTestimony(id: string): Promise<WrittenTestimony | null>;

  /** Published lyrical analyses, in the admin's display order (paged). */
  getLyricalAnalyses(opts: PageOptions): Promise<Page<LyricalAnalysis>>;
  /** One published lyrical analysis, or null when it is unpublished / removed. */
  getLyricalAnalysis(id: string): Promise<LyricalAnalysis | null>;

  /** Published "Worship with your LoveWorld Singers" videos, in the admin's order. */
  getLoveworldSingersVideos(limit?: number): Promise<LoveworldSingersVideo[]>;
  /** One published singers video, or null when it is unpublished / removed. */
  getLoveworldSingersVideo(id: string): Promise<LoveworldSingersVideo | null>;
  /** Published featured choir/group videos, in the admin's order. */
  getFeaturedChoirs(limit?: number): Promise<FeaturedChoir[]>;
  /** One published featured choir video, or null when it is unpublished / removed. */
  getFeaturedChoir(id: string): Promise<FeaturedChoir | null>;
  /** Saves a "Feature your choir/group" request as pending review. Never publishes anything. */
  submitChoirFeatureRequest(input: ChoirRequestInput, submittedBy: string): Promise<void>;
}