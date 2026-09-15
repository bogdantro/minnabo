import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import { AppText } from './ui/Text';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';

export type StickyActionsProps = {
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  note: string;
};

export function StickyActions({
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  note,
}: StickyActionsProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + tokens.space.sm }]}>
      <Button label={primaryLabel} onPress={onPrimary} variant="primary" />
      {secondaryLabel && onSecondary ? (
        <Button label={secondaryLabel} onPress={onSecondary} variant="secondary" />
      ) : null}
      <View style={styles.note}>
        <Icon name="lock" size={13} color="navyMuted" />
        <AppText variant="meta" color="navyMuted">
          {note}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.md,
    gap: tokens.space.sm,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 2,
  },
});
