/**
 * Base design system tokens for Fantasy Draft Assistant.
 * Keep this the single source of truth for colors/spacing/typography so
 * screens don't hardcode ad-hoc values (tasks.md #1.4).
 */
export const colors = {
  background: '#0B1120',
  surface: '#141B2D',
  surfaceAlt: '#1C2438',
  primary: '#4F8EF7',
  primaryMuted: '#2C4A82',
  accent: '#F7B84F',
  success: '#3FBE7E',
  danger: '#E5484D',
  textPrimary: '#F5F7FA',
  textSecondary: '#9AA5B4',
  border: '#242D42',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

export const theme = { colors, spacing, typography, radii };
export type Theme = typeof theme;
