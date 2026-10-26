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

export type NotificationType = 'testimony' | 'resource' | 'live' | 'announcement' | 'featured' | 'article' | 'promotion' | 'radio';

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

export interface DownloadItem {
  key: string;
  id: string;
  title: string;
  thumbnail?: string;
  remoteUrl: string;
  blob?: Blob;
  status: DownloadStatus;
  progress: number;
  sizeBytes?: number;
  failure?: DownloadFailure;
  createdAt: number;
  data: Testimony;
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

export type CommentMediaType = 'video' | 'audio';

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
