import { View, TextInput, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './Text';

export type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  error?: string;
  hint?: string;
  maxLength?: number;
  /** render the label inside the field as a small floating caption */
  floatingLabel?: boolean;
  /** hide the label entirely (still used for accessibility) */
  hideLabel?: boolean;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  error,
  hint,
  maxLength,
  floatingLabel = false,
  hideLabel = false,
}: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      {!floatingLabel && !hideLabel ? (
        <AppText variant="meta" weight="bold">
          {label}
        </AppText>
      ) : null}

      <View style={[styles.field, multiline && styles.fieldMultiline, error && styles.fieldError]}>
        {floatingLabel ? (
          <AppText variant="meta" color="navyMuted" style={styles.floating}>
            {label}
          </AppText>
        ) : null}
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.color.navyMuted}
          multiline={multiline}
          keyboardType={keyboardType}
          maxLength={maxLength}
          accessibilityLabel={label}
        />
      </View>

      <View style={styles.footRow}>
        <View style={styles.footLeft}>
          {error ? (
            <AppText variant="meta" color="dangerText">
              {error}
            </AppText>
          ) : hint ? (
            <AppText variant="meta" color="navyMuted">
              {hint}
            </AppText>
          ) : null}
        </View>
        {maxLength ? (
          <AppText variant="meta" color="navyMuted">
            {value.length}/{maxLength}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: {
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.tile,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.color.surface,
  },
  fieldMultiline: { minHeight: 110 },
  fieldError: { borderColor: tokens.color.dangerText },
  floating: { marginBottom: 2 },
  input: {
    fontFamily: tokens.font.regular,
    fontSize: 15,
    color: tokens.color.navy,
    padding: 0,
    minHeight: 24,
  },
  inputMultiline: { textAlignVertical: 'top', minHeight: 84 },
  footRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 2 },
  footLeft: { flexShrink: 1 },
});
