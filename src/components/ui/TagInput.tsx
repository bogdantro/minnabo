import { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './Text';
import { Icon } from './Icon';

export function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const t = draft.trim();
    if (!t || values.includes(t)) return;
    onChange([...values, t]);
    setDraft('');
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="meta" weight="bold">
        {label}
      </AppText>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={placeholder}
          placeholderTextColor={tokens.color.navyMuted}
          accessibilityLabel={label}
          returnKeyType="done"
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Legg til" onPress={add} style={styles.addBtn}>
          <Icon name="plus" size={18} color="navy" />
        </Pressable>
      </View>

      {values.length > 0 ? (
        <View style={styles.tags}>
          {values.map((v) => (
            <Pressable
              key={v}
              accessibilityRole="button"
              accessibilityLabel={`Fjern ${v}`}
              onPress={() => onChange(values.filter((x) => x !== v))}
              style={styles.tag}
            >
              <AppText variant="meta" weight="bold" color="lime">
                {v}
              </AppText>
              <Icon name="x" size={13} color="lime" />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  inputRow: { flexDirection: 'row', gap: tokens.space.sm },
  input: {
    flex: 1,
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
  addBtn: {
    width: 48,
    borderWidth: 1.5,
    borderColor: tokens.color.lime,
    borderRadius: tokens.radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: tokens.color.lime,
    backgroundColor: tokens.color.limeTint,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 4,
  },
});
