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
}: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <AppText variant="meta" weight="bold">
        {label}
      </AppText>
      <TextInput
        style={[styles.input, multiline && styles.multiline, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.navyMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        accessibilityLabel={label}
      />
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
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.tile,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    color: tokens.color.navy,
    backgroundColor: tokens.color.surface,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: tokens.color.dangerText },
});
