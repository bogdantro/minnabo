import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, sizes, text } from '@/theme/theme';
import { Icon, type IconName } from './Icon';

export type TextLinkProps = {
  label: string;
  onPress: () => void;
  /** Trailing icon, 16 px. Defaults to the arrow; pass `null` for none. */
  icon?: IconName | null;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** `.link` – cyan-deep bold 14, min height 44, optional trailing arrow. */
export function TextLink({ label, onPress, icon = 'arrow', accessibilityLabel, testID, style }: TextLinkProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.base, pressed && styles.pressed, style]}
    >
      <Text style={text.link} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
      {icon ? <Icon name={icon} size={16} color={colors.cyanDeep} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  pressed: { opacity: 0.6 },
});
