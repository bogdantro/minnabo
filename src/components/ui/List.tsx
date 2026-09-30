import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, sizes, text } from '@/theme/theme';
import { Icon, type IconName } from './Icon';

/** `.list` – white rounded group; rows get a divider starting at x = 68. */
export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.group, shadow.card, style]}>
      {rows.map((row, i) => (
        <View key={row.key ?? i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {row}
        </View>
      ))}
    </View>
  );
}

export type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  /** Custom leading element instead of the icon tile (e.g. an Avatar). */
  leading?: ReactNode;
  /** Right side: badge, toggle, value. Chevron is shown when `onPress` is set and `chevron` isn't false. */
  right?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  /** Red title (Logg ut, Slett konto). */
  danger?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/** `.lrow` – 60 px list row with 40×40 icon tile, title/subtitle, right slot, chevron. */
export function ListRow({
  title,
  subtitle,
  icon,
  iconColor,
  iconBg,
  leading,
  right,
  chevron,
  onPress,
  danger = false,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const showChevron = chevron ?? !!onPress;
  const content = (
    <>
      {leading ??
        (icon ? (
          <View style={[styles.ri, iconBg ? { backgroundColor: iconBg } : null]}>
            <Icon name={icon} size={20} color={iconColor ?? (danger ? colors.danger : colors.ink)} />
          </View>
        ) : null)}
      <View style={styles.rt}>
        <Text style={[text.rowTitle, danger && { color: colors.danger }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={[text.rowSub, styles.sub]}>{subtitle}</Text> : null}
      </View>
      {right}
      {showChevron ? <Icon name="right" size={20} color={colors.faint} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** `.kv` – label left (mute), bold value right, line2 divider. */
export function KeyValueRow({ label, value, last = false }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <View style={[styles.kv, last && styles.kvLast]}>
      <Text style={text.kvLabel}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={[text.kvValue, styles.kvValue]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

/** `.stat` – KPI tile: display value + small label. */
export function StatTile({ value, label, style }: { value: string; label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.stat, shadow.card, style]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={text.num}>{value}</Text>
      <Text style={text.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' },
  divider: { position: 'absolute', top: 0, left: 68, right: 0, height: 1, backgroundColor: colors.line2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: sizes.rowMin,
  },
  pressed: { backgroundColor: colors.surface2 },
  ri: {
    width: sizes.rowIcon,
    height: sizes.rowIcon,
    borderRadius: radius.rowIcon,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rt: { flex: 1, minWidth: 0 },
  sub: { marginTop: 2 },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line2,
  },
  kvLast: { borderBottomWidth: 0 },
  kvValue: { textAlign: 'right', flexShrink: 1 },
  stat: {
    flex: 1,
    padding: 14,
    borderRadius: radius.tile,
    backgroundColor: colors.surface,
    gap: 4,
  },
});
