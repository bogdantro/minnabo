import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import {
  MONTHS_NB,
  WEEKDAYS_SHORT_NB,
  monthGrid,
  isSameDay,
  startOfDay,
  addDays,
  formatFriendlyDate,
} from '@/lib/calendar';
import { AppText } from './Text';
import { Icon } from './Icon';
import { BottomSheet } from './BottomSheet';

/** Fully custom calendar date picker (no native pickers). */
export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Velg dato',
  showLabel = true,
  minToday = true,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  placeholder?: string;
  showLabel?: boolean;
  minToday?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const today = startOfDay(new Date());
  const [view, setView] = useState(() => value ?? today);

  const grid = monthGrid(view.getFullYear(), view.getMonth());
  const disabled = (d: Date) => minToday && d.getTime() < today.getTime();

  const pick = (d: Date) => {
    if (disabled(d)) return;
    onChange(d);
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
        accessibilityValue={{ text: value ? formatFriendlyDate(value) : placeholder }}
        onPress={() => {
          setView(value ?? today);
          setOpen(true);
        }}
        style={styles.field}
      >
        <Icon name="calendar" size={18} color="cyan" />
        <AppText variant="body" color={value ? 'navy' : 'navyMuted'} style={styles.value}>
          {value ? formatFriendlyDate(value) : placeholder}
        </AppText>
        <Icon name="chevron-down" size={18} color="navyMuted" />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label} heightRatio={0.68}>
        <View style={styles.quick}>
          {[
            { label: 'I dag', d: today },
            { label: 'I morgen', d: addDays(today, 1) },
            { label: 'Om en uke', d: addDays(today, 7) },
          ].map((q) => (
            <Pressable
              key={q.label}
              accessibilityRole="button"
              onPress={() => pick(q.d)}
              style={[styles.quickPill, value && isSameDay(value, q.d) && styles.quickPillActive]}
            >
              <AppText
                variant="meta"
                weight="bold"
                color={value && isSameDay(value, q.d) ? 'white' : 'navy'}
              >
                {q.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View style={styles.monthRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forrige måned"
            onPress={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            hitSlop={8}
          >
            <Icon name="chevron-left" size={22} color="navy" />
          </Pressable>
          <AppText variant="cardTitle" weight="bold">
            {MONTHS_NB[view.getMonth()]} {view.getFullYear()}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Neste måned"
            onPress={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            hitSlop={8}
          >
            <Icon name="chevron-right" size={22} color="navy" />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS_SHORT_NB.map((w) => (
            <AppText key={w} variant="meta" weight="bold" color="navyMuted" style={styles.weekCell}>
              {w}
            </AppText>
          ))}
        </View>

        {grid.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((d) => {
              const inMonth = d.getMonth() === view.getMonth();
              const isSelected = value ? isSameDay(d, value) : false;
              const isToday = isSameDay(d, today);
              const dis = disabled(d);
              return (
                <Pressable
                  key={d.toISOString()}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: dis }}
                  accessibilityLabel={`${d.getDate()}. ${MONTHS_NB[d.getMonth()]}`}
                  disabled={dis}
                  onPress={() => pick(d)}
                  style={[
                    styles.dayCell,
                    isSelected && styles.daySelected,
                    !isSelected && isToday && styles.dayToday,
                  ]}
                >
                  <AppText
                    variant="meta"
                    weight={isSelected || isToday ? 'bold' : 'regular'}
                    color={isSelected ? 'white' : dis ? 'navyMuted' : !inMonth ? 'navyMuted' : 'navy'}
                  >
                    {d.getDate()}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ))}
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
  quick: { flexDirection: 'row', gap: tokens.space.sm, marginBottom: tokens.space.md, flexWrap: 'wrap' },
  quickPill: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  quickPillActive: { backgroundColor: tokens.color.lime, borderColor: tokens.color.lime },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.space.sm,
  },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  weekCell: { width: 40, textAlign: 'center' },
  dayCell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: tokens.color.lime },
  dayToday: { borderWidth: 1.5, borderColor: tokens.color.lime },
});
