/**
 * Testimonies of Praise design tokens (mobile). The web app mirrors these in web/src/theme.ts.
 *
 * Brand: royal purple (#4B006E, the website's theme-color) + gold (from the logo).
 * Keep every color decision here so screens stay consistent.
 */
export const colors = {
  primary: '#4B006E',
  primaryDark: '#2E0044',
  primaryLight: '#7A1FA2',
  accent: '#F5C542', // brand gold
  accentDeep: '#D99A1E',
  accentSoft: 'rgba(245,197,66,0.14)',
  onAccent: '#2A0040', // text/icons placed on gold
  bg: '#12001C',
  surface: '#1C0829',
  surfaceRaised: '#251035',
  card: '#2A1240',
  border: '#3A2253',
  borderSoft: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  textMuted: '#CDBBDD',
  textSubtle: '#9C86B3',
  danger: '#FF6B7F',
  success: '#3DDC97',
  live: '#FF3B4E',
  overlay: 'rgba(18,0,28,0.72)',
  cardBorder: '#3A2253',
  surfaceLight: '#2E0044',
};

export const gradients = {
  hero: ['#4B006E', '#2E0044', '#12001C'] as const,
  card: ['rgba(18,0,28,0)', 'rgba(18,0,28,0.55)', 'rgba(18,0,28,0.96)'] as const,
  brand: ['#7A1FA2', '#4B006E'] as const,
  gold: ['#FFE08A', '#F5C542', '#D99A1E'] as const,
  /** Scrim for media behind text (onboarding, heroes). Top stays clear, bottom is near-opaque. */
  scrim: ['rgba(18,0,28,0.15)', 'rgba(18,0,28,0.55)', 'rgba(18,0,28,0.97)'] as const,
  live: ['rgba(255,59,78,0.0)', 'rgba(75,0,110,0.65)', 'rgba(18,0,28,0.97)'] as const,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 };

export const type = {
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.4, lineHeight: 38 },
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.2, lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  h3: { fontSize: 16, fontWeight: '700' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caps: { fontSize: 12, fontWeight: '800' as const, letterSpacing: 1.2 },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.8 },
  caption: { fontSize: 12, fontWeight: '400' as const },
};

export const shadow = {
  card: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  gold: { shadowColor: '#F5C542', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
};

/** Height of the floating mini audio player (screens add this to their bottom padding when it shows). */
export const MINI_PLAYER_HEIGHT = 64;
