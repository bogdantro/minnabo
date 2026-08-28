import { useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { pad2 } from '@/lib/calendar';
import { AppText } from './Text';
import { Icon } from './Icon';
import { BottomSheet } from './BottomSheet';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

/** Fully custom time picker (hour + minute columns). */
export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Velg tid',
  showLabel = true,
}: {
  label: string;
  value: string | null; // "HH:MM"
  onChange: (value: string) => void;
  placeholder?: string;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [h, m] = value ? value.split(':').map(Number) : [9, 0];
  const [hour, setHour] = useState(h);
  const [minute, setMinute] = useState(MINUTES.includes(m) ? m : 0);

  const confirm = () => {
    onChange(`${pad2(hour)}:${pad2(minute)}`);
    setOpen(false);
  };

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
        accessibilityValue={{ text: value ?? placeholder }}
        onPress={() => {
          setHour(h);
          setMinute(MINUTES.includes(m) ? m : 0);
          setOpen(true);
        }}
        style={styles.field}
      >
        <Icon name="clock" size={18} color="cyan" />
        <AppText variant="body" color={value ? 'navy' : 'navyMuted'} style={styles.value}>
          {value ?? placeholder}
        </AppText>
        <Icon name="chevron-down" size={18} color="navyMuted" />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label} heightRatio={0.55}>
        <View style={styles.columns}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.col}>
            {HOURS.map((v) => (
              <Pressable
                key={v}
                accessibilityRole="button"
                accessibilityState={{ selected: v === hour }}
                accessibilityLabel={`${pad2(v)} timer`}
                onPress={() => setHour(v)}
                style={[styles.item, v === hour && styles.itemActive]}
              >
                <AppText variant="body" weight={v === hour ? 'bold' : 'regular'} color={v === hour ? 'white' : 'navy'}>
                  {pad2(v)}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>

          <AppText variant="section" weight="bold" style={styles.colon}>
            :
          </AppText>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.col}>
            {MINUTES.map((v) => (
              <Pressable
                key={v}
                accessibilityRole="button"
                accessibilityState={{ selected: v === minute }}
                accessibilityLabel={`${pad2(v)} minutter`}
                onPress={() => setMinute(v)}
                style={[styles.item, v === minute && styles.itemActive]}
              >
                <AppText variant="body" weight={v === minute ? 'bold' : 'regular'} color={v === minute ? 'white' : 'navy'}>
                  {pad2(v)}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Pressable accessibilityRole="button" onPress={confirm} style={styles.confirm}>
          <AppText variant="cardTitle" weight="bold" color="white">
            {pad2(hour)}:{pad2(minute)}
          </AppText>
        </Pressable>
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
  columns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: tokens.space.md, height: 220 },
  col: { alignItems: 'center', gap: tokens.space.xs, paddingVertical: tokens.space.md },
  item: {
    width: 64,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
  },
  itemActive: { backgroundColor: tokens.color.lime },
  colon: { marginHorizontal: 2 },
  confirm: {
    marginTop: tokens.space.md,
    backgroundColor: tokens.color.lime,
    borderRadius: tokens.radius.pill,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
