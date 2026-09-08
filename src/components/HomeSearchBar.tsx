import { View, Pressable, StyleSheet } from 'react-native';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

/**
 * Front-page search (newhomepage.png): one tall white pill — magnifier,
 * placeholder, and a filter control on the right.
 */
export function HomeSearchBar({
  onPressSearch,
  onPressFilter,
}: {
  onPressSearch: () => void;
  onPressFilter: () => void;
}) {
  return (
    <View style={styles.field}>
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={nb.home.searchPlaceholder}
        onPress={onPressSearch}
        style={styles.search}
      >
        <Icon name="search" size={20} color="navyMuted" />
        <AppText variant="body" color="navyMuted" numberOfLines={1} style={styles.placeholder}>
          {nb.home.searchPlaceholder}
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.search.filters}
        hitSlop={hitSlop}
        onPress={onPressFilter}
      >
        <Icon name="sliders" size={20} color="navy" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.xl,
    ...tokens.shadow.card,
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
  },
  placeholder: { flex: 1 },
});
