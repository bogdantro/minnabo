import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './Text';
import { Icon, type IconName } from './Icon';

export type PillOption = { value: string; label: string; icon?: IconName };

type Props = {
  options: PillOption[];
  selected: string[];
  onToggle: (value: string) => void;
  tone?: 'lime' | 'cyan';
  /** selected pill = white bg + coloured border + check badge (services, time of day) */
  showCheck?: boolean;
  scroll?: boolean;
};

export function PickerPills({
  options,
  selected,
  onToggle,
  tone = 'lime',
  showCheck = false,
  scroll = false,
}: Props) {
  const pills = options.map((opt) => (
    <Pill
      key={opt.value}
      opt={opt}
      selected={selected.includes(opt.value)}
      tone={tone}
      showCheck={showCheck}
      onPress={() => onToggle(opt.value)}
    />
  ));

  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {pills}
      </ScrollView>
    );
  }
  return <View style={styles.wrapRow}>{pills}</View>;
}

function Pill({
  opt,
  selected,
  tone,
  showCheck,
  onPress,
}: {
  opt: PillOption;
  selected: boolean;
  tone: 'lime' | 'cyan';
  showCheck: boolean;
  onPress: () => void;
}) {
  // Solid accent fill + white text when selected without a check badge (days,
  // quick categories). With a check badge, keep the pill white.
  const solidFill = selected && !showCheck;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={opt.label}
      onPress={onPress}
      style={[
        styles.pill,
        solidFill
          ? { borderColor: tokens.color[tone], backgroundColor: tokens.color[tone] }
          : selected
            ? { borderColor: tokens.color[tone], backgroundColor: tokens.color.surface }
            : { borderColor: tokens.color.line, backgroundColor: tokens.color.surface },
      ]}
    >
      {opt.icon ? (
        <Icon name={opt.icon} size={15} color={solidFill ? 'white' : selected ? tone : 'navy'} />
      ) : null}
      <AppText variant="meta" weight="bold" color={solidFill ? 'white' : 'navy'}>
        {opt.label}
      </AppText>
      {showCheck && selected ? (
        <View style={[styles.check, { backgroundColor: tokens.color[tone] }]}>
          <Icon name="check" size={10} color="white" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: tokens.space.sm, alignItems: 'center', paddingVertical: 2 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: tokens.radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    minHeight: 40,
  },
  check: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
