import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './ui/Text';
import { Icon, type IconName } from './ui/Icon';

export type CategoryCircle = { slug: string; label: string; icon: IconName };

/**
 * Circular category filter, shared by the front page, search and listing
 * lists. One horizontally-scrolling row of bordered circles (no drop shadow);
 * the active one fills mint green.
 */
export function CategoryCircleRow({
  items,
  activeSlug,
  onSelect,
}: {
  items: CategoryCircle[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((c) => {
        const active = c.slug === activeSlug;
        return (
          <Pressable
            key={c.slug}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={c.label}
            onPress={() => onSelect(c.slug)}
            style={styles.item}
          >
            <View style={[styles.circle, active && styles.circleActive]}>
              <Icon name={c.icon} size={23} color={active ? 'lime' : 'navy'} />
            </View>
            <AppText
              variant="meta"
              weight={active ? 'bold' : 'medium'}
              color={active ? 'navy' : 'navyMuted'}
              numberOfLines={1}
            >
              {c.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    paddingLeft: tokens.space.xl,
    paddingRight: tokens.space.xl,
  },
  item: { alignItems: 'center', gap: 7, width: 64 },
  circle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    backgroundColor: tokens.color.limeTint,
    borderColor: tokens.color.lime,
  },
});
