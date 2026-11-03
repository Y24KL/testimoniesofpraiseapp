export interface Testimony {
  id: string;
  title: string;
  description: string;
  authorName?: string;
  thumbnail?: string;
  videoUrl: string;
  duration?: number;
  category?: string;
  keywords: string[];
  createdAt: string | null;
  publishedAt: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  isDownloadable: boolean;
}

export type LiveSourceType = 'hls' | 'youtube' | 'unknown';

export interface LiveConfig {
  isLive: boolean;
  streamUrl?: string;
  sourceType?: LiveSourceType;
  sessionId?: string;
  title?: string;
  thumbnail?: string;
  description?: string;
  /**
   * Pre-live playback: what to watch while the main broadcast is offline. Present only when the
   * admin turned "Enable Pre-Live Playback" ON and saved a valid https link (never while isLive).
   */
  preLive?: PreLiveMedia;
}

export interface PreLiveMedia {
  url: string;
  sourceType: 'hls' | 'youtube' | 'file';
  title: string;
  description?: string;
  thumbnail?: string;
}

export type NotificationType = 'testimony' | 'resource' | 'live' | 'announcement' | 'featured' | 'article' | 'promotion' | 'radio' | 'written';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  contentId?: string;
  createdAt: string | null;
  published: boolean;
}

export interface NotificationPrefs {
  testimonies: boolean;
  live: boolean;
  announcements: boolean;
}

export interface Page<T> {
  items: T[];
  cursor?: unknown;
  hasMore: boolean;
}

export type DownloadStatus = 'downloading' | 'done' | 'failed';
export type DownloadFailure = 'network' | 'storage' | 'http' | 'unsupported' | 'unknown';

/** The fields of a video the Downloads manager needs to save it and play it offline. */
export interface VideoSnapshot {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnail?: string;
  duration?: number;
  isDownloadable?: boolean;
}

export interface DownloadItem {
  key: string;
  id: string;
  /** Which library the video came from; decides where a tap on the Downloads list opens. */
  kind?: 'testimony' | 'singers';
  title: string;
  thumbnail?: string;
  remoteUrl: string;
  blob?: Blob;
  status: DownloadStatus;
  progress: number;
  sizeBytes?: number;
  failure?: DownloadFailure;
  createdAt: number;
  data: VideoSnapshot;
}

/** A video in the "Worship with your LoveWorld Singers" library (Firestore: loveworldSingersVideos). */
export interface LoveworldSingersVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnail?: string;
  /** seconds */
  duration?: number;
  isFeatured: boolean;
  order: number;
  isDownloadable: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string | null;
}

/** A group video in the "Featured choirs" showcase (Firestore: featuredChoirs). */
export interface FeaturedChoir {
  id: string;
  groupName: string;
  songTitle: string;
  videoUrl: string;
  thumbnail?: string;
  /** seconds */
  duration?: number;
  order: number;
  isPublished: boolean;
  createdAt: string | null;
}

export type ChoirRequestStatus = 'pending' | 'reviewed' | 'approved' | 'rejected';

/** A "Feature your choir/group" submission (Firestore: choirFeatureRequests). Never shown publicly. */
export interface ChoirFeatureRequest {
  id: string;
  groupName: string;
  churchZone: string;
  ministrationUrl: string;
  songTitle: string;
  submittedBy: string;
  status: ChoirRequestStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

/** "Lyrical Analysis": pre-produced analysis videos of LoveWorld songs (Firestore: lyricalAnalyses). */
export type LyricalAnalysisStatus = 'draft' | 'published' | 'unpublished';

export interface LyricalAnalysis {
  id: string;
  title: string;
  songTitle: string;
  artistName?: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  /** seconds */
  duration?: number;
  publicationDate: string | null;
  status: LyricalAnalysisStatus;
  displayOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text: string;
  createdAt: any;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category?: string;
  destinationUrl: string;
  target?: 'internal' | 'external';
  order: number;
  isPublished: boolean;
  createdAt: string | null;
}

export interface Article {
  id: string;
  title: string;
  body: string;
  coverImageUrl?: string;
  category?: string;
  author?: string;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string | null;
}

export interface AudioTestimony {
  id: string;
  title: string;
  description: string;
  audioUrl: string;
  duration?: number;
  speaker?: string;
  category?: string;
  thumbnailUrl?: string;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string | null;
}

export interface RadioConfig {
  isLive: boolean;
  streamUrl: string;
  currentProgramme: string;
  description?: string;
  sessionId?: string;
}

export interface AdotopocConfig {
  resourcePageUrl: string;
  introVideoUrl: string;
  introEnabled: boolean;
}

export type CommentMediaType = 'video' | 'audio' | 'written';

/** A written (text) testimony from the library. Usually created by an admin from an approved submission. */
export interface WrittenTestimony {
  id: string;
  title: string;
  /** Full text; paragraphs are separated by blank lines / line breaks. */
  body: string;
  excerpt: string;
  authorName?: string;
  churchZone?: string;
  authorPhotoUrl?: string;
  category?: string;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string | null;
}


/** A comment on a video testimony or audio testimony (one per user per item; id = the user's uid). */
export interface TestimonyComment {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  mediaType: CommentMediaType;
  mediaId: string;
  status: 'visible' | 'hidden';
  createdAt: string | null;
  updatedAt: string | null;
}
