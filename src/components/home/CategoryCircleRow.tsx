import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from '../ui/Text';
import { Icon, type IconName } from '../ui/Icon';

export type CategoryCircle = { slug: string; label: string; icon: IconName };

/**
 * Circular category picker on the front page (newhomepage.png). One row,
 * horizontally scrolling. The active circle takes a mint fill + green icon.
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
              <Icon name={c.icon} size={24} color={active ? 'lime' : 'navyMuted'} />
            </View>
            <AppText
              variant="meta"
              weight={active ? 'bold' : 'regular'}
              color={active ? 'lime' : 'navyMuted'}
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
  row: { gap: tokens.space.lg, paddingVertical: tokens.space.xs, paddingRight: tokens.space.xl },
  item: { alignItems: 'center', gap: 7, width: 66 },
  circle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: tokens.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.card,
  },
  circleActive: {
    backgroundColor: tokens.color.limeTint,
  },
});
