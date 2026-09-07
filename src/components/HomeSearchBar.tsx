import { Pressable, StyleSheet } from 'react-native';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

/**
 * Front-page search (newhomepage.png): one tall white pill — magnifier,
 * placeholder, and a filter control on the right, all inside the field.
 */
export function HomeSearchBar({
  onPressSearch,
  onPressFilter,
}: {
  onPressSearch: () => void;
  onPressFilter: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="search"
      accessibilityLabel={nb.home.searchPlaceholder}
      onPress={onPressSearch}
      style={styles.field}
    >
      <Icon name="search" size={20} color="navyMuted" />
      <AppText variant="body" color="navyMuted" style={styles.placeholder}>
        {nb.home.searchPlaceholder}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.search.filters}
        hitSlop={hitSlop}
        onPress={onPressFilter}
      >
        <Icon name="sliders" size={20} color="navy" />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    height: 56,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.xl,
    ...tokens.shadow.card,
  },
  placeholder: { flex: 1 },
});
