/**
 * MinNabo design tokens.
 * Source of truth: design/screens/mn.css. Every value here is copied from it.
 * Rule: NO gradients anywhere in the app. Flat colours only.
 */
import type { TextStyle, ViewStyle } from 'react-native';

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

  // component colours (also from mn.css)
  softBg: '#EAEDF2',       // btn-soft, "+4" avatar stack
  dangerBorder: '#F2C9C5', // btn-dangerghost border
  neutralPill: '#ECEFF3',  // pill-neutral
  savedBg: '#FDECEC',      // .save.on
  heart: '#E5484D',        // .save.on heart
  control: '#C3C9D4',      // checkbox / radio border
  track: '#E6E9EE',        // segmented bg, skeleton, bars
  progressTrack: '#E1E5EA',// wizard progress / steps
  rangeTrack: '#DDE1E7',
  grabber: '#D6DAE1',
  headBg: 'rgba(243,245,241,0.9)', // StartSamtale / Chat blurred header
  openerBorder: '#BFE3F4',  // StartSamtale opener chips
  halo: 'rgba(184,238,60,0.18)', // avatar halo
  pulseCyan: 'rgba(25,184,238,0.45)',
  onInk75: 'rgba(255,255,255,0.75)',
  onInk08: 'rgba(255,255,255,0.08)', // Mottatte tilbud mini stats
  footTint: '#FBFCFA',
  barMute: '#9AA3B5',      // Sammenlign price bars (not lowest)
  bestTint: '#FFF2D9', bestText: '#8A5200', // "Best vurdert" marker      // group card footer (Mottatte tilbud)
  stampOkBorder: 'rgba(43,143,78,0.5)',  // Avtale "AVTALT" stamp
  stampOkText: 'rgba(29,110,58,0.72)',
  stampOkBg: 'rgba(227,245,232,0.35)',
  stampOffBorder: 'rgba(194,48,41,0.55)', // Avtale "AVLYST" stamp
  stampOffText: 'rgba(194,48,41,0.8)',
  stampOffBg: 'rgba(253,235,233,0.45)',
  edgeOff: '#D9DDE4',       // cancelled agreement edge
  warnDark: '#7A4800',      // "Endringer må avtales" note text
  dangerDark: '#8E2A24',    // cancelled banner sub text
  unreadConvBorder: '#D5EFA0', // Innboks unread card ring
  onlineDot: '#2FBF62',    // chat header "Aktiv nå"
  okBorder: '#8FD3A6',     // accepted time card / offer
  onInk62: 'rgba(255,255,255,0.62)', // Jobbdag hero labels
  onInk55: 'rgba(255,255,255,0.55)',
  onInk07: 'rgba(255,255,255,0.07)',
  onInk10: 'rgba(255,255,255,0.1)',
  onInk16b: 'rgba(255,255,255,0.16)',
  limeHalf: 'rgba(184,238,60,0.5)',
  liveGreen: '#4FA81C',      // Jobbdag "I gang" dot
  stopBg: 'rgba(242,84,45,0.16)', stopBorder: 'rgba(242,84,45,0.35)', stopText: '#FFB39F',
  afterTag: 'rgba(59,115,0,0.78)',
  vacBorder: '#F5DDAE',      // Profil feriemodus banner
  vacText: '#7A4700',
  vippsIdBg: '#FFE6DC',      // Profil "Vipps-ID" verification chip
  vippsIdFg: '#C2410C',
  starOff: '#D8DCE3',        // empty review star
  dotIdle: '#C9CFD8',        // portfolio viewer dots
  lockChipText: '#B23A0E',   // Rediger profil "Fra Vipps" chip (bg vippsIdBg)
  bigOkRing: 'rgba(143,210,42,0.35)', // Fullføring check outline
  okBannerBorder: '#BFE5C9', // chat "Avtale inngått" banner
  okBannerText: '#2E5A3A',
  dateChipBg: 'rgba(10,23,64,0.06)', // chat day chip
  reactSel: 'rgba(25,184,238,0.35)', // selected bubble ring
  readTick: '#B8EE3C',     // read ticks on dark bubbles
  todayBg: '#F8FDEB',      // Mine avtaler week strip: today
  todayBorder: '#9BDD2C',
  dashedCardBg: 'rgba(255,255,255,0.6)',
  budgetBg: '#F2FBDF',     // Oppdragsdetaljer budget card
  mapBg: '#E7EEE2',        // approximate-area map
  mapWater: '#CFE6F3',
  mapPark: '#D4E8C4',
  areaFill: 'rgba(184,238,60,0.28)',
  areaBorder: '#8FD12A',
  galleryCap: 'rgba(10,23,64,0.62)', // gallery caption chip
  glassLight: 'rgba(255,255,255,0.85)', // gallery counter / save
  previewBorder: '#D5E9A8', // Gi tilbud preview card
  previewBg: '#F7FCEB',
  starTint: '#FFF4D6',     // Varsler review icon
  muteIcon: '#46506A',     // Varsler withdrawn icon / annet
  unreadBg: '#F1F9FE',     // Varsler unread row
  tagBg: '#F1F3F6',        // Varsler category tag
  barIdle: '#DADFE6',      // ForMeg counter bars
  barDone: '#B6BDCA',
  artDeco: 'rgba(255,255,255,0.35)', // decorative circles on big category art
  skillBg: 'rgba(255,255,255,0.8)',  // ForMeg skill chips
  stackBorder: 'rgba(10,23,64,0.05)', // ForMeg card border
  dashed: '#C9CFD9',       // photo-add / dash-card border, dots
  placeholder: '#8F97AA',
  verified: '#1B8F4E',
  typingDot: '#A3AABB',
  offerBorder: '#CDEB93',  // inline offer card in chat
  chipLimeBorder: '#BFE07F',
  chipCyanBorder: '#9FD5EF',
  white: '#FFFFFF',
  hairline: 'rgba(10,23,64,0.035)',
  navHairline: 'rgba(10,23,64,0.05)',
  iconBtnBg: 'rgba(255,255,255,0.9)',
  glassBg: 'rgba(255,255,255,0.82)',
  glassBorder: 'rgba(255,255,255,0.6)',
  navBg: 'rgba(255,255,255,0.93)',
  footBg: 'rgba(255,255,255,0.94)',
  onDark16: 'rgba(255,255,255,0.16)', // selected chip icon circle
  spinnerTrackDark: 'rgba(10,23,64,0.2)',
  spinnerTrackLight: 'rgba(255,255,255,0.3)',
  focusRing: 'rgba(25,184,238,0.16)',
  errorRing: 'rgba(194,48,41,0.1)',
  selectRing: 'rgba(10,23,64,0.08)',
  // chat offer card (Chat.dc.html .offer)
  offerCardBorder: '#C9E8F6',
  offerHeadBg: '#F1F8E3',
  offerAcceptedBorder: '#8FD3A6',
  offerDeclinedIcon: '#9AA2B3',
  caveatText: '#6E4300',
  // welcome (Main.dc.html)
  welcomeBlob: '#E6F4FB',
  accentBlue: '#1E86F4',
  // consent (Samtykke.dc.html)
  consentOnBorder: '#CDEBA0',
  consentOnBg: '#FBFEF4',
  limeSoft: '#EEF6E4',   // --grad-soft decorative circle
  // setup (Oppsett.dc.html)
  radarFill: 'rgba(184,238,60,0.14)',
  radarRing: 'rgba(184,238,60,0.35)',
  radarSweep: 'rgba(184,238,60,0.55)',
  onInk72: 'rgba(255,255,255,0.72)',
  onInk12: 'rgba(255,255,255,0.12)',
  confettiGreen: '#63E08A',
  confettiLime: '#C6F43C',
  // oppdrag home
  reachRingOn: 'rgba(184,238,60,0.28)',
  locButtonBg: 'rgba(255,255,255,0.85)',
  onInk78: 'rgba(255,255,255,0.78)',
  onInk14: 'rgba(255,255,255,0.14)',
  lavender: '#46379E',     // avatar d / Innboks + Personvern icon tiles
  lavenderTint: '#E8E3FB',
  // Vipps login sheet (LoggInn.dc.html)
  vippsTint: '#FFF1EB',
  vippsDeep: '#B53A0F',
  vippsRing: 'rgba(255,91,36,0.14)',
  vippsTrack: 'rgba(255,91,36,0.16)',
  // youth account (Ungdomskonto / OppdragUng)
  onInk82: 'rgba(255,255,255,0.82)',
  infoBorder: '#B6DFF2',
  // Legg ut wizard (LeggUt.dc.html)
  wizardHeaderBg: 'rgba(243,245,241,0.84)',
  suggestBorder: '#BFD6A0',
  photoClose: 'rgba(10,23,64,0.72)',
  mapGreen: '#E8F2E1',
  mapGrid: 'rgba(10,23,64,0.045)',
  mapLake: '#CFE8F6',
  mapZoneBorder: 'rgba(110,180,10,0.55)',
  dateErrBorder: '#E7A7A2',
  todOnBg: '#F6FCEA',
  offerInfoBorder: '#D3EE9C',
  wizardRing: 'rgba(184,238,60,0.3)',
  previewMap: '#EEF1EC',
  // Fellesskap
  heroBlobLime: 'rgba(184,238,60,0.35)',
  heroBlobCyan: 'rgba(25,184,238,0.18)',
  heroDash: 'rgba(10,23,64,0.16)',
  logoDash: '#BFC6D2',
  comingBg: 'rgba(255,255,255,0.5)',
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
  display34: { fontFamily: fonts.display, fontSize: 34, lineHeight: 35, letterSpacing: -1.19, color: colors.ink },
  num: { fontFamily: fonts.display, fontSize: 22, lineHeight: 24, letterSpacing: -0.44, color: colors.ink },
  brand: { fontFamily: fonts.displayHeavy, fontSize: 21, lineHeight: 21, letterSpacing: -0.63, color: colors.ink },
  buttonLg: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 17 },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 14, color: colors.cyanDeep },
  note: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17.5, color: colors.mute },
  subbarTitle: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 20.4, color: colors.ink },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 15.5, lineHeight: 20, color: colors.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17.5, color: colors.mute },
  metaBold: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 17.5, color: colors.ink },
  hint: { fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 15, color: colors.mute },
  help: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18.2, color: colors.mute },
  error: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 17, color: colors.danger },
  chipSm: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 13 },
  segment: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 14 },
  tab: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 15 },
  day: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 13 },
  kvLabel: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 19, color: colors.mute },
  kvValue: { fontFamily: fonts.bodyBold, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  bubble: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21.3 },
  time: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 14, color: colors.faint },
  system: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 16, color: colors.ink2 },
  toast: { fontFamily: fonts.bodySemi, fontSize: 14.5, lineHeight: 18.9, color: colors.white },
  toastAction: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 14, color: colors.lime },
  count: { fontFamily: fonts.bodyHeavy, fontSize: 11, lineHeight: 15, color: colors.white },
  pillLg: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 13, letterSpacing: 0.13 },
  verified: { fontFamily: fonts.bodyBold, fontSize: 12.5, lineHeight: 12.5 },
  stars: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 13, color: colors.ink },
  statLabel: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16, color: colors.mute },
  avatar: { fontFamily: fonts.bodyBold, letterSpacing: 0.28 },
  dialogTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 25, letterSpacing: -0.5, color: colors.ink },
  stateBody: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 19.6, color: colors.mute },
  offerTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: 17.6, letterSpacing: -0.16, color: colors.ink },
  offerPrice: { fontFamily: fonts.display, fontSize: 38, lineHeight: 38, letterSpacing: -1.33, color: colors.ink },
  fact: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 13 },
  offerDesc: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20.3, color: colors.ink2 },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 15, color: colors.mute },
  stepLabel: { fontFamily: fonts.bodyBold, fontSize: 12.5, lineHeight: 12.5 },
  stepNum: { fontFamily: fonts.display, fontSize: 14, lineHeight: 14 },
  consent: { fontFamily: fonts.bodySemi, fontSize: 15.5, lineHeight: 21.7, color: colors.ink },
  more: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 13, color: colors.mute },
  explain: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20.25, color: colors.ink2 },
  infoBox: { fontFamily: fonts.bodyMedium, fontSize: 13.5, lineHeight: 19.6, color: colors.cyanDeep },
  stamp: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 15, color: colors.okText },
  wizardTop: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 14, color: colors.mute },
  roleTitle: { fontFamily: fonts.display, fontSize: 17.5, lineHeight: 21, letterSpacing: -0.26, color: colors.ink },
  roleDesc: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18.9, color: colors.mute },
  counter: { fontFamily: fonts.bodySemi, fontSize: 12.5, lineHeight: 15, color: colors.faint },
  lockedField: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 20, color: colors.ink2 },
  locTitle: { fontFamily: fonts.bodyBold, fontSize: 16.5, lineHeight: 19.8, color: colors.white },
  locSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17.5, color: colors.onInk72 },
  okChip: { fontFamily: fonts.bodySemi, fontSize: 14.5, lineHeight: 18, color: colors.okText },
  optionName: { fontFamily: fonts.bodySemi, fontSize: 15.5, lineHeight: 20, color: colors.ink },
  orLine: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 13, color: colors.faint },
  tipBox: { fontFamily: fonts.bodySemi, fontSize: 13.5, lineHeight: 19.6, color: colors.limeDeep },
  celebrate: { fontFamily: fonts.display, fontSize: 38, lineHeight: 39, letterSpacing: -1.33, color: colors.ink },
  priceLabel: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 12, color: colors.mute },
} satisfies Record<string, TextStyle>;

// ---------------------------------------------------------------- layout
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const screenPadding = 20;           // horizontal gutter on every screen
export const safeTopExtra = 10;            // add to safe-area top inset under headers

export const radius = {
  s: 10, m: 16, card: 22, listingCard: 24, sheet: 32, dialog: 28,
  input: 17, thumb: 17, tile: 18, pill: 999,
  checkbox: 8, sectionIcon: 12, rowIcon: 13, day: 14, toast: 18, option: 20, nav: 30,
  stateTile: 26, bubble: 22, bubbleTail: 7,
} as const;

export const sizes = {
  button: 52, buttonSm: 40, buttonLg: 58,
  iconButton: 44, input: 56, amountInput: 76, chip: 42, chipSm: 36, pill: 26,
  search: 54, locationRow: 56, toggleW: 52, toggleH: 32, checkbox: 26, radio: 24,
  navHeight: 74, navBottom: 16, navSide: 12, fab: 62, fabLift: 30,
  listingThumbW: 96, listingThumbMinH: 118,
  minTouch: 44,
  buttonText: 44, saveButton: 38, rowIcon: 40, sectionIcon: 34, chipIcon: 30, count: 19, dot: 10,
  navItemW: 48, navItemH: 32, navIcon: 22, fabIcon: 26, toggleKnob: 26, rangeThumb: 28, rangeTrack: 6,
  day: 46, segment: 40, tab: 46, progress: 6, grabberW: 42, grabberH: 5, toastIcon: 28,
  stateIllW: 170, stateIllH: 150, stateTile: 80, rowMin: 60, amountSuffixRight: 16,
  multilineMin: 112, spacerNav: 128, spacerFoot: 140, headerTop: 10,
} as const;

export const avatarSizes = { 28: 28, 32: 32, 40: 40, 48: 48, 56: 56, 64: 64, 88: 88 } as const;

// ---------------------------------------------------------------- depth
// CSS box-shadow strings copied 1:1 from mn.css. React Native 0.76+ (new
// architecture) and react-native-web both render `boxShadow` natively,
// including spread and multiple layers, so iOS/Android/web look the same.
const sh = (css: string): ViewStyle => ({ boxShadow: css });

export const shadow = {
  card: sh('0 1px 2px rgba(10,23,64,.04), 0 8px 24px -10px rgba(10,23,64,.14)'),   // --sh
  medium: sh('0 2px 6px rgba(10,23,64,.05), 0 16px 36px -14px rgba(10,23,64,.22)'), // --sh-m
  stackFront: sh('0 2px 6px rgba(10,23,64,.05), 0 30px 60px -24px rgba(10,23,64,.35)'), // ForMeg .fcard
  large: sh('0 24px 60px -16px rgba(10,23,64,.34)'),                                // --sh-l (dialog, toast)
  nav: sh('0 18px 44px -14px rgba(10,23,64,.32), 0 0 0 1px rgba(10,23,64,.05)'),
  fab: sh('0 14px 26px -10px rgba(20,160,140,.75), 0 0 0 5px #fff'),
  sheet: sh('0 -10px 40px rgba(10,23,64,.12)'),
  btnLime: sh('0 10px 22px -10px rgba(110,180,10,.85)'),
  btnCyan: sh('0 10px 22px -10px rgba(8,101,158,.8)'),
  btnInk: sh('0 10px 22px -12px rgba(10,23,64,.8)'),
  btnVipps: sh('0 10px 22px -10px rgba(255,91,36,.8)'),
  segment: sh('0 2px 8px rgba(10,23,64,.12)'),
  knob: sh('0 2px 6px rgba(10,23,64,.25)'),
  thumb: sh('0 3px 10px rgba(10,23,64,.25)'),
  focus: sh('0 0 0 4px rgba(25,184,238,.16)'),
  error: sh('0 0 0 4px rgba(194,48,41,.1)'),
  selected: sh('0 0 0 3px rgba(10,23,64,.08)'),
  offerAccepted: sh('0 0 0 4px rgba(43,143,78,.12), 0 2px 6px rgba(10,23,64,.05), 0 16px 36px -14px rgba(10,23,64,.22)'),
  avatarRing: sh('0 0 0 2px #fff, 0 0 0 4px #19B8EE'),
  avatarRingSm: sh('0 0 0 1.5px #fff, 0 0 0 3px #19B8EE'),
  avatarRingLg: sh('0 0 0 3px #fff, 0 0 0 6px #19B8EE'),
  whiteRing2: sh('0 0 0 2px #fff'),
  unreadDot: sh('0 0 0 4px rgba(25,184,238,.16)'), // Varsler .udot
  whiteRing3: sh('0 0 0 3px rgba(255,255,255,.7)'), // pill on category art (ForMeg)
  drawnCheck: sh('0 0 0 12px #EDF8D6'),
  sendOn: sh('0 10px 22px -10px rgba(8,101,158,.8)'), // composer send button
  colOn: sh('0 0 0 4px rgba(184,238,60,.6), 0 2px 6px rgba(10,23,64,.05), 0 16px 36px -14px rgba(10,23,64,.22)'), // Sammenlign selected column
  unreadConv: sh('0 0 0 1.5px #D5EFA0, 0 1px 2px rgba(10,23,64,.04), 0 8px 24px -10px rgba(10,23,64,.14)'), // Innboks unread card
  okBanner: sh('0 12px 26px -16px rgba(43,143,78,.6)'), // chat agreement banner
  reactSel: sh('0 0 0 3px rgba(25,184,238,.35)'), // selected bubble
  bigOk: sh('0 26px 50px -18px rgba(60,160,60,.65)'), // Fullføring big check
  starOn: sh('0 10px 22px -12px rgba(240,165,0,.8)'), // Vurdering selected star
  starBadge: sh('0 26px 50px -18px rgba(240,165,0,.7)'), // Vurdering done badge
  hero: sh('0 26px 50px -24px rgba(10,23,64,.7)'), // Jobbdag timer card
  okRing: sh('0 20px 40px -16px rgba(40,170,120,.7)'), // Gi tilbud sent check
  roleNeedOn: sh('0 0 0 4px rgba(184,238,60,.3), 0 1px 2px rgba(10,23,64,.04), 0 8px 24px -10px rgba(10,23,64,.14)'),
  roleOfferOn: sh('0 0 0 4px rgba(25,184,238,.18), 0 1px 2px rgba(10,23,64,.04), 0 8px 24px -10px rgba(10,23,64,.14)'),
  roleBothOn: sh('0 0 0 4px rgba(99,224,138,.2), 0 1px 2px rgba(10,23,64,.04), 0 8px 24px -10px rgba(10,23,64,.14)'),
  locCard: sh('0 16px 30px -16px rgba(10,23,64,.7)'),
  photoRing: sh('0 0 0 4px #fff, 0 0 0 6px #19B8EE, 0 18px 36px -14px rgba(10,23,64,.4)'),
  radarDot: sh('0 0 0 4px rgba(184,238,60,.3)'),
  stepCurrent: sh('0 0 0 5px rgba(10,23,64,.1)'),
  heroCore: sh('0 24px 44px -18px rgba(10,23,64,.4)'),
  stepBtn: sh('0 1px 3px rgba(10,23,64,.12)'),
  errorOutline: sh('0 0 0 2px rgba(194,48,41,.35)'),
  whiteRing4: sh('0 0 0 4px #fff'),
  okBadge: sh('0 0 0 10px #E3F5E8, 0 18px 36px -12px rgba(43,143,78,.6)'),
  loginLogo: sh('0 26px 50px -20px rgba(10,23,64,.35), 0 0 0 1px rgba(10,23,64,.04)'),
  phoneMock: sh('0 20px 34px -14px rgba(10,23,64,.5)'),
  youthAvatar: sh('0 0 0 3px #0A1740, 0 0 0 5px #B8EE3C'),
  limeRing10: sh('0 0 0 10px #EDF8D6'),
  logoTile: sh('0 30px 60px -20px rgba(10,23,64,.35)'),
  none: { boxShadow: 'none' } as ViewStyle,
} as const;

// ---------------------------------------------------------------- motion (react-native-reanimated)
export const motion = {
  // CSS cubic-bezier(.2,.8,.2,1)  -> Easing.bezier(0.2, 0.8, 0.2, 1)
  ease: [0.2, 0.8, 0.2, 1] as const,
  // CSS cubic-bezier(.3,1.45,.5,1) springy overshoot -> withSpring(config below)
  spring: { damping: 14, stiffness: 220, mass: 0.9 },
  durations: {
    press: 150,       // :active scale transitions
    fade: 250,        // scrim fade, colour transitions
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
