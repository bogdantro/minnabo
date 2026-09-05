import { useMemo, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { INNLANDET_KOMMUNER, resolveKommune } from '@/data/kommuner';
import { isPostalCode } from '@/data/postalCodes';
import { AppText } from './ui/Text';
import { TextField } from './ui/TextField';

export function KommunePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (kommune: string) => void;
}) {
  const [q, setQ] = useState('');
  const resolved = isPostalCode(q) ? resolveKommune(q) : undefined;
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n || isPostalCode(q)) return INNLANDET_KOMMUNER;
    return INNLANDET_KOMMUNER.filter((k) => k.toLowerCase().includes(n));
  }, [q]);

  return (
    <View style={styles.wrap}>
      <TextField
        label={nb.location.pickKommune}
        hideLabel
        value={q}
        onChangeText={setQ}
        placeholder={nb.location.searchKommune}
      />
      {resolved ? (
        <Pressable
          testID="kommune-postal-hint"
          style={styles.hint}
          onPress={() => onChange(resolved)}
          accessibilityRole="button"
          accessibilityLabel={`${nb.location.detected} ${resolved}`}
        >
          <AppText variant="meta" weight="bold" color="cyan">
            {nb.location.detected} {resolved}
          </AppText>
        </Pressable>
      ) : null}
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {list.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: value === k }}
            onPress={() => onChange(k)}
            style={[styles.row, value === k && styles.rowActive]}
          >
            <AppText variant="body" weight={value === k ? 'bold' : 'regular'}>
              {k}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.sm },
  hint: { paddingVertical: tokens.space.xs },
  list: { maxHeight: 240 },
  row: {
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.tile,
  },
  rowActive: { backgroundColor: tokens.color.limeTint },
});
