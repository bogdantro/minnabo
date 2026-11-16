import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { colors, fonts, radius, shadow } from '@/theme/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

const ART = 60;
const DISC = 40;
const POINTER = 16;

/**
 * The little picture on the left, on ink: a soft blob, the base design's dashed lime ring and a lime disc with the icon.
 * The disc shows the gesture the tip is about: a soft «tap» pulse, or a sideways swipe.
 * Still when the phone asks for reduced motion.
 */
function TipArt({ icon, motion }: { icon: IconName; motion: 'tap' | 'swipe' }) {
  const t = useSharedValue(0);
  useEffect(() => {
    const ease = Easing.inOut(Easing.quad);
    t.set(
      withDelay(
        900,
        withRepeat(
          motion === 'swipe'
            ? withSequence(withTiming(1, { duration: 520, easing: ease }), withTiming(-1, { duration: 720, easing: ease }), withTiming(0, { duration: 520, easing: ease }), withTiming(0, { duration: 900 }))
            : withSequence(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 }), withTiming(0, { duration: 700 })),
          -1,
          false,
          undefined,
          ReduceMotion.System,
        ),
        ReduceMotion.System,
      ),
    );
  }, [motion, t]);

  const disc = useAnimatedStyle(() =>
    motion === 'swipe'
      ? { transform: [{ translateX: t.get() * 7 }, { rotate: `${t.get() * 8}deg` }] }
      : { transform: [{ scale: 1 - Math.sin(t.get() * Math.PI) * 0.07 }] },
  );
  // the ripple only belongs to «tap»
  const ripple = useAnimatedStyle(() => ({
    opacity: motion === 'tap' ? (1 - t.get()) * 0.9 : 0,
    transform: [{ scale: 1 + t.get() * 0.45 }],
  }));

  return (
    <View style={styles.art} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.blob} />
      <View style={styles.ring} />
      <Animated.View style={[styles.ripple, ripple]} />
      <Animated.View style={[styles.disc, disc]}>
        <Icon name={icon} size={19} color={colors.ink} />
      </Animated.View>
      <View style={[styles.dot, styles.dotCyan]} />
      <View style={[styles.dot, styles.dotLime]} />
    </View>
  );
}

/**
 * A first-time tip (shown once, see lib/onceTips), redesigned 2026-11-14: an ink coach card that stands apart from
 * the white cards around it – the art on the left, a lime «TIPS» eyebrow, a white title and a soft line, then,
 * for a gesture, what each way does («← Hopp over» · «Lagre →»), and a lime «Skjønner».
 * The caller places it and decides where the little pointer goes.
 */
export function CoachTip({
  icon,
  title,
  body,
  okLabel,
  onDone,
  motion = 'tap',
  hints,
  pointer = 'down',
  pointerAt = '50%',
  style,
  testID,
}: {
  icon: IconName;
  title: string;
  body: string;
  okLabel: string;
  onDone: () => void;
  /** the gesture the picture shows */
  motion?: 'tap' | 'swipe';
  /** for a swipe: what each direction does, shown as two keys */
  hints?: { left: string; right: string };
  /** which side the pointer sits on */
  pointer?: 'down' | 'up' | 'none';
  /** where along that side, e.g. '50%' or 40 */
  pointerAt?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(400).springify().damping(16)}
      exiting={FadeOut.duration(160)}
      style={[styles.wrap, style]}
      accessibilityRole="alert"
      testID={testID}
    >
      <View style={[styles.card, shadow.large]}>
        {/* a quiet circle in the corner, the base design's shapes on ink */}
        <View style={styles.cornerBlob} />
        <View style={styles.top}>
          <TipArt icon={icon} motion={motion} />
          <View style={styles.body}>
            <Text style={styles.eyebrow}>{nb.tips.eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.text}>{body}</Text>
          </View>
        </View>

        <View style={styles.bottom}>
          {hints ? (
            <View style={styles.keys} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <View style={styles.key}>
                <Icon name="left" size={13} color={colors.onInk72} />
                <Text style={styles.keyText}>{hints.left}</Text>
              </View>
              <View style={[styles.key, styles.keyOn]}>
                <Text style={[styles.keyText, styles.keyTextOn]}>{hints.right}</Text>
                <Icon name="right" size={13} color={colors.ink} />
              </View>
            </View>
          ) : (
            <View style={styles.flex} />
          )}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${okLabel}: ${title}`}
            onPress={onDone}
            scaleTo={0.94}
            style={styles.ok}
          >
            <Icon name="check" size={15} color={colors.ink} />
            <Text style={styles.okText}>{okLabel}</Text>
          </PressableScale>
        </View>
      </View>
      {pointer !== 'none' ? <View style={[styles.pointer, pointer === 'up' ? styles.pointerUp : styles.pointerDown, { left: pointerAt }]} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 40 },
  flex: { flex: 1 },
  card: { padding: 16, gap: 14, borderRadius: radius.listingCard, backgroundColor: colors.ink, overflow: 'hidden' },
  cornerBlob: { position: 'absolute', right: -40, top: -46, width: 130, height: 130, borderRadius: 65, backgroundColor: colors.onInk07 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  art: { width: ART, height: ART, alignItems: 'center', justifyContent: 'center' },
  blob: { position: 'absolute', width: ART, height: ART, borderRadius: ART / 2, backgroundColor: colors.onInk08 },
  ring: {
    position: 'absolute',
    width: ART - 6,
    height: ART - 6,
    borderRadius: (ART - 6) / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lime,
  },
  ripple: { position: 'absolute', width: DISC, height: DISC, borderRadius: DISC / 2, borderWidth: 2, borderColor: colors.lime },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', borderRadius: 99 },
  dotCyan: { width: 8, height: 8, top: 1, right: 0, backgroundColor: colors.cyan },
  dotLime: { width: 6, height: 6, bottom: 3, left: 1, backgroundColor: colors.lime },
  body: { flex: 1, minWidth: 0, gap: 3 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.lime },
  title: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23, color: colors.white },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.onInk72 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  keys: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.onInk10 },
  keyOn: { backgroundColor: colors.limeTint },
  keyText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.onInk86 },
  keyTextOn: { color: colors.ink },
  ok: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.lime },
  okText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  // an ink square turned 45°
  pointer: {
    position: 'absolute',
    width: POINTER,
    height: POINTER,
    marginLeft: -POINTER / 2,
    backgroundColor: colors.ink,
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
  },
  pointerDown: { bottom: -POINTER / 2 + 1 },
  pointerUp: { top: -POINTER / 2 + 1 },
});
