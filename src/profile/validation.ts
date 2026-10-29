/**
 * Registration profile rules, shared by the app and checked by tests (tests/profileValidation.test.mjs).
 * Firestore rules enforce the same limits server-side (users/{uid} in top-admin/firestore.rules).
 */
export const PROFILE_TITLES = ['Mr', 'Mrs', 'Ms', 'Bro', 'Sis', 'Deacon', 'Deaconess', 'Pastor', 'Evangelist'] as const;
export type ProfileTitle = (typeof PROFILE_TITLES)[number];

export const PROFILE_LIMITS = { fullName: 120, zone: 120, church: 160 } as const;

export interface ProfileInput {
  title: string;
  fullName: string;
  zone: string;
  church: string;
}

export interface ValidProfile {
  title: ProfileTitle;
  fullName: string;
  zone: string;
  church: string;
}

export type ProfileErrors = Partial<Record<keyof ProfileInput, string>>;

/** Collapses inner whitespace and trims the ends, so "  Ada   Obi " becomes "Ada Obi". */
export const normalizeText = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

export const isProfileTitle = (v: string): v is ProfileTitle => (PROFILE_TITLES as readonly string[]).includes(v);

/** Returns the cleaned profile, or the message for each field that needs fixing. */
export function validateProfile(input: ProfileInput): { ok: true; value: ValidProfile } | { ok: false; errors: ProfileErrors } {
  const errors: ProfileErrors = {};
  const title = input.title?.trim() ?? '';
  const fullName = normalizeText(input.fullName);
  const zone = normalizeText(input.zone);
  const church = normalizeText(input.church);

  if (!isProfileTitle(title)) errors.title = 'Choose your title.';
  if (!fullName) errors.fullName = 'Enter your full name.';
  else if (fullName.length < 2) errors.fullName = 'Your name must be at least 2 characters.';
  else if (fullName.length > PROFILE_LIMITS.fullName) errors.fullName = `Keep your name under ${PROFILE_LIMITS.fullName} characters.`;
  if (!zone) errors.zone = 'Enter your zone.';
  else if (zone.length > PROFILE_LIMITS.zone) errors.zone = `Keep your zone under ${PROFILE_LIMITS.zone} characters.`;
  if (!church) errors.church = 'Enter your church.';
  else if (church.length > PROFILE_LIMITS.church) errors.church = `Keep your church name under ${PROFILE_LIMITS.church} characters.`;

  if (Object.keys(errors).length > 0 || !isProfileTitle(title)) return { ok: false, errors };
  return { ok: true, value: { title, fullName, zone, church } };
}
