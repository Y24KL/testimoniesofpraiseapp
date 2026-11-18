/** Rules for reporting community content. The Firestore rules enforce the same reasons and id format. */

export const REPORT_CONTENT_TYPES = ['testimony', 'lyrical', 'article', 'choir', 'comment', 'written'] as const;
export type ReportContentType = (typeof REPORT_CONTENT_TYPES)[number];

export const REPORT_REASONS = [
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'misleading', label: 'Misleading or false' },
  { id: 'hateful', label: 'Hateful or abusive' },
  { id: 'spam', label: 'Spam or advertising' },
  { id: 'other', label: 'Something else' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

const ID = /^[A-Za-z0-9_-]{1,100}$/;

/** The one report a person may file for an item. Its id is what stops a second report. */
export function reportKey(uid: string, contentType: ReportContentType, contentId: string): string | null {
  if (!uid || !(REPORT_CONTENT_TYPES as readonly string[]).includes(contentType) || !ID.test(contentId)) return null;
  return `${uid}_${contentType}_${contentId}`;
}

export function isReportReason(value: string): value is ReportReason {
  return REPORT_REASONS.some((r) => r.id === value);
}

/** A note is optional and short. Returns the trimmed note, or null when there is none. */
export function cleanNote(note: string | undefined): string | null {
  const t = (note ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, 300) : null;
}
