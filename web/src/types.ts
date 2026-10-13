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
}

export type NotificationType = 'testimony' | 'resource' | 'live' | 'announcement' | 'featured';

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
