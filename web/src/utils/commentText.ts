/** Comment text rules shared by the app (kept in sync with src/utils/commentText.ts (mobile) and the Firestore rules). */
export const MAX_COMMENT_LENGTH = 1000;

export function normalizeCommentText(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

/** Returns a user-facing problem, or null when the text can be posted. */
export function commentTextError(text: string): string | null {
  const t = normalizeCommentText(text);
  if (!t) return 'Write something before posting.';
  if (t.length > MAX_COMMENT_LENGTH) return `Comments can be up to ${MAX_COMMENT_LENGTH} characters (${t.length} now).`;
  return null;
}

/** Public name for a comment: the profile name, never the email address. */
export function commenterName(displayName: string | null | undefined): string {
  const n = (displayName ?? '').trim().replace(/\s+/g, ' ');
  // Some accounts have no profile name and fall back to their email: never publish that.
  if (!n || n.includes('@')) return 'Member';
  return n.slice(0, 60);
}
