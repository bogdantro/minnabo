import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@/theme/theme';

/**
 * Entrance animations from mn.css (`.au`, `.ai`, `.as`) driven by shared values.
 * They animate only opacity/transform, so layout is never affected (Reanimated's
 * layout `entering` animations can leave views absolutely positioned on web).
 * Respect "reduce motion": content just appears.
 *
 * `delay` follows the design's `.dN` classes: d1 = 50 ms … d8 = 400, d9 = 500, d10 = 600.
 */
type MotionProps = {
  children?: ReactNode;
  delay?: number;
  /** Change to replay the animation (e.g. slide index). */
  playKey?: string | number;
  style?: StyleProp<ViewStyle>;
};

const ease = Easing.bezier(...motion.ease);

/** `.au` – fade up 16 px over 550 ms. */
export function FadeUp({ children, delay = 0, playKey, style }: MotionProps) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    p.set(0);
    p.set(withDelay(delay, withTiming(1, { duration: motion.durations.fadeUp, easing: ease })));
  }, [delay, playKey, reduced, p]);
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * motion.fadeUpDistance }],
  }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** `.ai` – fade in over 500 ms. */
export function FadeInView({ children, delay = 0, playKey, style }: MotionProps) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    p.set(0);
    p.set(withDelay(delay, withTiming(1, { duration: 500 })));
  }, [delay, playKey, reduced, p]);
  const anim = useAnimatedStyle(() => ({ opacity: p.value }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** `.as` – scale in from .6 with the design spring. */
export function ScaleIn({ children, delay = 0, playKey, style }: MotionProps) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    p.set(0);
    p.set(withDelay(delay, withSpring(1, motion.spring)));
  }, [delay, playKey, reduced, p]);
  const anim = useAnimatedStyle(() => ({
    opacity: Math.min(p.value * 2, 1),
    transform: [{ scale: 0.6 + 0.4 * p.value }],
  }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
