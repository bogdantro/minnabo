import { View, Pressable, StyleSheet } from 'react-native';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

/**
 * Front-page search: a white pill with the magnifier + placeholder, and a
 * filter control set off by a divider on the right.
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
        <Icon name="search" size={19} color="navyMuted" />
        <AppText variant="body" weight="medium" color="navyMuted" numberOfLines={1} style={styles.placeholder}>
          {nb.home.searchPlaceholder}
        </AppText>
      </Pressable>
      <View style={styles.divider} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.search.filters}
        hitSlop={hitSlop}
        onPress={onPressFilter}
        style={styles.filter}
      >
        <Icon name="sliders" size={19} color="navy" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.line,
    paddingLeft: tokens.space.lg,
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  placeholder: { flex: 1 },
  divider: { width: 1, height: 22, backgroundColor: tokens.color.line },
  filter: {
    width: 46,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
