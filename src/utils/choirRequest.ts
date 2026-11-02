/**
 * Validation for "Feature your choir/group on T.O.P" submissions. The web app keeps an identical copy
 * (web/src/utils/choirRequest.ts); the Firestore rules enforce the same limits on the server.
 */

export const CHOIR_LIMITS = {
  groupName: 120,
  churchZone: 160,
  songTitle: 200,
  ministrationUrl: 500,
} as const;

/** Video hosts a ministration link may come from. */
const SUPPORTED_HOST = /^(?:www\.|m\.)?(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch|vimeo\.com)$/i;

/** True for an https link to a supported video host (YouTube, Facebook or Vimeo). */
export function isSupportedMinistrationUrl(raw: string): boolean {
  const value = raw.trim();
  if (!/^https:\/\//i.test(value)) return false;
  try {
    return SUPPORTED_HOST.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

export interface ChoirRequestInput {
  groupName: string;
  churchZone: string;
  ministrationUrl: string;
  songTitle: string;
}

export type ChoirRequestErrors = Partial<Record<keyof ChoirRequestInput, string>>;

/** Returns one message per invalid field; an empty object means the form can be sent. */
export function validateChoirRequest(input: ChoirRequestInput): ChoirRequestErrors {
  const errors: ChoirRequestErrors = {};
  if (!input.groupName.trim()) errors.groupName = 'Enter your group or choir name.';
  else if (input.groupName.trim().length > CHOIR_LIMITS.groupName) errors.groupName = 'This name is too long.';
  if (!input.churchZone.trim()) errors.churchZone = 'Enter your church zone.';
  else if (input.churchZone.trim().length > CHOIR_LIMITS.churchZone) errors.churchZone = 'This zone is too long.';
  if (!input.ministrationUrl.trim()) errors.ministrationUrl = 'Paste the link to your ministration video.';
  else if (input.ministrationUrl.trim().length > CHOIR_LIMITS.ministrationUrl) errors.ministrationUrl = 'This link is too long.';
  else if (!isSupportedMinistrationUrl(input.ministrationUrl))
    errors.ministrationUrl = 'Use a secure link from YouTube, Facebook or Vimeo.';
  if (!input.songTitle.trim()) errors.songTitle = 'Enter the song title.';
  else if (input.songTitle.trim().length > CHOIR_LIMITS.songTitle) errors.songTitle = 'This title is too long.';
  return errors;
}

/** The KingsChat page the confirmation screen points people to. */
export const KINGSCHAT_PAGE_URL = 'https://kingschat.online/user/testimonies.lmm';
export const KINGSCHAT_HANDLE = '@testimonies.lmm';
