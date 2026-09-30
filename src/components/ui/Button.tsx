import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, sizes, text } from '@/theme/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Spinner } from './Spinner';

export type ButtonVariant =
  | 'lime'
  | 'cyan'
  | 'ink'
  | 'ghost'
  | 'soft'
  | 'danger'
  | 'dangerGhost'
  | 'vipps'
  | 'text'
  /** @deprecated use `lime` */
  | 'primary'
  /** @deprecated use `ghost` */
  | 'secondary';

export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width (`.btn-block`). Defaults to true: most buttons sit in footers and forms. */
  block?: boolean;
  /** Leading icon. */
  icon?: IconName;
  iconRight?: IconName;
  /** @deprecated use `icon` */
  iconLeft?: IconName;
  disabled?: boolean;
  loading?: boolean;
  /** Label while loading, e.g. "Sender tilbudet …". */
  loadingLabel?: string;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

type Look = { bg: string; fg: string; border?: string; shadow?: ViewStyle };

const LOOKS: Record<Exclude<ButtonVariant, 'primary' | 'secondary'>, Look> = {
  lime: { bg: colors.lime, fg: colors.ink, shadow: shadow.btnLime },
  cyan: { bg: colors.cyan2, fg: colors.white, shadow: shadow.btnCyan },
  ink: { bg: colors.ink, fg: colors.white, shadow: shadow.btnInk },
  ghost: { bg: colors.white, fg: colors.ink, border: colors.line },
  soft: { bg: colors.softBg, fg: colors.ink },
  danger: { bg: colors.danger, fg: colors.white },
  dangerGhost: { bg: colors.white, fg: colors.danger, border: colors.dangerBorder },
  vipps: { bg: colors.vipps, fg: colors.white, shadow: shadow.btnVipps },
  text: { bg: 'transparent', fg: colors.ink },
};

const SIZE = {
  sm: { height: sizes.buttonSm, padding: 16, font: text.buttonSm, icon: 16 },
  md: { height: sizes.button, padding: 22, font: text.button, icon: 18 },
  lg: { height: sizes.buttonLg, padding: 26, font: text.buttonLg, icon: 18 },
} as const;

/** `.btn` – pill button, press scales to 97 %. See docs/COMPONENTS.md › Buttons. */
export function Button({
  label,
  onPress,
  variant = 'lime',
  size = 'md',
  block = true,
  icon,
  iconRight,
  iconLeft,
  disabled = false,
  loading = false,
  loadingLabel,
  accessibilityLabel,
  testID,
  style,
}: ButtonProps) {
  // Guard against re-entrancy while an async onPress is still running, so a
  // slow network call cannot be fired twice. Separate synchronous taps
  // (wizard "Neste", filters) are never swallowed.
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const blocked = disabled || loading || busy;

  const handlePress = useCallback(() => {
    if (disabled || loading || inFlight.current) return;
    const result = onPress();
    if (result && typeof result.then === 'function') {
      inFlight.current = true;
      setBusy(true);
      result.finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
    }
  }, [disabled, loading, onPress]);

  const v = variant === 'primary' ? 'lime' : variant === 'secondary' ? 'ghost' : variant;
  const look = LOOKS[v];
  const isText = v === 'text';
  const s = SIZE[size];
  const lead = icon ?? iconLeft;
  const onDark = look.fg === colors.white;

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={blocked}
      onPress={handlePress}
      scaleTo={0.97}
      style={[
        styles.base,
        {
          height: isText ? sizes.buttonText : s.height,
          paddingHorizontal: isText ? 6 : s.padding,
          backgroundColor: look.bg,
        },
        look.border ? { borderWidth: 1.5, borderColor: look.border } : null,
        block ? styles.block : styles.inline,
        !disabled && look.shadow ? look.shadow : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <Spinner
          size={18}
          color={look.fg}
          trackColor={onDark ? colors.spinnerTrackLight : colors.spinnerTrackDark}
        />
      ) : lead ? (
        <Icon name={lead} size={s.icon} color={look.fg} />
      ) : null}
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.4}
        style={[
          s.font,
          { color: look.fg },
          isText ? styles.textVariant : null,
        ]}
      >
        {loading && loadingLabel ? loadingLabel : label}
      </Text>
      {iconRight && !loading ? <Icon name={iconRight} size={s.icon} color={look.fg} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  block: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  disabled: { opacity: 0.38, ...shadow.none },
  textVariant: {
    textDecorationLine: 'underline',
    fontFamily: text.bodySemi.fontFamily,
  },
});
