import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';
import { colors, shadow, sizes } from '@/theme/theme';

export type RangeSliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  accessibilityLabel: string;
  /** Spoken value, e.g. "10 km". */
  formatValue?: (v: number) => string;
};

const THUMB = sizes.rangeThumb;

/** `.range` – 6 px track filled ink up to the thumb; 28 px white thumb, 3 px ink border. */
export function RangeSlider({ value, min, max, step = 1, onChange, accessibilityLabel, formatValue }: RangeSliderProps) {
  const [width, setWidth] = useState(0);
  const usable = Math.max(width - THUMB, 1);
  const pct = (value - min) / (max - min);

  const valueAt = (x: number) => {
    const p = Math.min(Math.max((x - THUMB / 2) / usable, 0), 1);
    const raw = min + p * (max - min);
    return Math.min(max, Math.max(min, Math.round(raw / step) * step));
  };
  const set = (x: number) => {
    const v = valueAt(x);
    if (v !== value) onChange(v);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(set)(e.x))
    .onUpdate((e) => runOnJS(set)(e.x));

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={styles.hit}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min, max, now: value, text: formatValue?.(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const next = e.nativeEvent.actionName === 'increment' ? value + step : value - step;
          onChange(Math.min(max, Math.max(min, next)));
        }}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: THUMB / 2 + pct * usable }]} />
        </View>
        <View style={[styles.thumb, shadow.thumb, { left: pct * usable }]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hit: { height: sizes.minTouch, justifyContent: 'center' },
  track: {
    height: sizes.rangeTrack,
    borderRadius: sizes.rangeTrack / 2,
    backgroundColor: colors.rangeTrack,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.ink },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
  },
});
