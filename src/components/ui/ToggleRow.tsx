import { View, Switch, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './Text';
import { Icon, type IconName } from './Icon';

export function ToggleRow({
  label,
  value,
  onValueChange,
  icon,
  hint,
  last,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  icon?: IconName;
  hint?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.border]}>
      {icon ? <Icon name={icon} size={18} color="cyan" /> : null}
      <View style={styles.body}>
        <AppText variant="body">{label}</AppText>
        {hint ? (
          <AppText variant="meta" color="navyMuted">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: tokens.color.lime, false: tokens.color.line }}
        thumbColor={tokens.color.surface}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function ToggleCard({ children }: { children: React.ReactNode }) {
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
    gap: tokens.space.md,
    paddingVertical: tokens.space.md,
    minHeight: 54,
  },
  border: { borderBottomWidth: 1, borderBottomColor: tokens.color.line },
  body: { flex: 1, gap: 2 },
});
