import { View, TextInput, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './Text';

/** Big price input with the "kr" unit sitting inside the field on the right. */
export function AmountField({
  value,
  onChange,
  unit,
  placeholder = '600',
  accessibilityLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.field}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder={placeholder}
        placeholderTextColor={tokens.color.navyMuted}
        spellCheck={false}
        autoCorrect={false}
        accessibilityLabel={accessibilityLabel ?? nb.leggUt.amountLabel}
      />
      <AppText variant="cardTitle" weight="bold" color="navyMuted">
        {unit ?? nb.leggUt.amountUnit}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.tile,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.color.surface,
    gap: tokens.space.sm,
  },
  input: {
    flex: 1,
    fontFamily: tokens.font.bold,
    fontSize: 22,
    color: tokens.color.navy,
    padding: 0,
  },
});
