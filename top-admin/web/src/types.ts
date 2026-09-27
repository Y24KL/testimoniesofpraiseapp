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

export type Route =
  | { name: 'dashboard' }
  | { name: 'testimonies' }
  | { name: 'editor'; id?: string; prefill?: Partial<Testimony> }
  | { name: 'live' }
  | { name: 'submissions' }
  | { name: 'announcements' }
  | { name: 'sponsorships' };
