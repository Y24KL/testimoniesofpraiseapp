/**
 * Pure rules for personal discovery data: which activity types may be recorded, which interests may be
 * saved, and how the opt-out is read. The Firestore rules enforce the same lists on the server; keeping
 * them here as well means a bad value is never even sent.
 */

export const ACTIVITY_TYPES = ['view', 'play', 'complete', 'save', 'open_notification'] as const;
export const CONTENT_TYPES = ['testimony', 'lyrical', 'article', 'written', 'audio', 'live'] as const;
export const ACTIVITY_SOURCES = ['home', 'testimonies', 'listen', 'live', 'search', 'assistant', 'notification'] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type ContentType = (typeof CONTENT_TYPES)[number];
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

export interface ActivityEvent {
  type: ActivityType;
  contentType: ContentType;
  contentId: string;
  source: ActivitySource;
}

/** Interests a person can choose. Tags are fixed, so no free text is ever stored. */
export const INTEREST_TAGS = ['healing', 'worship', 'family', 'finances', 'faith', 'youth', 'marriage', 'deliverance', 'hope', 'missions'] as const;
export type InterestTag = (typeof INTEREST_TAGS)[number];
export const MAX_INTERESTS = 20;

const CONTENT_ID = /^[A-Za-z0-9_-]{1,100}$/;

/** Returns the event if it is valid, otherwise null. */
export function validActivity(event: Partial<ActivityEvent>): ActivityEvent | null {
  if (!event || !(ACTIVITY_TYPES as readonly string[]).includes(event.type as string)) return null;
  if (!(CONTENT_TYPES as readonly string[]).includes(event.contentType as string)) return null;
  if (typeof event.contentId !== 'string' || !CONTENT_ID.test(event.contentId)) return null;
  if (!(ACTIVITY_SOURCES as readonly string[]).includes(event.source as string)) return null;
  return { type: event.type!, contentType: event.contentType!, contentId: event.contentId, source: event.source! };
}

/** Keeps only known tags, removes duplicates, and bounds the list. */
export function sanitizeInterests(input: unknown): InterestTag[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<string>(INTEREST_TAGS);
  const out: InterestTag[] = [];
  for (const value of input) {
    if (typeof value === 'string' && allowed.has(value) && !out.includes(value as InterestTag)) out.push(value as InterestTag);
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
}

/** Discovery settings as stored at users/{uid}/private/discovery. A missing document means "no opt-out, no interests". */
export interface DiscoverySettings {
  interests: InterestTag[];
  optOut: boolean;
}

export function readDiscovery(data: unknown): DiscoverySettings {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return { interests: sanitizeInterests(d.interests), optOut: d.optOut === true };
}

/** Whether activity may be recorded for this person. Opting out stops new activity, but does not delete history. */
export function mayRecordActivity(settings: DiscoverySettings | null | undefined): boolean {
  return !(settings && settings.optOut === true);
}
