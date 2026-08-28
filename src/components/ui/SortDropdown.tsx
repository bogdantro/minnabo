import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './Text';
import { Icon } from './Icon';
import { BottomSheet } from './BottomSheet';

export type SortOption = { value: string; label: string };

export function SortDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sortering: ${current.label}`}
        onPress={() => setOpen(true)}
        style={styles.pill}
      >
        <AppText variant="meta" weight="bold">
          {current.label}
        </AppText>
        <Icon name="chevron-down" size={16} color="navy" />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Sortering" heightRatio={0.5}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: o.value === value }}
            onPress={() => {
              onChange(o.value);
              setOpen(false);
            }}
            style={styles.option}
          >
            <AppText variant="body" weight={o.value === value ? 'bold' : 'regular'}>
              {o.label}
            </AppText>
            {o.value === value ? <Icon name="check" size={18} color="lime" /> : null}
          </Pressable>
        ))}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.space.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.line,
  },
});
