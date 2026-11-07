import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * MinNabo's graphics, in the language of the base design (hero on Fellesskap, Velkommen): soft
 * overlapping blobs, a dashed ring, a white disc with a lime badge in the middle, ring-framed
 * discs and tilted chips around it, a few small dots. Flat colours only, every colour from the theme.
 */
type Tone = 'soft' | 'ink' | 'blue';
type Spot = { left?: number | `${number}%`; right?: number | `${number}%`; top: number };
type Disc = Spot & { icon: IconName; size?: number; bg: string; fg: string };
type Chip = Spot & { label: string; icon?: IconName; rotate: number; dark?: boolean };
type Dot = Spot & { size: number; color: string };

const TONES: Record<Tone, { bg: string; blobA: string; blobB: string; ring: string }> = {
  soft: { bg: colors.limeSoft, blobA: colors.heroBlobLime, blobB: colors.heroBlobCyan, ring: colors.dashed },
  ink: { bg: colors.ink, blobA: colors.onInk08, blobB: colors.onInk10, ring: colors.onInk16b },
  blue: { bg: colors.cyan2, blobA: colors.onInk10, blobB: colors.onInk16b, ring: colors.onInk55 },
};

/** The slow up-and-down from the Fellesskap hero. Still when the phone asks for reduced motion. */
function Float({ period, children }: { period: number; children: ReactNode }) {
  const y = useSharedValue(0);
  const still = useReducedMotion();
  useEffect(() => {
    if (still) return;
    y.set(withRepeat(withTiming(-5, { duration: period / 2, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => cancelAnimation(y);
  }, [period, still, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function RingDisc({ icon, size = 44, bg, fg, ...spot }: Disc) {
  return (
    <View style={[styles.spot, spot]}>
      <Float period={5000 + size * 20}>
        <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}>
          <View style={[styles.discIn, { backgroundColor: bg }]}>
            <Icon name={icon} size={Math.round(size * 0.44)} color={fg} />
          </View>
        </View>
      </Float>
    </View>
  );
}

function TiltChip({ label, icon, rotate, dark, ...spot }: Chip) {
  return (
    <View style={[styles.spot, spot, { transform: [{ rotate: `${rotate}deg` }] }]}>
      <View style={[styles.chip, shadow.card, dark && styles.chipDark]}>
        {icon ? (
          <View style={styles.chipIcon}>
            <Icon name={icon} size={11} color={colors.white} strokeWidth={3} />
          </View>
        ) : null}
        <Text style={[styles.chipText, dark && styles.chipTextDark]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** The whole composition. `core` is the icon in the middle. */
function Orbit({
  tone = 'soft',
  core,
  coreSize = 92,
  discs = [],
  chips = [],
  dots = [],
  style,
}: {
  tone?: Tone;
  core: IconName;
  coreSize?: number;
  discs?: Disc[];
  chips?: Chip[];
  dots?: Dot[];
  style?: StyleProp<ViewStyle>;
}) {
  const t = TONES[tone];
  const badge = Math.round(coreSize * 0.56);
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: t.bg }, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.blob, styles.blobLeft, tone === 'ink' && styles.blobHigh, { backgroundColor: t.blobA }]} />
      <View style={[styles.blob, styles.blobRight, tone === 'ink' && styles.blobHigh, { backgroundColor: t.blobB }]} />
      <View style={[styles.centre, { top: '50%', marginTop: -86 }]}>
        <View style={[styles.ring, { borderColor: t.ring }]} />
      </View>
      <View style={[styles.centre, { top: '50%', marginTop: -coreSize / 2 }]}>
        <View style={[styles.core, shadow.heroCore, { width: coreSize, height: coreSize, borderRadius: coreSize / 2 }]}>
          <Float period={5000}>
            <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2 }]}>
              <Icon name={core} size={Math.round(badge * 0.5)} color={colors.ink} />
            </View>
          </Float>
        </View>
      </View>
      {dots.map((d, i) => (
        <View key={i} style={[styles.spot, { left: d.left, right: d.right, top: d.top, width: d.size, height: d.size, borderRadius: d.size / 2, backgroundColor: d.color }]} />
      ))}
      {discs.map((d) => (
        <RingDisc key={String(d.icon)} {...d} />
      ))}
      {chips.map((c) => (
        <TiltChip key={c.label} {...c} />
      ))}
    </View>
  );
}

const SMALL_DOTS: Dot[] = [
  { left: '6%', top: 112, size: 10, color: colors.lime },
  { right: '34%', top: 18, size: 8, color: colors.accentBlue },
  { left: '34%', top: 30, size: 6, color: colors.confettiGreen },
];

/** Cover of Oppslagstavla. */
export function BoardArt({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Orbit
      style={style}
      core="pinned"
      dots={SMALL_DOTS}
      discs={[
        { icon: 'gift', left: '9%', top: 26, size: 50, bg: colors.okTint, fg: colors.okText },
        { icon: 'users', left: '25%', top: 84, size: 42, bg: colors.limeTint, fg: colors.limeDeep },
        { icon: 'key', right: '10%', top: 22, size: 50, bg: colors.warnTint, fg: colors.warn },
        { icon: 'montering', right: '24%', top: 84, size: 42, bg: colors.lavenderTint, fg: colors.lavender },
      ]}
    />
  );
}

/** «Bli partner» on its dark card. */
export function PartnerArt({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Orbit
      tone="ink"
      style={style}
      core="building"
      dots={[
        { left: '7%', top: 104, size: 9, color: colors.lime },
        { right: '30%', top: 16, size: 7, color: colors.cyan },
      ]}
      discs={[
        { icon: 'users', left: '11%', top: 30, size: 48, bg: colors.cyanTint, fg: colors.cyanDeep },
        { icon: 'heart', right: '11%', top: 26, size: 48, bg: colors.savedBg, fg: colors.heart },
        { icon: 'star', right: '25%', top: 92, size: 40, bg: colors.warnTint, fg: colors.warn },
      ]}
    />
  );
}

/** Top of /ung. */
export function YouthArt({ chips, style }: { chips: [string, string]; style?: StyleProp<ViewStyle> }) {
  return (
    <Orbit
      style={style}
      core="hand"
      coreSize={84}
      dots={SMALL_DOTS}
      discs={[
        { icon: 'hage', left: '8%', top: 20, size: 48, bg: colors.limeTint, fg: colors.limeDeep },
        { icon: 'dyrepass', right: '8%', top: 16, size: 48, bg: colors.warnTint, fg: colors.warn },
      ]}
      chips={[
        { label: chips[0], icon: 'check', left: '5%', top: 98, rotate: 4 },
        { label: chips[1], right: '5%', top: 92, rotate: -3, dark: true },
      ]}
    />
  );
}

/** Behind the blue «Tilby hjelp» card: the blobs run off the edge, the disc sits to the right of the words. */
export function HelperArt() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.blob, styles.helpA]} />
      <View style={[styles.blob, styles.helpB]} />
      <View style={[styles.spot, styles.helpRing]} />
      <View style={[styles.spot, styles.helpDotA]} />
      <View style={[styles.spot, styles.helpDotB]} />
      <View style={[styles.spot, styles.helpCore, shadow.heroCore]}>
        <Float period={5000}>
          <View style={[styles.badge, styles.helpBadge]}>
            <Icon name="hand" size={21} color={colors.ink} />
          </View>
        </Float>
      </View>
    </View>
  );
}

/** Top of Hjelp: a question in the middle, the four topics around it. */
export function HelpArt({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Orbit
      style={style}
      core="msg"
      coreSize={80}
      dots={SMALL_DOTS}
      discs={[
        { icon: 'sparkle', left: '9%', top: 22, size: 46, bg: colors.limeTint, fg: colors.limeDeep },
        { icon: 'clip', left: '22%', top: 92, size: 40, bg: colors.cyanTint, fg: colors.cyanDeep },
        { icon: 'shield', right: '9%', top: 20, size: 46, bg: colors.okTint, fg: colors.okText },
        { icon: 'user', right: '22%', top: 92, size: 40, bg: colors.lavenderTint, fg: colors.lavender },
      ]}
    />
  );
}

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

export const seasonOf = (d: Date): Season => {
  const m = d.getMonth();
  // November counts as winter: it is when people here start asking for snow clearing
  if (m >= 10 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
};

/** The small dots take the season's colour: snow, spring green, summer sun, autumn leaves. */
const SEASON_DOTS: Record<Season, [string, string]> = {
  winter: [colors.white, colors.cyan],
  spring: [colors.lime, colors.white],
  summer: [colors.star, colors.white],
  autumn: [colors.star, colors.notifDot],
};

/** Top of a seasonal card: the category's tile, with the same blobs and its icon on a white disc. */
export function SeasonArt({ season, icon, bg, fg }: { season: Season; icon: IconName; bg: string; fg: string }) {
  const [a, b] = SEASON_DOTS[season];
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: bg }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.seasonBlob, styles.seasonLeft, { backgroundColor: fg }]} />
      <View style={[styles.seasonBlob, styles.seasonRight, { backgroundColor: colors.white }]} />
      {([[14, 16, 9, a], [44, 54, 6, b], [122, 14, 7, b], [138, 56, 9, a]] as const).map(([left, top, size, color]) => (
        <View key={`${left}`} style={[styles.spot, { left, top, width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />
      ))}
      <View style={styles.centreFill}>
        <View style={[styles.seasonDisc, shadow.card]}>
          <Icon name={icon} size={26} color={fg} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  helpA: { right: -40, top: -34, width: 190, height: 190, backgroundColor: colors.onInk10 },
  helpB: { right: -66, top: 40, width: 170, height: 170, backgroundColor: colors.onInk10 },
  helpRing: { right: 2, top: 11, width: 116, height: 116, borderRadius: 58, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.onInk55 },
  helpDotA: { right: 112, top: 24, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.lime },
  helpDotB: { right: 12, top: 112, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.white },
  helpCore: { right: 24, top: 33, width: 72, height: 72, borderRadius: 36, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  helpBadge: { width: 42, height: 42, borderRadius: 21 },
  spot: { position: 'absolute' },
  blob: { position: 'absolute', borderRadius: 999 },
  blobLeft: { left: '-6%', top: 16, width: 190, height: 190 },
  blobRight: { right: '-10%', top: 6, width: 210, height: 210 },
  // on the dark card the art runs straight into the text: no blob may end in a hard line there
  blobHigh: { top: -80 },
  centre: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  centreFill: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 172, height: 172, borderRadius: 86, borderWidth: 1.5, borderStyle: 'dashed' },
  core: { backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  badge: { backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  disc: { padding: 2, borderWidth: 2, borderColor: colors.cyan, backgroundColor: colors.white },
  discIn: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  chipDark: { backgroundColor: colors.ink },
  chipIcon: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: text.label.fontFamily, fontSize: 12.5, color: colors.okText },
  chipTextDark: { color: colors.white },
  seasonBlob: { position: 'absolute', borderRadius: 999, opacity: 0.16 },
  seasonLeft: { left: -34, top: 26, width: 110, height: 110 },
  seasonRight: { right: -28, top: -36, width: 120, height: 120, opacity: 0.4 },
  seasonDisc: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
});
