import { View, Pressable, StyleSheet } from 'react-native';
import { tokens, type ColorToken } from '@/theme';
import { AppText } from './Text';
import { Icon, type IconName } from './Icon';

/** Big pick-one card used in the wizard price step (steg4). */
export function SelectionCard({
  label,
  icon,
  tone = 'lime',
  selected,
  onPress,
}: {
  label: string;
  icon: IconName;
  tone?: 'lime' | 'cyan';
  selected: boolean;
  onPress: () => void;
}) {
  const accent: ColorToken = tone;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.card, selected && { borderColor: tokens.color[accent], borderWidth: 2 }]}
    >
      {selected ? (
        <View style={[styles.check, { backgroundColor: tokens.color[accent] }]}>
          <Icon name="check" size={12} color="white" />
        </View>
      ) : null}
      <Icon name={icon} size={26} color={selected ? accent : 'navyMuted'} />
      <AppText variant="cardTitle" weight="bold" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 104,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.sm,
    padding: tokens.space.md,
    ...tokens.shadow.card,
  },
  check: {
    position: 'absolute',
    top: tokens.space.sm,
    right: tokens.space.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});
