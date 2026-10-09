import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { pad2 } from '@/lib/calendar';
import { AppText } from './Text';
import { Icon } from './Icon';
import { Button } from './Button';
import { BottomSheet } from './BottomSheet';
import { WheelPicker, WHEEL_ITEM_HEIGHT, WHEEL_VISIBLE, WHEEL_PAD } from './WheelPicker';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_STEP = 5;
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);

const nearestMinute = (m: number) => {
  const snapped = Math.round(m / MINUTE_STEP) * MINUTE_STEP;
  return snapped >= 60 ? 0 : snapped;
};

const parse = (v: string | null): { h: number; m: number } => {
  if (!v) return { h: 9, m: 0 };
  const [h, m] = v.split(':').map((n) => parseInt(n, 10));
  return {
    h: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9,
    m: Number.isFinite(m) ? nearestMinute(m) : 0,
  };
};

/** Fully custom time picker — two draggable wheels for hour and minute. */
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
        onPress={() => {
          // Start the wheels on the current value each time the picker opens.
          const p = parse(value);
          setHour(p.h);
          setMinute(p.m);
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

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        heightRatio={0.6}
        maxHeight={520}
      >
        <View style={styles.headerRow}>
          <AppText variant="meta" weight="bold" color="navyMuted" style={styles.colHead}>
            Time
          </AppText>
          <AppText variant="meta" weight="bold" color="navyMuted" style={styles.colHead}>
            Minutt
          </AppText>
        </View>

        <View style={styles.wheels}>
          <View pointerEvents="none" style={styles.band} />
          <View style={styles.row}>
            <WheelPicker
              values={HOURS}
              value={hour}
              onChange={setHour}
              format={pad2}
              accessibilityLabel="Time"
            />
            <AppText variant="h1" weight="extrabold" style={styles.colon}>
              :
            </AppText>
            <WheelPicker
              values={MINUTES}
              value={minute}
              onChange={setMinute}
              format={pad2}
              accessibilityLabel="Minutt"
            />
          </View>
        </View>

        <Button label={`Velg ${draft}`} onPress={confirm} style={styles.confirm} />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 64,
    marginBottom: tokens.space.xs,
  },
  colHead: { width: 72, textAlign: 'center' },
  wheels: {
    height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE,
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_PAD,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.limeTint,
    borderWidth: 1,
    borderColor: tokens.color.lime,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.lg,
  },
  colon: { marginBottom: 2 },
  confirm: { marginTop: tokens.space.xl },
});
