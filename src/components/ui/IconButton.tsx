import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, sizes } from '@/theme/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export type IconButtonVariant = 'default' | 'dark' | 'glass' | 'ghost';

export type IconButtonProps = {
  icon: IconName;
  /** Required: icon-only buttons must have a Norwegian label. */
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: IconButtonVariant;
  /** Red unread dot (bell). */
  dot?: boolean;
  dotTestID?: string;
  iconSize?: number;
  /** Override the icon colour (e.g. red heart when saved). */
  iconColor?: string;
  /** Solid icon (filled heart). */
  iconFilled?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** `.iconbtn` – 44 circle. Press scales to 92 %. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'default',
  dot = false,
  dotTestID,
  iconSize = 20,
  iconColor,
  iconFilled,
  disabled,
  testID,
  style,
}: IconButtonProps) {
  const fg = variant === 'dark' ? colors.white : colors.ink;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.92}
      style={[styles.base, styles[variant], style]}
    >
      {variant === 'glass' ? (
        <BlurView intensity={24} tint="light" style={[StyleSheet.absoluteFill, styles.round]} />
      ) : null}
      {/* Positioned wrapper so the icon paints above the absolute blur layer (web stacking). */}
      <View style={styles.iconLayer}>
        <Icon name={icon} size={iconSize} color={iconColor ?? fg} filled={iconFilled} />
      </View>
      {dot ? <View style={styles.dot} testID={dotTestID} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: sizes.iconButton / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: { borderRadius: sizes.iconButton / 2, overflow: 'hidden' },
  iconLayer: { position: 'relative', zIndex: 1 },
  default: { backgroundColor: colors.iconBtnBg, borderColor: colors.line },
  dark: { backgroundColor: colors.ink, borderColor: colors.ink },
  glass: { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, overflow: 'hidden' },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: sizes.dot,
    height: sizes.dot,
    borderRadius: sizes.dot / 2,
    backgroundColor: colors.notifDot,
    borderWidth: 2,
    borderColor: colors.white,
  },
});
