import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, motion, radius, sizes, text } from '@/theme/theme';
import { Icon } from './Icon';

export type DayChip = { key: string; label: string; sub?: string };

export type DayChipsProps = {
  days: DayChip[];
  selected: string[];
  onToggle: (key: string) => void;
  /** Stretch to fill the row (Man–Søn) instead of a scrolling list. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** `.day` – day / time chips, radius 14; selected = ink with white text. */
export function DayChips({ days, selected, onToggle, fill = true, style }: DayChipsProps) {
  return (
    <View style={[styles.dayrow, style]}>
      {days.map((d) => {
        const on = selected.includes(d.key);
        return (
          <Pressable
            key={d.key}
            accessibilityRole="button"
            accessibilityLabel={d.sub ? `${d.label} ${d.sub}` : d.label}
            accessibilityState={{ selected: on }}
            onPress={() => onToggle(d.key)}
            style={[styles.day, fill ? styles.dayFill : styles.dayFree, on && styles.dayOn]}
          >
            <Text style={[text.day, { color: on ? colors.white : colors.ink2 }]}>{d.label}</Text>
            {d.sub ? <Text style={[text.meta, { color: on ? colors.white : colors.mute }]}>{d.sub}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export type StepProgressProps = {
  step: number;
  total: number;
  /** Right-hand label (current step name). */
  stepName?: string;
  /** Show "Steg x av y" row (default true). */
  showLabel?: boolean;
};

/** `.prog` – "Steg 3 av 9" + 6 px lime bar that animates its width over 500 ms. */
export function StepProgress({ step, total, stepName, showLabel = true }: StepProgressProps) {
  const p = useSharedValue(step / total);
  useEffect(() => {
    p.value = withTiming(step / total, { duration: 500, easing: Easing.bezier(...motion.ease) });
  }, [step, total, p]);
  const bar = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View
      style={styles.progWrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Steg ${step} av ${total}${stepName ? `, ${stepName}` : ''}`}
      accessibilityValue={{ min: 0, max: total, now: step }}
    >
      {showLabel ? (
        <View style={styles.progLabel}>
          <Text style={text.metaBold}>
            Steg {step} av {total}
          </Text>
          {stepName ? <Text style={text.meta}>{stepName}</Text> : null}
        </View>
      ) : null}
      <View style={styles.prog}>
        <Animated.View style={[styles.progFill, bar]} />
      </View>
    </View>
  );
}

export type PhotoAddTileProps = {
  onPress: () => void;
  size?: number;
  label?: string;
};

/** `.photo-add` – dashed "Legg til bilde" tile. */
export function PhotoAddTile({ onPress, size = 72, label = 'Legg til' }: PhotoAddTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Legg til bilde"
      onPress={onPress}
      style={[styles.photo, { width: size, height: size }]}
    >
      <Icon name="camera" size={22} color={colors.mute} />
      <Text style={[text.chipSm, { color: colors.mute }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dayrow: { flexDirection: 'row', gap: 6 },
  day: {
    height: sizes.day,
    borderRadius: radius.day,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayFill: { flex: 1 },
  dayFree: { paddingHorizontal: 14 },
  dayOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  progWrap: { gap: 8 },
  progLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  prog: {
    height: sizes.progress,
    borderRadius: sizes.progress / 2,
    backgroundColor: colors.progressTrack,
    overflow: 'hidden',
  },
  progFill: { height: '100%', borderRadius: sizes.progress / 2, backgroundColor: colors.lime },
  photo: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: radius.tile,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
