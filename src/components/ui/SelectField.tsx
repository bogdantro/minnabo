import { useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './Text';
import { Icon, type IconName } from './Icon';
import { BottomSheet } from './BottomSheet';

export type SelectOption = { value: string; label: string };

export function SelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
  icon,
  showLabel = true,
}: {
  label: string;
  value: string | undefined;
  options: SelectOption[];
  placeholder: string;
  onChange: (value: string) => void;
  icon?: IconName;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      {showLabel ? (
        <AppText variant="meta" weight="bold">
          {label}
        </AppText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        onPress={() => setOpen(true)}
        style={styles.field}
      >
        {icon ? <Icon name={icon} size={18} color="cyan" /> : null}
        <AppText variant="body" color={selected ? 'navy' : 'navyMuted'} style={styles.value}>
          {selected?.label ?? placeholder}
        </AppText>
        <Icon name="chevron-down" size={18} color="navyMuted" />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label} heightRatio={0.6}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {options.map((opt) => {
            const isSel = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={styles.option}
              >
                <AppText variant="body" weight={isSel ? 'bold' : 'regular'}>
                  {opt.label}
                </AppText>
                {isSel ? <Icon name="check" size={18} color="lime" /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.tile,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.color.surface,
    minHeight: 52,
  },
  value: { flex: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.space.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.line,
  },
});
