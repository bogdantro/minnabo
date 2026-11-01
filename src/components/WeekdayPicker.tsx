import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WEEKDAYS } from '@/domain/offer';
import { haptics } from '@/lib/haptics';
import { colors, shadow, text } from '@/theme/theme';

/** Man–Søn toggles (0 = søndag … 6 = lørdag), the same look as on «Tilbyr hjelp». */
export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  return (
    <View style={styles.days}>
      {WEEKDAYS.map((w) => {
        const on = value.includes(w.i);
        return (
          <Pressable
            key={w.i}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={w.long}
            onPress={() => {
              haptics.select();
              onChange(on ? value.filter((d) => d !== w.i) : [...value, w.i].sort());
            }}
            style={[styles.day, on && [styles.dayOn, shadow.btnInk]]}
          >
            <Text style={[styles.dayText, on && styles.dayTextOn]}>{w.short}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayText: { ...text.label, fontSize: 13 },
  dayTextOn: { color: colors.white },
});
