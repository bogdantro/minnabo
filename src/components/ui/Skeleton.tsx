import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, type ViewStyle, type DimensionValue } from 'react-native';
import { tokens } from '@/theme';

/** A single pulsing placeholder block. */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = tokens.radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: tokens.color.line, opacity: pulse },
        style,
      ]}
    />
  );
}

/** Placeholder that mirrors a ListingRowCard while results load. */
export function ListingCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={96} height={96} radius={tokens.radius.md} />
      <View style={styles.body}>
        <Skeleton width="80%" height={16} />
        <Skeleton width="55%" height={12} />
        <Skeleton width="40%" height={12} />
        <Skeleton width="30%" height={14} style={styles.price} />
      </View>
    </View>
  );
}

export function ListingListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list} accessibilityRole="progressbar" accessibilityLabel="Laster">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** Placeholder that mirrors a JobFeedCard — full-width photo, text below. */
export function JobFeedCardSkeleton() {
  return (
    <View style={styles.feedCard}>
      <Skeleton width="100%" height={176} radius={0} />
      <View style={styles.feedBody}>
        <Skeleton width={90} height={20} radius={tokens.radius.pill} />
        <Skeleton width="70%" height={17} />
        <Skeleton width="45%" height={13} />
        <Skeleton width="30%" height={19} style={styles.feedPrice} />
      </View>
    </View>
  );
}

export function JobFeedListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list} accessibilityRole="progressbar" accessibilityLabel="Laster">
      {Array.from({ length: count }).map((_, i) => (
        <JobFeedCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: tokens.space.lg },
  card: {
    flexDirection: 'row',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
  },
  body: { flex: 1, gap: tokens.space.sm, paddingVertical: 2 },
  price: { alignSelf: 'flex-end' },
  feedCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    overflow: 'hidden',
  },
  feedBody: { padding: tokens.space.lg, gap: tokens.space.sm },
  feedPrice: { marginTop: 2 },
});
