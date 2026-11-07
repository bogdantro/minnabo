import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { colors, text } from '@/theme/theme';

/** «Nytt siden sist»: everything above this line came after the last visit. */
export function NewSinceLine() {
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={nb.feed.seenBefore}>
      <View style={styles.line} />
      <Text style={styles.label}>{nb.feed.seenBefore}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 2 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  label: { ...text.eyebrow, color: colors.limeDeep },
});
