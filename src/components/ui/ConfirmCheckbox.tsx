import { Pressable, View, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { tokens } from '@/theme';
import { AppText } from './Text';
import { Icon } from './Icon';

export function ConfirmCheckbox({
  value,
  onChange,
  children,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={typeof children === 'string' ? children : 'Bekreft'}
      onPress={() => onChange(!value)}
      style={[styles.row, value && styles.rowOn]}
    >
      <View style={[styles.box, value && styles.boxOn]}>
        {value ? <Icon name="check" size={14} color="white" /> : null}
      </View>
      <AppText variant="meta" style={styles.text}>
        {children}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.tile,
    padding: tokens.space.md,
    backgroundColor: tokens.color.surface,
  },
  rowOn: { borderColor: tokens.color.lime, backgroundColor: tokens.color.limeTint },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: tokens.color.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.surface,
  },
  boxOn: { backgroundColor: tokens.color.lime, borderColor: tokens.color.lime },
  text: { flex: 1 },
});
