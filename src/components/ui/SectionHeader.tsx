import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { tokens, hitSlop } from '@/theme';
import { AppText } from './Text';
import { Icon } from './Icon';

export type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
};

export function SectionHeader({ title, actionLabel, onAction, style }: SectionHeaderProps) {
  return (
    <View style={[styles.wrap, style]}>
      <AppText variant="section" weight="bold" accessibilityRole="header">
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={hitSlop}
          onPress={onAction}
          style={styles.action}
        >
          <AppText variant="meta" weight="bold" color="cyan">
            {actionLabel}
          </AppText>
          <Icon name="chevron-right" size={16} color="cyan" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.space.md,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
