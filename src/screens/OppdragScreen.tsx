import { useState } from 'react';
import { ScrollView, View, RefreshControl, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { HOME_CATEGORIES, categoryBySlug } from '@/domain/categories';
import { useListings } from '@/api/queries';
import { useLocationScope } from '@/lib/locationScope';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { HomeTopBar } from '@/components/TopBar';
import { ScreenState } from '@/components/ui/ScreenState';
import { ListingListSkeleton } from '@/components/ui/Skeleton';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { HomeSearchBar } from '@/components/HomeSearchBar';
import { LocationBar } from '@/components/LocationBar';
import { HeroCard } from '@/components/home/HeroCard';
import { CategoryCircleRow, type CategoryCircle } from '@/components/CategoryCircleRow';
import { JobCardTile } from '@/components/home/JobCardTile';
import { JobRow } from '@/components/home/JobRow';
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

/** First few jobs go in the carousel; the rest stack as compact rows. */
const CAROUSEL = 4;
const ROWS = 4;

export function OppdragScreen() {
  const me = useCurrentUser();
  const { municipality, municipalities, ready } = useLocationScope();
  const [activeSlug, setActiveSlug] = useState('alle');

  // One blended list — task requests + service offers near you, minus your own.
  const jobs = useListings({ categorySlug: activeSlug, municipalities }, 'DISTANCE');
  const items = (jobs.data ?? []).filter((l) => l.owner.id !== me.id);
  const carousel = items.slice(0, CAROUSEL);
  const rows = items.slice(CAROUSEL, CAROUSEL + ROWS);

  const loading = jobs.isLoading || !ready;
  const refreshing = jobs.isFetching && !jobs.isLoading;
  const emptyText =
    municipalities.length > 0
      ? nb.location.emptyListings(municipality ?? '')
      : nb.state.emptyListings;

  const onCategory = (slug: string) => setActiveSlug(slug);

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => jobs.refetch()}
            tintColor={tokens.color.lime}
            colors={[tokens.color.lime]}
          />
        }
      >
        <HeroCard onPressCta={() => safePush('/legg-ut')} />

        <View style={styles.filterGroup}>
          <HomeSearchBar
            onPressSearch={() => safePush('/sok')}
            onPressFilter={() => safePush('/sok')}
          />
          <CategoryCircleRow
            items={CATEGORY_CIRCLES}
            activeSlug={activeSlug}
            onSelect={onCategory}
          />
        </View>

        <View style={styles.nearYou}>
          <View style={styles.sectionHead}>
            <AppText variant="sectionHead" numberOfLines={1} style={styles.sectionTitle}>
              {nb.home.nearYou}
            </AppText>
            <LocationBar />
          </View>

          {loading ? (
            <ListingListSkeleton count={2} />
          ) : jobs.isError || items.length === 0 ? (
            <ScreenState
              status={jobs.isError ? 'error' : 'empty'}
              onRetry={() => jobs.refetch()}
              emptyText={emptyText}
            />
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.carouselBleed}
                contentContainerStyle={styles.carousel}
              >
                {carousel.map((listing) => (
                  <JobCardTile
                    key={listing.id}
                    listing={listing}
                    onPress={() => safePush(`/oppdrag/${listing.id}`)}
                  />
                ))}
              </ScrollView>

              {rows.length > 0 ? (
                <View style={styles.rows}>
                  {rows.map((listing) => (
                    <JobRow
                      key={listing.id}
                      listing={listing}
                      onPress={() => safePush(`/oppdrag/${listing.id}`)}
                    />
                  ))}
                </View>
              ) : null}

              <Button
                label={`${nb.common.seeAll} (${items.length})`}
                variant="secondary"
                iconRight="arrow-right"
                onPress={() => safePush('/oppdrag-liste')}
              />
            </>
          )}
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
  nearYou: { gap: tokens.space.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
  },
  sectionTitle: { flexShrink: 0 },
  carouselBleed: { marginHorizontal: -tokens.space.xl },
  carousel: {
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: 2,
  },
  rows: { gap: tokens.space.sm },
});
