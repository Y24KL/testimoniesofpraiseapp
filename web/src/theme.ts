/** Design tokens for the web app. Mirrors src/constants/theme.ts (mobile); CSS variables live in index.css. */
export const colors = {
  primary: '#4B006E',
  primaryDark: '#2E0044',
  primaryLight: '#7A1FA2',
  accent: '#F5C542',
  accentDeep: '#D99A1E',
  accentSoft: 'rgba(245,197,66,0.14)',
  onAccent: '#2A0040',
  bg: '#12001C',
  surface: '#1C0829',
  surfaceRaised: '#251035',
  card: '#2A1240',
  border: '#3A2253',
  borderSoft: 'rgba(255,255,255,0.08)',
  cardBorder: '#3A2253',
  surfaceLight: '#2E0044',
  text: '#FFFFFF',
  textMuted: '#CDBBDD',
  textSubtle: '#9C86B3',
  danger: '#FF6B7F',
  success: '#3DDC97',
  live: '#FF3B4E',
  overlay: 'rgba(18,0,28,0.78)',
};

export const gradients = {
  hero: 'linear-gradient(180deg, #4B006E 0%, #2E0044 50%, #12001C 100%)',
  card: 'linear-gradient(180deg, rgba(18,0,28,0) 0%, rgba(18,0,28,0.55) 40%, rgba(18,0,28,0.96) 100%)',
  brand: 'linear-gradient(135deg, #7A1FA2 0%, #4B006E 100%)',
  gold: 'linear-gradient(135deg, #FFE08A 0%, #F5C542 50%, #D99A1E 100%)',
};

export const radius = {
  sm: '8px',
  md: '14px',
  lg: '20px',
  xl: '28px',
  pill: '999px',
};
