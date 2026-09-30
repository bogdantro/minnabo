import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors, motion, shadow } from '@/theme/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type DrawnCheckProps = {
  /** Circle diameter (104–120 in the design). */
  size?: number;
  /** Replay key – change it to draw again. */
  playKey?: number;
};

/**
 * Lime circle with a 10–12 px lime-tint ring; the ink tick draws itself
 * (strokeDashoffset 60 → 0 over 600 ms after 250 ms). Circle scales in with a spring.
 */
export function DrawnCheck({ size = 120, playKey = 0 }: DrawnCheckProps) {
  const offset = useSharedValue(60);
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    offset.value = 60;
    scale.value = 0.6;
    opacity.value = 0;
    scale.value = withSpring(1, motion.spring);
    opacity.value = withTiming(1, { duration: 250 });
    offset.value = withDelay(
      250,
      withTiming(0, { duration: motion.durations.checkDraw, easing: Easing.bezier(...motion.ease) }),
    );
  }, [playKey, offset, scale, opacity]);

  const circle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const pathProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  const icon = Math.round(size * 0.47);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        shadow.drawnCheck,
        circle,
      ]}
    >
      <Svg width={icon} height={icon} viewBox="0 0 24 24" fill="none">
        <AnimatedPath
          d="M5 12.5 10 17.5 19.5 7"
          stroke={colors.ink}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={60}
          animatedProps={pathProps}
        />
      </Svg>
    </Animated.View>
  );
}

const CONFETTI_COLORS = [colors.lime, colors.cyan, colors.ink, colors.star];

function Piece({ left, delay, color, fall, playKey }: { left: number; delay: number; color: string; fall: number; playKey: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withDelay(delay, withTiming(1, { duration: 2400, easing: Easing.in(Easing.quad) }));
  }, [playKey, delay, t]);
  const anim = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateY: -20 + t.value * (fall + 20) }, { rotate: `${t.value * 540}deg` }],
  }));
  return <Animated.View style={[styles.piece, { left, backgroundColor: color }, anim]} />;
}

/** Small rectangles (default: 7 in lime, cyan, ink, star) falling 520 px with rotation over 2.4 s. */
export function Confetti({
  playKey = 0,
  count = 7,
  colors: palette = CONFETTI_COLORS,
}: {
  playKey?: number;
  count?: number;
  colors?: readonly string[];
}) {
  const { width } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        left: ((i + 0.5) / count) * width + ((i % 2 ? 1 : -1) * width) / (count * 4),
        delay: (i % 4) * 120,
        color: palette[i % palette.length],
      })),
    [count, width, palette],
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      {pieces.map((p, i) => (
        <Piece key={i} {...p} fall={520} playKey={playKey} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  piece: { position: 'absolute', top: 0, width: 8, height: 14, borderRadius: 2 },
});
