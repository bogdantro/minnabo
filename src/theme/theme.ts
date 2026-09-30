/**
 * MinNabo design tokens.
 * Source of truth: design/screens/mn.css. Every value here is copied from it.
 * Rule: NO gradients anywhere in the app. Flat colours only.
 */
import { Platform, TextStyle, ViewStyle } from 'react-native';

// ---------------------------------------------------------------- colours
export const colors = {
  ink: '#0A1740',        // primary text, dark buttons, active chips
  ink2: '#34405F',       // secondary text, body copy on cards
  mute: '#5F6983',       // meta text (passes 4.5:1 on white)
  faint: '#8A93A8',      // icons in meta rows, chevrons (not for text)
  line: '#E4E8EE',       // borders, dividers
  line2: '#EEF1F4',      // inner row dividers
  bg: '#F3F5F1',         // screen background
  surface: '#FFFFFF',    // cards, sheets, nav
  surface2: '#F7F8FA',   // quiet info boxes

  lime: '#B8EE3C',       // primary action (btn-lime, FAB, progress), navy text on top
  lime2: '#9BDD2C',
  limeDeep: '#3B7300',   // lime text/icons on light bg, active tab label
  limeTint: '#EDF8D6',   // "Trenger hjelp" pill bg, active tab bubble
  limeDot: '#8BD21E',    // dot inside need-pill

  cyan: '#19B8EE',       // avatar ring, accent dots
  cyan2: '#0A74B4',      // btn-cyan bg (white text), focus ring border
  cyanDeep: '#065C8F',   // links
  cyanTint: '#DFF2FB',

  star: '#F0A500',
  danger: '#C23029', dangerTint: '#FDEBE9',
  warn: '#9A5B00', warnTint: '#FFF2D9',
  ok: '#2B8F4E', okText: '#1D6E3A', okTint: '#E3F5E8',
  toggleOn: '#3F9A1A', toggleOff: '#CDD2DB',
  notifDot: '#F2542D',   // unread badge / bell dot
  online: '#2FBF62',
  scrim: 'rgba(10,23,64,0.45)',
  vipps: '#FF5B24',      // ONLY the login button
} as const;

/** Category art tiles (stand-in for listing photos). bg + icon colour. */
export const categoryColors = {
  hage:        { bg: '#D9F0BE', fg: '#3A7010' },
  rengjoring:  { bg: '#D3ECFA', fg: '#0B6FA3' },
  flytting:    { bg: '#F4E6D0', fg: '#8C5714' },
  transport:   { bg: '#E4E1FA', fg: '#4F40B5' },
  montering:   { bg: '#FBE1D5', fg: '#A5461F' },
  snomaking:   { bg: '#DFEAF8', fg: '#2E5A9A' },
  maling:      { bg: '#F8DCE7', fg: '#9E335E' },
  dyrepass:    { bg: '#F7EDC6', fg: '#7A5F00' },
  data:        { bg: '#D4F2E8', fg: '#136F5C' },
  arrangement: { bg: '#EEDDF7', fg: '#7B359F' },
  annet:       { bg: '#E9ECF1', fg: '#46506A' },
} as const;
export type CategoryId = keyof typeof categoryColors;

export const categoryLabels: Record<CategoryId, string> = {
  hage: 'Hage', rengjoring: 'Rengjøring', flytting: 'Flytting/bæring',
  transport: 'Transport/levering', montering: 'Montering', snomaking: 'Snømåking',
  maling: 'Maling/vedlikehold', dyrepass: 'Dyrepass', data: 'Datahjelp',
  arrangement: 'Arrangementshjelp', annet: 'Annet',
};

/** Avatar fallback colours (initials). Pick by hash of user id. 'me' = current user. */
export const avatarColors = {
  a: { bg: '#E4F4C9', fg: '#2F5C08' }, b: { bg: '#D6EEFB', fg: '#0A5680' },
  c: { bg: '#FBE3D7', fg: '#8C3A16' }, d: { bg: '#E8E3FB', fg: '#46379E' },
  e: { bg: '#F7E9C4', fg: '#6B5200' }, f: { bg: '#D6F2E9', fg: '#125F4F' },
  g: { bg: '#F7DDE8', fg: '#8A2B52' }, me: { bg: '#0A1740', fg: '#FFFFFF' },
} as const;

// ---------------------------------------------------------------- type
// expo: @expo-google-fonts/bricolage-grotesque + @expo-google-fonts/figtree
export const fonts = {
  displayMedium: 'BricolageGrotesque_500Medium',
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
  bodyHeavy: 'Figtree_800ExtraBold',
} as const;

// letterSpacing in CSS was em; converted to px at that size.
export const text = {
  display42: { fontFamily: fonts.display, fontSize: 42, lineHeight: 43, letterSpacing: -1.47, color: colors.ink },
  h1:   { fontFamily: fonts.display, fontSize: 31, lineHeight: 33, letterSpacing: -0.93, color: colors.ink },
  h2:   { fontFamily: fonts.display, fontSize: 24, lineHeight: 27, letterSpacing: -0.6, color: colors.ink },
  h3:   { fontFamily: fonts.display, fontSize: 20, lineHeight: 23, letterSpacing: -0.4, color: colors.ink },
  sectionTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 23, letterSpacing: -0.5, color: colors.ink },
  h4:   { fontFamily: fonts.bodyBold, fontSize: 16.5, lineHeight: 21, color: colors.ink },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 20, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22.5, color: colors.ink },
  bodySemi: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17.5, color: colors.mute },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 12, letterSpacing: 0.96, textTransform: 'uppercase', color: colors.mute },
  price: { fontFamily: fonts.display, fontSize: 19, lineHeight: 19, letterSpacing: -0.38, color: colors.ink },
  button: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 16 },
  buttonSm: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 14 },
  pill: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 12, letterSpacing: 0.12 },
  chip: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 14 },
  tabLabel: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 11 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 17, color: colors.ink },
  input: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink },
  amount: { fontFamily: fonts.display, fontSize: 34, letterSpacing: -0.68, color: colors.ink },
} satisfies Record<string, TextStyle>;

// ---------------------------------------------------------------- layout
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const screenPadding = 20;           // horizontal gutter on every screen
export const safeTopExtra = 10;            // add to safe-area top inset under headers

export const radius = {
  s: 10, m: 16, card: 22, listingCard: 24, sheet: 32, dialog: 28,
  input: 17, thumb: 17, tile: 18, pill: 999,
} as const;

export const sizes = {
  button: 52, buttonSm: 40, buttonLg: 58,
  iconButton: 44, input: 56, amountInput: 76, chip: 42, chipSm: 36, pill: 26,
  search: 54, locationRow: 56, toggleW: 52, toggleH: 32, checkbox: 26, radio: 24,
  navHeight: 74, navBottom: 16, navSide: 12, fab: 62, fabLift: 30,
  listingThumbW: 96, listingThumbMinH: 118,
  minTouch: 44,
} as const;

export const avatarSizes = { 28: 28, 32: 32, 40: 40, 48: 48, 56: 56, 64: 64, 88: 88 } as const;

// ---------------------------------------------------------------- depth
// iOS uses shadow*, Android uses elevation (will look slightly softer).
const sh = (y: number, blur: number, opacity: number, elevation: number): ViewStyle =>
  Platform.select({
    ios: { shadowColor: colors.ink, shadowOffset: { width: 0, height: y }, shadowRadius: blur / 2, shadowOpacity: opacity },
    default: { elevation },
  }) as ViewStyle;

export const shadow = {
  card: sh(8, 24, 0.10, 2),     // --sh
  medium: sh(16, 36, 0.16, 6),  // --sh-m
  large: sh(24, 60, 0.26, 12),  // --sh-l  (nav, toast, dialog)
  fab: sh(14, 26, 0.30, 10),
} as const;

// ---------------------------------------------------------------- motion (react-native-reanimated)
export const motion = {
  // CSS cubic-bezier(.2,.8,.2,1)  -> Easing.bezier(0.2, 0.8, 0.2, 1)
  ease: [0.2, 0.8, 0.2, 1] as const,
  // CSS cubic-bezier(.3,1.45,.5,1) springy overshoot -> withSpring(config below)
  spring: { damping: 14, stiffness: 220, mass: 0.9 },
  durations: {
    fadeUp: 550,      // entering: FadeInDown.duration(550).easing(Easing.bezier(...ease))
    stagger: 50,      // .d1..d10 = 50ms steps (d9=500, d10=600)
    sheet: 450,
    toast: 450,
    toastVisible: 2600,
    dialog: 350,
    tabIndicator: 300,
    toggle: 300,
    checkDraw: 600,
    skeletonPulse: 1300,
  },
  fadeUpDistance: 16,
} as const;

// ---------------------------------------------------------------- icons
// All icons are the Lucide set (lucide-react-native), stroke 2, 20px default.
export const icons = {
  clip: 'ClipboardList', users: 'Users', plus: 'Plus', minus: 'Minus', msg: 'MessageSquare',
  menu: 'Menu', bell: 'Bell', search: 'Search', pin: 'MapPin', clock: 'Clock', heart: 'Heart',
  star: 'Star', back: 'ArrowLeft', right: 'ChevronRight', left: 'ChevronLeft', down: 'ChevronDown',
  up: 'ChevronUp', arrow: 'ArrowRight', arrowur: 'ArrowUpRight', x: 'X', check: 'Check',
  checks: 'CheckCheck', sliders: 'SlidersHorizontal', shield: 'ShieldCheck', verified: 'BadgeCheck',
  cal: 'Calendar', send: 'Send', clipper: 'Paperclip', image: 'Image', camera: 'Camera',
  more: 'MoreHorizontal', share: 'Share', locate: 'LocateFixed', nav: 'Navigation', user: 'User',
  gear: 'Settings', lock: 'Lock', flag: 'Flag', ban: 'Ban', trash: 'Trash2', edit: 'Pencil',
  bookmark: 'Bookmark', tag: 'Tag', brief: 'Briefcase', info: 'Info', alert: 'TriangleAlert',
  wifioff: 'WifiOff', refresh: 'RotateCw', play: 'Play', pause: 'Pause', home: 'Home',
  phone: 'Smartphone', mail: 'Mail', building: 'Building2', file: 'FileText', download: 'Download',
  eye: 'Eye', sun: 'Sun', zap: 'Zap', repeat: 'Repeat', smile: 'Smile', thumb: 'ThumbsUp',
  pinned: 'Pin', gift: 'Gift', map: 'Map', logout: 'LogOut', chart: 'BarChart3', archive: 'Archive',
  list: 'ListChecks', award: 'Award', hand: 'Handshake', key: 'Key', globe: 'Globe', mic: 'Mic',
  undo: 'Undo2', moon: 'Moon', sparkle: 'Sparkle', copy: 'Copy', reply: 'Reply', hourglass: 'Hourglass',
  // categories
  hage: 'Leaf', rengjoring: 'Sparkles', flytting: 'Package', transport: 'Truck', montering: 'Wrench',
  snomaking: 'Snowflake', maling: 'PaintRoller', dyrepass: 'PawPrint', data: 'Laptop',
  arrangement: 'PartyPopper', annet: 'LayoutGrid',
} as const;

export const theme = { colors, categoryColors, avatarColors, fonts, text, space, radius, sizes, shadow, motion, icons };
export default theme;
