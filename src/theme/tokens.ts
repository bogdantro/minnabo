/**
 * Design tokens derived from the 7 MinNabo mockups.
 * These are the single source of truth for colour, spacing and type.
 * Components must never hardcode hex values.
 */

const font = {
  regular: 'Mulish_400Regular',
  bold: 'Mulish_700Bold',
  extrabold: 'Mulish_800ExtraBold',
} as const;

const color = {
  navy: '#0B2E4E',
  navyMuted: '#7A8794',
  lime: '#8CC63F',
  limeGradientEnd: '#A5D638',
  limeTint: '#F4F9EC',
  cyan: '#22A9E0',
  cyanTint: '#EAF7FD',
  bg: '#FDFBFA',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  line: '#ECEFF2',
  bubbleIn: '#EDEFF2',
  bubbleOut: '#DBF1FB',
  star: '#F5B301',
  shieldGreen: '#3AAE5C',
  dangerText: '#C0392B',
  overlay: 'rgba(11,46,78,0.55)',
} as const;

const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

const radius = {
  sm: 8,
  md: 12,
  tile: 16,
  card: 18,
  pill: 999,
} as const;

const text = {
  h1: { fontSize: 26, lineHeight: 32, fontFamily: font.extrabold },
  /** The single screen-title style. Every tab's first heading uses this. */
  question: { fontSize: 24, lineHeight: 30, fontFamily: font.bold },
  section: { fontSize: 19, lineHeight: 25, fontFamily: font.bold },
  cardTitle: { fontSize: 17, lineHeight: 23, fontFamily: font.bold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: font.regular },
  meta: { fontSize: 13, lineHeight: 18, fontFamily: font.regular },
} as const;

const shadow = {
  card: {
    shadowColor: '#0B2E4E',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fab: {
    shadowColor: '#0B2E4E',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;

export const tokens = { color, space, radius, font, text, shadow } as const;

export type ColorToken = keyof typeof color;
export type TextVariant = keyof typeof text;
export type FontWeight = keyof typeof font;
