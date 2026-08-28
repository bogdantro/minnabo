import { View, Pressable, StyleSheet } from 'react-native';
import { tokens, hitSlop, type ColorToken } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon, type IconName } from './ui/Icon';

export function RichSectionHeader({
  icon,
  iconColor = 'lime',
  title,
  subtitle,
  onSeeAll,
}: {
  icon: IconName;
  iconColor?: ColorToken;
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Icon name={icon} size={22} color={iconColor} />
        <View style={styles.text}>
          <AppText variant="section" weight="bold" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="meta" color="navyMuted" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>

      {onSeeAll ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.common.seeAll}
          hitSlop={hitSlop}
          onPress={onSeeAll}
          style={styles.seeAll}
        >
          <AppText variant="meta" weight="bold" color="navy">
            {nb.common.seeAll}
          </AppText>
          <Icon name="chevron-right" size={15} color="navy" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  left: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm, flexShrink: 1 },
  text: { flexShrink: 1 },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 6,
  },
});
