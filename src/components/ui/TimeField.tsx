import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { pad2 } from '@/lib/calendar';
import { AppText } from './Text';
import { Icon } from './Icon';
import { Button } from './Button';
import { BottomSheet } from './BottomSheet';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];
const PRESETS = ['08:00', '12:00', '15:00', '18:00'];

const parse = (v: string | null): { h: number; m: number } => {
  if (!v) return { h: 9, m: 0 };
  const [h, m] = v.split(':').map((n) => parseInt(n, 10));
  return {
    h: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9,
    m: MINUTES.includes(m) ? m : 0,
  };
};

/** Fully custom time picker — a tappable hour grid + minute row, no scrolling wheels. */
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
  const [hour, setHour] = useState(() => parse(value).h);
  const [minute, setMinute] = useState(() => parse(value).m);

  // Keep the draft in sync with the incoming value whenever it changes or the sheet opens.
  useEffect(() => {
    if (open) {
      const p = parse(value);
      setHour(p.h);
      setMinute(p.m);
    }
  }, [open, value]);

  const draft = `${pad2(hour)}:${pad2(minute)}`;

  const confirm = () => {
    onChange(draft);
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
        onPress={() => setOpen(true)}
        style={styles.field}
      >
        <Icon name="clock" size={18} color="cyan" />
        <AppText variant="body" color={value ? 'navy' : 'navyMuted'} style={styles.value}>
          {value ?? placeholder}
        </AppText>
        <Icon name="chevron-down" size={18} color="navyMuted" />
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        heightRatio={0.72}
        maxHeight={640}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.preview}>
          <AppText variant="h1" weight="extrabold">
            {draft}
          </AppText>
        </View>

        <View style={styles.presetRow}>
          {PRESETS.map((p) => {
            const active = draft === p;
            return (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Klokken ${p}`}
                onPress={() => {
                  const parsed = parse(p);
                  setHour(parsed.h);
                  setMinute(parsed.m);
                }}
                style={[styles.preset, active && styles.presetActive]}
              >
                <AppText variant="meta" weight="bold" color={active ? 'white' : 'navy'}>
                  {p}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <AppText variant="meta" weight="bold" color="navyMuted" style={styles.groupLabel}>
          Time
        </AppText>
        <View style={styles.hourGrid}>
          {HOURS.map((v) => {
            const active = v === hour;
            return (
              <Pressable
                key={v}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Klokken ${pad2(v)}`}
                onPress={() => setHour(v)}
                style={[styles.hourCell, active && styles.cellActive]}
              >
                <AppText
                  variant="body"
                  weight={active ? 'bold' : 'regular'}
                  color={active ? 'white' : 'navy'}
                >
                  {pad2(v)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <AppText variant="meta" weight="bold" color="navyMuted" style={styles.groupLabel}>
          Minutt
        </AppText>
        <View style={styles.minuteRow}>
          {MINUTES.map((v) => {
            const active = v === minute;
            return (
              <Pressable
                key={v}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${pad2(v)} minutter`}
                onPress={() => setMinute(v)}
                style={[styles.minuteCell, active && styles.cellActive]}
              >
                <AppText
                  variant="body"
                  weight={active ? 'bold' : 'regular'}
                  color={active ? 'white' : 'navy'}
                >
                  {pad2(v)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        </ScrollView>

        <Button label={`Velg ${draft}`} onPress={confirm} iconRight="check" style={styles.confirm} />
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
  body: { flex: 1 },
  bodyContent: { paddingBottom: tokens.space.md },
  preview: {
    alignItems: 'center',
    paddingBottom: tokens.space.md,
  },
  presetRow: {
    flexDirection: 'row',
    gap: tokens.space.sm,
    marginBottom: tokens.space.lg,
  },
  preset: {
    flex: 1,
    alignItems: 'center',
    borderRadius: tokens.radius.pill,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
    paddingVertical: tokens.space.sm,
  },
  presetActive: { backgroundColor: tokens.color.lime, borderColor: tokens.color.lime },
  groupLabel: { marginBottom: tokens.space.sm },
  hourGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
    marginBottom: tokens.space.lg,
  },
  hourCell: {
    flexBasis: '14%',
    flexGrow: 1,
    height: 44,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minuteRow: {
    flexDirection: 'row',
    gap: tokens.space.sm,
  },
  minuteCell: {
    flex: 1,
    height: 48,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { backgroundColor: tokens.color.lime, borderColor: tokens.color.lime },
  confirm: { marginTop: tokens.space.md },
});
