import { View, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { tokens } from '@/theme';
import { AppText } from './Text';
import { Icon, type IconName } from './Icon';

/** Soft cyan-tinted note box with a leading icon (used across the wizard). */
export function InfoBox({
  icon = 'shield',
  children,
  tone = 'cyan',
}: {
  icon?: IconName;
  children: ReactNode;
  tone?: 'cyan' | 'lime';
}) {
  return (
    <View style={[styles.box, tone === 'lime' && styles.lime]}>
      <Icon name={icon} size={16} color={tone} />
      <AppText variant="meta" color="navyMuted" style={styles.text}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space.sm,
    backgroundColor: tokens.color.cyanTint,
    borderRadius: tokens.radius.tile,
    padding: tokens.space.md,
  },
  lime: { backgroundColor: tokens.color.limeTint },
  text: { flex: 1 },
});
