import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, screenPadding, sizes, text } from '@/theme/theme';
import { Icon, type IconName } from './Icon';
import { TextLink } from './TextLink';

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  /** Optional 34×34 icon tile. */
  icon?: IconName;
  /** Icon tile colours; defaults to lime tint / lime deep. */
  iconBg?: string;
  iconColor?: string;
  /** Right-hand link, e.g. "Se alle". */
  actionLabel?: string;
  onAction?: () => void;
  /** Apply the 20 px screen gutter (default true). */
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** `.sh` – section header: icon tile, display title, subtitle, "Se alle" link. */
export function SectionHeader({
  title,
  subtitle,
  icon,
  iconBg = colors.limeTint,
  iconColor = colors.limeDeep,
  actionLabel,
  onAction,
  inset = true,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.wrap, inset && styles.inset, style]}>
      <View style={styles.left}>
        {icon ? (
          <View style={[styles.tile, { backgroundColor: iconBg }]}>
            <Icon name={icon} size={18} color={iconColor} />
          </View>
        ) : null}
        <View style={styles.titles}>
          <Text style={text.sectionTitle} accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? <Text style={[text.meta, styles.sub]}>{subtitle}</Text> : null}
        </View>
      </View>
      {actionLabel && onAction ? <TextLink label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 30,
    marginBottom: 14,
  },
  inset: { paddingHorizontal: screenPadding },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  tile: {
    width: sizes.sectionIcon,
    height: sizes.sectionIcon,
    borderRadius: radius.sectionIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flexShrink: 1 },
  sub: { marginTop: 4 },
});
