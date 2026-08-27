import { View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './Text';

export type ChipOption<T extends string> = { value: T; label: string };

export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      <AppText variant="meta" weight="bold">
        {label}
      </AppText>
      <View style={styles.row}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.label}
              onPress={() => onChange(opt.value)}
              style={[styles.chip, selected ? styles.selected : styles.unselected]}
            >
              <AppText variant="meta" weight="bold" color={selected ? 'navy' : 'navyMuted'}>
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  chip: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderWidth: 1.5,
  },
  selected: { borderColor: tokens.color.lime, backgroundColor: tokens.color.limeTint },
  unselected: { borderColor: tokens.color.line, backgroundColor: tokens.color.surface },
});
