import { ScrollView, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';

/**
 * A single scrolling row of canned messages above the composer. Tapping one
 * sends it straight away — meant for helpers who answer a lot of neighbours.
 */
export function QuickReplies({ onPick }: { onPick: (text: string) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel={nb.chat.quickRepliesLabel}
      style={styles.wrap}
      contentContainerStyle={styles.row}
    >
      {nb.chat.quickReplies.map((text) => (
        <Pressable
          key={text}
          accessibilityRole="button"
          accessibilityLabel={text}
          onPress={() => onPick(text)}
          style={styles.chip}
        >
          <AppText variant="meta" weight="bold" color="navy" numberOfLines={1}>
            {text}
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 0,
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
  },
  row: {
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.bg,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 6,
  },
});
