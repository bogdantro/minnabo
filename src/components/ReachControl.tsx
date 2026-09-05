import { View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';

const OPTIONS: { value: 0 | 1 | 2; label: string }[] = [
  { value: 0, label: nb.location.reachOwn },
  { value: 1, label: nb.location.reachNeighbours },
  { value: 2, label: nb.location.reachRegion },
];

export function ReachControl({
  value,
  onChange,
}: {
  value: 0 | 1 | 2;
  onChange: (r: 0 | 1 | 2) => void;
}) {
  return (
    <View style={styles.wrap}>
      <AppText variant="meta" weight="bold">
        {nb.location.reachLabel}
      </AppText>
      <View style={styles.row}>
        {OPTIONS.map((o) => {
          const selected = value === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={[styles.pill, selected && styles.pillActive]}
            >
              <AppText variant="meta" weight="bold" color={selected ? 'white' : 'navy'}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  pill: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  pillActive: { backgroundColor: tokens.color.cyan, borderColor: tokens.color.cyan },
});
