import { View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

export function HomeSearchBar({
  onPressSearch,
  onPressFilter,
}: {
  onPressSearch: () => void;
  onPressFilter: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={nb.home.searchPlaceholder}
        onPress={onPressSearch}
        style={styles.field}
      >
        <View style={styles.searchCircle}>
          <Icon name="search" size={20} color="white" />
        </View>
        <AppText variant="body" color="navyMuted" style={styles.placeholder}>
          {nb.home.searchPlaceholder}
        </AppText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.search.filters}
        onPress={onPressFilter}
        style={styles.filterBtn}
      >
        <Icon name="sliders" size={20} color="navy" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.line,
    paddingRight: tokens.space.lg,
    paddingVertical: 6,
    paddingLeft: 6,
    ...tokens.shadow.card,
  },
  searchCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { flex: 1 },
  filterBtn: {
    width: 52,
    height: 52,
    borderRadius: tokens.radius.tile,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.line,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.card,
  },
});
