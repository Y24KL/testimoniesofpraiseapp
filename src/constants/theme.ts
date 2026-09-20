/**
 * Brand tokens.
 *
 * VERIFIED from the live website: primary purple #4B006E (its <meta name="theme-color">).
 * NOT VERIFIED (the site is a client-rendered app whose CSS could not be read when this project
 * was generated): every other value below is a placeholder derived from that purple.
 * Open the site's DevTools, copy the real colors / fonts, and update this ONE file.
 */
export const colors = {
  primary: '#4B006E',
  primaryDark: '#2E0044',
  primaryLight: '#7A1FA2',
  accent: '#F5C542', // TODO: replace with the website's real accent color
  bg: '#12001C',
  surface: '#1E0A2B',
  card: '#2A1240',
  border: '#3D2456',
  text: '#FFFFFF',
  textMuted: '#C9B5D9',
  danger: '#FF6B7F',
  success: '#3DDC97',
  live: '#FF3B4E',
  overlay: 'rgba(18,0,28,0.72)',
};

export const gradients = {
  hero: ['#4B006E', '#2E0044', '#12001C'] as const,
  card: ['rgba(75,0,110,0.0)', 'rgba(18,0,28,0.92)'] as const,
  brand: ['#7A1FA2', '#4B006E'] as const,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };

export const type = {
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: 0.3 },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '400' as const },
  caps: { fontSize: 12, fontWeight: '800' as const, letterSpacing: 1.4 },
};
