import { forwardRef } from 'react';
import { Pressable, type PressableProps, type View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { motion } from '@/theme/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  /** Scale while pressed (CSS `:active{transform:scale(x)}`). */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pressable that shrinks while held, 150 ms on the design ease curve —
 * the RN version of `.btn:active`, `.chip:active`, `.lcard:active` etc.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { scaleTo = 0.97, style, onPressIn, onPressOut, disabled, ...rest },
  ref,
) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const timing = { duration: motion.durations.press, easing: Easing.bezier(...motion.ease) };

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withTiming(scaleTo, timing);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, timing);
        onPressOut?.(e);
      }}
      style={[style, anim]}
      {...rest}
    />
  );
});
