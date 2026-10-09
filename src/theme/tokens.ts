/**
 * Design tokens. All screens use these instead of raw values.
 * Colors are chosen for WCAG AA contrast (text >= 4.5:1 on its background) in both schemes.
 */

const palette = {
  teal700: '#0F766E',
  teal600: '#0D9488',
  teal300: '#5EEAD4',
  teal950: '#042F2E',
  red700: '#B91C1C',
  red300: '#FCA5A5',
  amber800: '#92400E',
  amber300: '#FCD34D',
  green700: '#15803D',
  green300: '#86EFAC',
};

export const lightColors = {
  background: '#FFFFFF',
  surface: '#F4F5F7',
  surfaceRaised: '#FFFFFF',
  border: '#D4D7DD',
  text: '#111827',
  textMuted: '#4B5563',
  primary: palette.teal700,
  primaryText: '#FFFFFF',
  primarySoft: '#CCFBF1',
  danger: palette.red700,
  dangerSoft: '#FEE2E2',
  warning: palette.amber800,
  warningSoft: '#FEF3C7',
  success: palette.green700,
  successSoft: '#DCFCE7',
  focus: palette.teal600,
};

export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  background: '#0B0F14',
  surface: '#151B23',
  surfaceRaised: '#1C2430',
  border: '#2E3846',
  text: '#F3F4F6',
  textMuted: '#A7B0BE',
  primary: palette.teal300,
  primaryText: palette.teal950,
  primarySoft: '#123B38',
  danger: palette.red300,
  dangerSoft: '#3B1414',
  warning: palette.amber300,
  warningSoft: '#3A2A0A',
  success: palette.green300,
  successSoft: '#0F2F1C',
  focus: palette.teal300,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Minimum touch target (Android guideline is 48dp; we use 52 for non-technical users). */
export const MIN_TAP_TARGET = 52;

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Cap dynamic type so layouts stay usable at the largest accessibility sizes. */
export const MAX_FONT_SCALE = 1.6;
