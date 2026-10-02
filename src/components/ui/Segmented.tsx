import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, motion, radius, screenPadding, shadow, sizes, text } from '@/theme/theme';
import { CountBadge } from './Badges';

export type SegmentOption<T extends string> = { value: T; label: string; count?: number };

export type SegmentedProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
  /** badge = red count bubble (default); inline = "Alle 6" with a faded number (Mottatte tilbud). */
  countStyle?: 'badge' | 'inline';
  style?: StyleProp<ViewStyle>;
};

/** `.seg` – grey pill track; active item white with a small shadow. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, countStyle = 'badge', style }: SegmentedProps<T>) {
  return (
    <View style={[styles.seg, style]} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.count ? `${o.label}, ${o.count}` : o.label}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, on && styles.segOn, on && shadow.segment]}
          >
            <Text style={[text.segment, { color: on ? colors.ink : colors.ink2 }]} numberOfLines={1}>
              {o.label}
              {countStyle === 'inline' && o.count != null ? <Text style={styles.inlineCount}>{` ${o.count}`}</Text> : null}
            </Text>
            {countStyle === 'badge' && o.count ? <CountBadge count={o.count} style={styles.segCount} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function Underline({ active }: { active: boolean }) {
  const s = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    s.value = active
      ? withTiming(1, { duration: motion.durations.tabIndicator, easing: Easing.bezier(...motion.ease) })
      : 0;
  }, [active, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scaleX: s.value }], opacity: s.value > 0 ? 1 : 0 }));
  return <Animated.View style={[styles.underline, anim]} />;
}

export type TabsProps<T extends string> = {
  tabs: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Apply the 20 px gutter (default true). */
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** `.tabs` – underline tabs; the active bar grows in over 300 ms. */
export function Tabs<T extends string>({ tabs, value, onChange, inset = true, style }: TabsProps<T>) {
  return (
    <View style={[styles.tabs, inset && styles.tabsInset, style]} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <Pressable
            key={t.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.value)}
            style={styles.tab}
          >
            <Text style={[text.tab, { color: on ? colors.ink : colors.mute }]}>
              {t.label}
              {t.count != null ? ` ${t.count}` : ''}
            </Text>
            <Underline active={on} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  inlineCount: { opacity: 0.6 },
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.track,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  segItem: {
    flex: 1,
    height: sizes.segment,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  segOn: { backgroundColor: colors.white },
  segCount: { position: 'relative' },
  tabs: {
    flexDirection: 'row',
    gap: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tabsInset: { paddingHorizontal: screenPadding },
  tab: { height: sizes.tab, justifyContent: 'center' },
  underline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: colors.ink,
  },
});
