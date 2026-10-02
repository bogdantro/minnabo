import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion, radius, shadow, sizes } from '@/theme/theme';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type ToggleProps = {
  value: boolean;
  onValueChange: (v: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  /** sm = 44×26 (Varsler "Bare uleste"). */
  size?: 'md' | 'sm';
  testID?: string;
};

/** `.tgl` – 52×32 switch; knob springs 20 px, track fades grey → green. */
export function Toggle({ value, onValueChange, accessibilityLabel, disabled, size = 'md', testID }: ToggleProps) {
  const sm = size === 'sm';
  const travel = sm ? 18 : 20;
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(value ? 1 : 0, motion.spring);
  }, [value, p]);
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(Math.min(Math.max(p.value, 0), 1), [0, 1], [colors.toggleOff, colors.toggleOn]),
  }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * travel }] }));

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => onValueChange(!value)}
      style={disabled ? styles.disabled : null}
    >
      <Animated.View style={[styles.track, sm && styles.trackSm, track]}>
        <Animated.View style={[styles.knob, sm && styles.knobSm, shadow.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

export type CheckboxProps = {
  checked: boolean;
  onChange?: (v: boolean) => void;
  /** Omit when the checkbox sits inside a pressable row that owns the label. */
  accessibilityLabel?: string;
};

/** `.chk` – 26 square; checked = ink with a lime tick that pops in. */
export function Checkbox({ checked, onChange, accessibilityLabel }: CheckboxProps) {
  const s = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    s.value = checked
      ? withSequence(withTiming(1.15, { duration: 210 }), withTiming(1, { duration: 90 }))
      : withTiming(0, { duration: 120 });
  }, [checked, s]);
  const tick = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const box = (
    <View style={[styles.chk, checked && styles.chkOn]}>
      <Animated.View style={tick}>
        <Icon name="check" size={16} color={colors.lime} strokeWidth={3} />
      </Animated.View>
    </View>
  );
  if (!onChange) return box;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}
      hitSlop={9}
      onPress={() => onChange(!checked)}
    >
      {box}
    </Pressable>
  );
}

/** `.rad` – 24 circle; selected = 7 px ink border. Presentational (row owns the press). */
export function Radio({ selected }: { selected: boolean }) {
  return <View style={[styles.rad, selected && styles.radOn]} />;
}

export type OptionCardProps = {
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
  /** checkbox = multi-select semantics, radio = single (default). */
  role?: 'radio' | 'checkbox';
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** `.optcard` – selectable row card; selected = ink border + soft ring. Press 98.5 %. */
export function OptionCard({ selected, onPress, children, role = 'radio', accessibilityLabel, style, testID }: OptionCardProps) {
  return (
    <PressableScale
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      scaleTo={0.985}
      style={[styles.opt, selected && styles.optOn, style]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.38 },
  track: { width: sizes.toggleW, height: sizes.toggleH, borderRadius: sizes.toggleH / 2, padding: 3 },
  trackSm: { width: 44, height: 26, borderRadius: 13 },
  knobSm: { width: 20, height: 20, borderRadius: 10 },
  knob: {
    width: sizes.toggleKnob,
    height: sizes.toggleKnob,
    borderRadius: sizes.toggleKnob / 2,
    backgroundColor: colors.white,
  },
  chk: {
    width: sizes.checkbox,
    height: sizes.checkbox,
    borderRadius: radius.checkbox,
    borderWidth: 2,
    borderColor: colors.control,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chkOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  rad: {
    width: sizes.radio,
    height: sizes.radio,
    borderRadius: sizes.radio / 2,
    borderWidth: 2,
    borderColor: colors.control,
    backgroundColor: colors.white,
  },
  radOn: { borderColor: colors.ink, borderWidth: 7 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.option,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  optOn: { borderColor: colors.ink, ...shadow.selected },
});
