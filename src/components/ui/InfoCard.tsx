import { View, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './Text';
import { Icon, type IconName } from './Icon';

export type InfoRowProps = {
  icon?: IconName;
  label: string;
  value?: string;
  last?: boolean;
};

export function InfoRow({ icon, label, value, last }: InfoRowProps) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.left}>
        {icon ? <Icon name={icon} size={18} color="cyan" /> : null}
        <AppText variant="body" numberOfLines={2} style={styles.label}>
          {label}
        </AppText>
      </View>
      {value ? (
        <AppText variant="body" color="navyMuted" style={styles.value} numberOfLines={2}>
          {value}
        </AppText>
      ) : null}
    </View>
  );
}

export function InfoCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    paddingHorizontal: tokens.space.lg,
    ...tokens.shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.space.md,
    gap: tokens.space.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.line,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    flexShrink: 1,
  },
  label: { flexShrink: 1 },
  value: { textAlign: 'right', flexShrink: 1 },
});
