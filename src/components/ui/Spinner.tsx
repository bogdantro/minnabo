import { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/theme';

export type SpinnerProps = {
  size?: number;
  /** Colour of the moving arc. */
  color?: string;
  /** Colour of the faint ring behind it. */
  trackColor?: string;
  thickness?: number;
};

/** `.spin` ring from the design: faint circle + one coloured quarter, 1 s linear. */
export function Spinner({
  size = 18,
  color = colors.ink,
  trackColor = colors.spinnerTrackDark,
  thickness = 2.5,
}: SpinnerProps) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rot);
  }, [rot]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: trackColor,
          borderTopColor: color,
        },
        style,
      ]}
    />
  );
}
