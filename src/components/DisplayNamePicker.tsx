import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { displayNameOptions } from '@/domain/displayName';
import { text } from '@/theme/theme';
import { OptionCard, Radio } from '@/components/ui';

/**
 * Visningsnavn for someone with a Vipps name: pick the name or one of its short forms
 * (no free text – enforced in the database too, 0068). A saved name from before the
 * rule stays in the list until the person picks another one.
 */
export function DisplayNamePicker({
  fullName,
  value,
  onChange,
  current,
}: {
  fullName: string;
  value: string;
  onChange: (name: string) => void;
  /** the saved visningsnavn, kept selectable when it isn't one of the options */
  current?: string;
}) {
  const options: { name: string; kind: string }[] = displayNameOptions(fullName).map((name, i) => ({ name, kind: nb.setup.nameKinds[i] }));
  if (current && !options.some((o) => o.name === current)) options.unshift({ name: current, kind: nb.editProfile.currentName });

  return (
    <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={nb.setup.displayName}>
      {options.map((o) => (
        <OptionCard
          key={o.name}
          selected={value === o.name}
          accessibilityLabel={o.name}
          onPress={() => onChange(o.name)}
          style={styles.opt}
        >
          <Radio selected={value === o.name} />
          <Text style={[text.optionName, styles.flex]}>{o.name}</Text>
          <Text style={text.meta}>{o.kind}</Text>
        </OptionCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // the same spacing as Oppsett's kommune list
  list: { gap: 8, marginTop: 10 },
  opt: { paddingVertical: 13, paddingHorizontal: 14 },
  flex: { flex: 1 },
});
