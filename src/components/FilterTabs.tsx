import { View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './ui/Text';

export type FilterTabsOption<T extends string> = { value: T; label: string };

export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: FilterTabsOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={[styles.pill, active ? styles.active : styles.inactive]}
          >
            <AppText variant="meta" weight="bold" color={active ? 'navy' : 'navyMuted'}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: tokens.space.sm, flexWrap: 'wrap' },
  pill: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    borderWidth: 1.5,
  },
  active: { borderColor: tokens.color.lime, backgroundColor: tokens.color.surface },
  inactive: { borderColor: tokens.color.line, backgroundColor: tokens.color.surface },
});
