import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import nb from '@/i18n/nb';
import { colors, sizes, text } from '@/theme/theme';
import { Icon, VerifiedIcon } from './Icon';

export { VerifiedIcon };

/** «✓ Møter alltid opp» – a small green line next to a helper's name (see domain/reliability). */
export function ReliableLine({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.reliable, style]} accessibilityLabel={nb.reliability.alwaysA11y} testID="reliable-badge">
      <Icon name="check" size={13} color={colors.okText} />
      <Text style={styles.reliableText} numberOfLines={1}>
        {nb.reliability.always}
      </Text>
    </View>
  );
}

/** `.count` – red unread counter. Position it yourself (absolute) on the host. */
export function CountBadge({ count, style }: { count: number; style?: StyleProp<ViewStyle> }) {
  if (count <= 0) return null;
  return (
    <View style={[styles.count, style]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={text.count} maxFontSizeMultiplier={1.2}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export type VerifiedBadgeProps = {
  label?: string;
  size?: 14 | 16;
  /** Opens the "Hva ble sjekket?" sheet. */
  onPress?: () => void;
};

/** `.vbadge` – green BadgeCheck + text. */
export function VerifiedBadge({ label = 'Verifisert', size = 16, onPress }: VerifiedBadgeProps) {
  const content = (
    <>
      <VerifiedIcon size={size} />
      <Text style={[text.verified, { color: colors.verified }]}>{label}</Text>
    </>
  );
  if (!onPress) {
    return <View style={styles.vbadge}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Se hva som ble sjekket`}
      hitSlop={12}
      onPress={onPress}
      style={styles.vbadge}
    >
      {content}
    </Pressable>
  );
}

/** `.stars` – filled star + rating, optional "(32)" count. */
export function Stars({ rating, count, style }: { rating: number; count?: number; style?: StyleProp<ViewStyle> }) {
  const value = rating.toFixed(1).replace('.', ',');
  return (
    <View
      style={[styles.stars, style]}
      accessible
      accessibilityLabel={`${value} av 5 stjerner${count != null ? `, ${count} vurderinger` : ''}`}
    >
      <Icon name="star" size={14} color={colors.star} filled />
      <Text style={text.stars}>
        {value}
        {count != null ? <Text style={styles.starsCount}> ({count})</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  reliable: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reliableText: { ...text.metaBold, fontSize: 12.5, color: colors.okText },
  count: {
    minWidth: sizes.count,
    height: sizes.count,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.notifDot,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vbadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsCount: { color: colors.mute, fontFamily: text.body.fontFamily },
});
