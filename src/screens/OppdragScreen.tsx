import { ScrollView, View, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { HOME_CATEGORIES, categoryBySlug } from '@/domain/categories';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { HomeTopBar } from '@/components/TopBar';
import { HomeSearchBar } from '@/components/HomeSearchBar';
import { LocationBar } from '@/components/LocationBar';
import { HeroCard } from '@/components/home/HeroCard';
import { CategoryCircleRow, type CategoryCircle } from '@/components/CategoryCircleRow';
import { CommunityTeaserCard } from '@/components/home/CommunityTeaserCard';

/**
 * Reuses `HOME_CATEGORIES` (Alle/Hage/Renhold/Transport/Montering — the same
 * short labels the search/list screens show for these) plus one more, so the
 * label/icon here can't drift from what a listing actually shows elsewhere.
 */
const CATEGORY_CIRCLES: CategoryCircle[] = [
  ...HOME_CATEGORIES.map((c) => ({ slug: c.slug, label: c.label, icon: c.icon as CategoryCircle['icon'] })),
  {
    slug: 'maling',
    label: categoryBySlug('maling').label.split('/')[0],
    icon: categoryBySlug('maling').icon as CategoryCircle['icon'],
  },
];

export function OppdragScreen() {
  const me = useCurrentUser();

  const onCategory = (slug: string) =>
    safePush(slug === 'alle' ? '/sok' : `/sok?category=${slug}`);

  return (
    <View style={styles.wrap}>
      <HomeTopBar
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        onProfilePress={() => safePush('/profil')}
        onNotificationsPress={() => safePush('/varsler')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <HeroCard onPressCta={() => safePush('/legg-ut')} />

        <View style={styles.filterGroup}>
          <LocationBar />
          <HomeSearchBar
            onPressSearch={() => safePush('/sok')}
            onPressFilter={() => safePush('/sok')}
          />
          <View style={styles.categoryBleed}>
            <CategoryCircleRow items={CATEGORY_CIRCLES} activeSlug="alle" onSelect={onCategory} />
          </View>
        </View>

        <CommunityTeaserCard onPress={() => safePush('/fellesskap')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.xs,
    paddingBottom: tokens.space.xxxl,
    gap: tokens.space.xl,
  },
  filterGroup: { gap: tokens.space.md },
  // CategoryCircleRow pads its own left/right edges, so bleed it back out of
  // this screen's own horizontal padding to keep it flush with the content
  // above and below instead of double-padded.
  categoryBleed: { marginHorizontal: -tokens.space.xl },
});
