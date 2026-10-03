import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, motion } from '@/theme/theme';

/** `.bar` – grey track with a fill that grows in (`growW`, 1 s). `fill` is 0–1. */
export function GrowBar({ fill, color = colors.ink, height = 8, style }: { fill: number; color?: string; height?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? fill : 0);
  useEffect(() => {
    if (reduced) {
      p.set(fill);
      return;
    }
    p.set(withTiming(fill, { duration: 1000, easing: Easing.bezier(...motion.ease) }));
  }, [fill, reduced, p]);
  const grow = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, p.value)) * 100}%` }));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }, style]}>
      <Animated.View style={[styles.fill, { backgroundColor: color, borderRadius: height / 2 }, grow]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%' },
});
