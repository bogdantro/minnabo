import { Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { Icon, type IconName } from './Icon';
import { AppText } from './Text';

export type CategoryChipProps = {
  label: string;
  icon: IconName;
  active?: boolean;
  onPress: () => void;
};

/** 72×72 icon tile (homepage.png). Icons are always lime green. */
export function CategoryChip({ label, icon, active = false, onPress }: CategoryChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.tile, active ? styles.active : styles.inactive]}
    >
      <Icon name={icon} size={22} color="lime" />
      <AppText variant="meta" weight="bold" color={active ? 'lime' : 'navy'} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 72,
    height: 72,
    borderRadius: tokens.radius.tile,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  active: { borderColor: tokens.color.lime, backgroundColor: tokens.color.limeTint },
  inactive: { borderColor: tokens.color.line, backgroundColor: tokens.color.surface },
});
