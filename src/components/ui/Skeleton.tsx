import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion, radius, screenPadding, shadow, sizes } from '@/theme/theme';

/** Opacity pulse 1 → .45 → 1 over 1.3 s, like `.sk` in the design. No shimmer gradient. */
function usePulse() {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(
      withTiming(0.45, { duration: motion.durations.skeletonPulse / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(o);
  }, [o]);
  return useAnimatedStyle(() => ({ opacity: o.value }));
}

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** `.sk` – grey block that pulses. */
export function Skeleton({ width = '100%', height = 14, radius: r = radius.s, style }: SkeletonProps) {
  const pulse = usePulse();
  return (
    <Animated.View
      style={[{ width, height, borderRadius: r, backgroundColor: colors.track }, pulse, style]}
    />
  );
}

/** Skeleton for `<ListingCard>` – same shape as the real card. */
export function ListingCardSkeleton() {
  return (
    <View style={[styles.card, shadow.card]}>
      <Skeleton width={sizes.listingThumbW} height={sizes.listingThumbMinH} radius={radius.thumb} />
      <View style={styles.body}>
        <Skeleton width={90} height={20} radius={10} />
        <Skeleton width={150} height={14} />
        <Skeleton width={110} height={12} />
        <Skeleton width={80} height={18} style={styles.price} />
      </View>
    </View>
  );
}

function SkeletonList({ count, children }: { count: number; children: () => ReactNode }) {
  return (
    <View style={styles.list} accessibilityRole="progressbar" accessibilityLabel="Laster">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>{children()}</View>
      ))}
    </View>
  );
}

export function ListingListSkeleton({ count = 4 }: { count?: number }) {
  return <SkeletonList count={count}>{() => <ListingCardSkeleton />}</SkeletonList>;
}

/** Row skeleton (inbox, notifications): circle + two lines. */
export function RowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={44} height={44} radius={22} />
      <View style={styles.rowBody}>
        <Skeleton width="100%" height={12} />
        <Skeleton width="70%" height={10} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingHorizontal: screenPadding },
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  body: { flex: 1, gap: 10, paddingTop: 4 },
  price: { marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBody: { flex: 1, gap: 6 },
});
