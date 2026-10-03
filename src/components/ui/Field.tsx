import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { colors, fonts, radius, shadow, sizes, text } from '@/theme/theme';
import { Icon, type IconName } from './Icon';

/** `.errtxt` – red alert text that shakes when it appears (or when `shakeKey` changes). */
export function ErrorText({ children, shakeKey }: { children: string; shakeKey?: number }) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSequence(
      withTiming(-5, { duration: 88 }),
      withTiming(5, { duration: 175 }),
      withTiming(0, { duration: 87 }),
    );
  }, [children, shakeKey, x]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Animated.View style={[styles.err, anim]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Icon name="alert" size={16} color={colors.danger} />
      <Text style={text.error}>{children}</Text>
    </Animated.View>
  );
}

export type FieldProps = {
  label?: string;
  /** Small grey text right of the label ("12/500", "Valgfritt"). */
  hint?: string;
  /** Custom element right of the label (e.g. a "Fra Vipps" lock chip); replaces `hint`. */
  labelRight?: ReactNode;
  /** Help line under the input. */
  help?: string;
  error?: string | null;
  /** Bump to re-shake the same error (e.g. on repeated submit). */
  shakeKey?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** `.field` – label row + control + help / error, gap 8. */
export function Field({ label, hint, labelRight, help, error, shakeKey, children, style }: FieldProps) {
  return (
    <View style={[styles.field, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={text.label}>{label}</Text>
          {labelRight ?? (hint ? <Text style={text.hint}>{hint}</Text> : null)}
        </View>
      ) : null}
      {children}
      {error ? <ErrorText shakeKey={shakeKey}>{error}</ErrorText> : help ? <Text style={text.help}>{help}</Text> : null}
    </View>
  );
}

export type InputProps = TextInputProps & {
  error?: boolean;
  /** Leading icon inside the field. */
  icon?: IconName;
  /** Trailing text, e.g. "kr". */
  suffix?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

/** `.input` – 56 px field; cyan focus ring, red error ring. Multiline = 112 min height. */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { error = false, icon, suffix, multiline, containerStyle, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.inwrap, containerStyle]}>
      {icon ? (
        <View style={styles.pre} pointerEvents="none">
          <Icon name={icon} size={18} color={colors.mute} />
        </View>
      ) : null}
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={colors.placeholder}
        selectionColor={colors.cyan2}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          icon ? { paddingLeft: 46 } : null,
          suffix ? { paddingRight: 60 } : null,
          focused ? styles.focus : null,
          error ? styles.error : null,
          style,
        ]}
        {...rest}
      />
      {suffix ? (
        <Text style={styles.suffix} pointerEvents="none">
          {suffix}
        </Text>
      ) : null}
    </View>
  );
});

/** Norwegian thousands grouping: "1250" → "1 250". */
export function formatAmount(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export type AmountInputProps = Omit<InputProps, 'value' | 'onChangeText' | 'keyboardType'> & {
  /** Digits only, e.g. "1250". */
  value: string;
  onChangeText: (digits: string) => void;
  maxDigits?: number;
};

/** `.amount` – 76 px display-font amount with "kr" suffix and 1 250 grouping. */
export function AmountInput({ value, onChangeText, maxDigits = 6, style, ...rest }: AmountInputProps) {
  return (
    <Input
      {...rest}
      value={formatAmount(value)}
      onChangeText={(t) => onChangeText(t.replace(/\D/g, '').replace(/^0+/, '').slice(0, maxDigits))}
      keyboardType="number-pad"
      inputMode="numeric"
      suffix="kr"
      style={[styles.amount, style]}
    />
  );
}

export type SelectBoxProps = {
  value: string;
  placeholder?: string;
  icon?: IconName;
  onPress: () => void;
  error?: boolean;
  accessibilityLabel?: string;
};

/** `.selectbox` – looks like an input; value + chevron; opens a picker sheet. */
export function SelectBox({ value, placeholder, icon, onPress, error, accessibilityLabel }: SelectBoxProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? value ?? placeholder}
      onPress={onPress}
      style={[styles.input, styles.select, error ? styles.error : null]}
    >
      {icon ? <Icon name={icon} size={18} color={colors.mute} /> : null}
      <Text style={[text.input, styles.selectV, !value && { color: colors.placeholder }]} numberOfLines={1}>
        {value || placeholder}
      </Text>
      <Icon name="down" size={18} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  err: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inwrap: { position: 'relative', justifyContent: 'center' },
  input: {
    height: sizes.input,
    borderRadius: radius.input,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 16,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.ink,
  },
  multiline: {
    height: undefined,
    minHeight: sizes.multilineMin,
    paddingTop: 14,
    paddingBottom: 14,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  focus: { borderColor: colors.cyan2, ...shadow.focus },
  error: { borderColor: colors.danger, ...shadow.error },
  pre: { position: 'absolute', left: 16, zIndex: 1 },
  suffix: {
    position: 'absolute',
    right: sizes.amountSuffixRight,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.mute,
  },
  amount: {
    height: sizes.amountInput,
    fontFamily: text.amount.fontFamily,
    fontSize: text.amount.fontSize,
    letterSpacing: text.amount.letterSpacing,
  },
  select: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectV: { flex: 1 },
});
