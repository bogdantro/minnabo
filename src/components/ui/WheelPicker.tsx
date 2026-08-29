import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  Pressable,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './Text';

export const WHEEL_ITEM_HEIGHT = 40;
export const WHEEL_VISIBLE = 5;
const PAD = ((WHEEL_VISIBLE - 1) / 2) * WHEEL_ITEM_HEIGHT;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * A single draggable wheel column. Snaps to whole items, keeps a centre
 * "focus" row emphasised, and commits the value when the drag settles.
 * Tapping a row also selects it (and keeps the component testable).
 */
export function WheelPicker({
  values,
  value,
  onChange,
  format = String,
  accessibilityLabel,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  accessibilityLabel: string;
}) {
  const ref = useRef<ScrollView>(null);
  const indexOfValue = Math.max(0, values.indexOf(value));
  const [focus, setFocus] = useState(indexOfValue);

  // Position the wheel on the current value when it first mounts.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      ref.current?.scrollTo({ y: indexOfValue * WHEEL_ITEM_HEIGHT, animated: false });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the value if it is changed from outside.
  useEffect(() => {
    const idx = values.indexOf(value);
    if (idx >= 0 && idx !== focus) {
      setFocus(idx);
      ref.current?.scrollTo({ y: idx * WHEEL_ITEM_HEIGHT, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const indexFromEvent = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    clamp(Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT), 0, values.length - 1);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = indexFromEvent(e);
    if (idx !== focus) setFocus(idx);
  };

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = indexFromEvent(e);
    setFocus(idx);
    ref.current?.scrollTo({ y: idx * WHEEL_ITEM_HEIGHT, animated: true });
    if (values[idx] !== value) onChange(values[idx]);
  };

  const selectIndex = (i: number) => {
    setFocus(i);
    ref.current?.scrollTo({ y: i * WHEEL_ITEM_HEIGHT, animated: true });
    if (values[i] !== value) onChange(values[i]);
  };

  return (
    <ScrollView
      ref={ref}
      style={styles.col}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ITEM_HEIGHT}
      disableIntervalMomentum
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={onScroll}
      onMomentumScrollEnd={settle}
      onScrollEndDrag={settle}
      contentContainerStyle={styles.content}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: format(value) }}
    >
      {values.map((v, i) => {
        const active = i === focus;
        return (
          <Pressable
            key={v}
            style={styles.item}
            accessibilityRole="button"
            accessibilityState={{ selected: v === value }}
            accessibilityLabel={`${accessibilityLabel}: ${format(v)}`}
            onPress={() => selectIndex(i)}
          >
            <AppText
              weight="medium"
              color={active ? 'navy' : 'navyMuted'}
              style={[styles.label, active ? styles.labelActive : styles.labelIdle]}
            >
              {format(v)}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  col: { width: 72, height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE, flexGrow: 0 },
  content: { paddingVertical: PAD },
  item: { height: WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  label: { fontVariant: ['tabular-nums'] },
  labelActive: { fontSize: 24, lineHeight: 28, opacity: 1 },
  labelIdle: { fontSize: 20, lineHeight: 24, opacity: 0.35 },
});

export { PAD as WHEEL_PAD };
