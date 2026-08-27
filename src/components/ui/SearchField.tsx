import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { Icon } from './Icon';
import { AppText } from './Text';

export type SearchFieldProps = {
  placeholder: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmit?: () => void;
  onPress?: () => void;
  editable?: boolean;
  autoFocus?: boolean;
};

export function SearchField({
  placeholder,
  value = '',
  onChangeText,
  onSubmit,
  onPress,
  editable = true,
  autoFocus = false,
}: SearchFieldProps) {
  if (!editable && onPress) {
    return (
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        onPress={onPress}
        style={styles.wrap}
      >
        <Icon name="search" size={20} color="lime" />
        <AppText variant="body" color="navyMuted">
          {value || placeholder}
        </AppText>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <Icon name="search" size={20} color="lime" />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.navyMuted}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        editable={editable}
        autoFocus={autoFocus}
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    height: 52,
    borderRadius: tokens.radius.tile,
    borderWidth: 1,
    borderColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
    paddingHorizontal: tokens.space.lg,
    ...tokens.shadow.card,
  },
  input: {
    flex: 1,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    color: tokens.color.navy,
    padding: 0,
  },
});
