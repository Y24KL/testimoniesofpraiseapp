import type { Timestamp } from 'firebase/firestore';

export interface Testimony {
  id: string;
  title: string;
  description: string;
  authorName: string;
  category: string;
  keywords: string[];
  thumbnail: string;
  videoUrl: string;
  duration: number; // seconds
  isPublished: boolean;
  isFeatured: boolean;
  isDownloadable: boolean;
  notifyOnPublish: boolean;
  createdAt?: Timestamp;
  publishedAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Submission {
  id: string;
  fullName: string;
  churchZone: string;
  testimony: string;
  userEmail: string | null;
  status: 'pending' | 'approved' | 'rejected';
  linkedTestimonyId?: string;
  linkedWrittenId?: string;
  createdAt?: Timestamp;
}

export type SponsorshipStatus = 'pending' | 'approved' | 'rejected';

export interface Sponsorship {
  id: string;
  uid: string;
  userEmail: string | null;
  amount?: string;
  note?: string;
  receiptUrl: string;
  status: SponsorshipStatus;
  createdAt?: Timestamp;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  contentId?: string;
  published: boolean;
  skipPush?: boolean;
  createdAt?: Timestamp;
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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Article {
  id: string;
  title: string;
  body: string;
  coverImageUrl?: string;
  category?: string;
  author?: string;
  isPublished: boolean;
  publishedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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
  publishedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface RadioSettings {
  isLive: boolean;
  streamUrl: string;
  currentProgramme: string;
  description?: string;
  sessionId?: string;
  updatedAt?: Timestamp;
}

export interface AdotopocSettings {
  resourcePageUrl: string;
  introVideoUrl: string;
  introEnabled: boolean;
  updatedAt?: Timestamp;
}

export type Route =
  | { name: 'dashboard' }
  | { name: 'testimonies' }
  | { name: 'editor'; id?: string; prefill?: Partial<Testimony> }
  | { name: 'live' }
  | { name: 'submissions' }
  | { name: 'announcements' }
  | { name: 'sponsorships' }
  | { name: 'promotions' }
  | { name: 'articles' }
  | { name: 'articleEditor'; id?: string }
  | { name: 'radio' }
  | { name: 'adotopoc' }
  | { name: 'media' }
  | { name: 'comments' }
  | { name: 'written' }
  | { name: 'writtenEditor'; id?: string; prefill?: import('./pages/WrittenTestimonyEditor').WrittenPrefill }
  | { name: 'data' };

