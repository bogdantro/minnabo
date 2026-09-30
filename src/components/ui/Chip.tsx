import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { categoryColors, colors, radius, screenPadding, sizes, text, type CategoryId } from '@/theme/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export type ChipProps = {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  /** Category chip: coloured 30 px circle with the category icon. */
  category?: CategoryId;
  /** Plain icon in the leading circle (no category colours). */
  icon?: IconName;
  size?: 'md' | 'sm';
  /** Selected look: ink (default), or lime / cyan tint. */
  tone?: 'ink' | 'lime' | 'cyan';
  /** Trailing element, e.g. a count or an X. */
  trailing?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** `.chip` – pill filter / choice. Press scales to 95 %. */
export function Chip({
  label,
  onPress,
  selected = false,
  category,
  icon,
  size = 'md',
  tone = 'ink',
  trailing,
  accessibilityLabel,
  testID,
  style,
}: ChipProps) {
  const hasLead = !!category || !!icon;
  const sm = size === 'sm';
  const selInk = selected && tone === 'ink';
  const cat = category ? categoryColors[category] : null;

  const bg = !selected ? colors.white : tone === 'lime' ? colors.limeTint : tone === 'cyan' ? colors.cyanTint : colors.ink;
  const border = !selected ? colors.line : tone === 'lime' ? colors.chipLimeBorder : tone === 'cyan' ? colors.chipCyanBorder : colors.ink;
  const fg = !selected ? colors.ink : tone === 'lime' ? colors.limeDeep : tone === 'cyan' ? colors.cyanDeep : colors.white;

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      scaleTo={0.95}
      style={[
        styles.base,
        {
          height: sm ? sizes.chipSm : sizes.chip,
          paddingLeft: hasLead ? 6 : sm ? 13 : 16,
          paddingRight: hasLead ? 15 : sm ? 13 : 16,
          backgroundColor: bg,
          borderColor: border,
        },
        style,
      ]}
    >
      {hasLead ? (
        <View
          style={[
            styles.ci,
            { backgroundColor: selInk ? colors.onDark16 : cat ? cat.bg : colors.bg },
          ]}
        >
          <Icon
            name={category ?? (icon as IconName)}
            size={16}
            color={selInk ? colors.white : cat ? cat.fg : colors.ink}
          />
        </View>
      ) : null}
      <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[sm ? text.chipSm : text.chip, { color: fg }]}>
        {label}
      </Text>
      {trailing}
    </PressableScale>
  );
}

/** `.chips` – horizontal chip scroller with the 20 px screen gutter. */
export function ChipRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 0,
  },
  ci: {
    width: sizes.chipIcon,
    height: sizes.chipIcon,
    borderRadius: sizes.chipIcon / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { gap: 8, paddingHorizontal: screenPadding, paddingTop: 2, paddingBottom: 6 },
});
