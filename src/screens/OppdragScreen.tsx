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
import { JobFeedListSkeleton } from '@/components/ui/Skeleton';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { HomeSearchBar } from '@/components/HomeSearchBar';
import { LocationBar } from '@/components/LocationBar';
import { HeroCard } from '@/components/home/HeroCard';
import { CategoryCircleRow, type CategoryCircle } from '@/components/CategoryCircleRow';
import { JobFeedCard } from '@/components/home/JobFeedCard';
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

/** The homepage only teases the newest open tasks — the rest live in search. */
const NEWEST_COUNT = 8;

export function OppdragScreen() {
  const me = useCurrentUser();
  const { municipality, municipalities, ready } = useLocationScope();

  const jobs = useListings({ type: 'TASK_REQUEST', municipalities }, 'NEWEST');
  const items = (jobs.data ?? []).filter((l) => l.owner.id !== me.id).slice(0, NEWEST_COUNT);

  const loading = jobs.isLoading || !ready;
  const refreshing = jobs.isFetching && !jobs.isLoading;
  const emptyText =
    municipalities.length > 0
      ? nb.location.emptyListings(municipality ?? '')
      : nb.state.emptyListings;

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
          <LocationBar />
          <HomeSearchBar
            onPressSearch={() => safePush('/sok')}
            onPressFilter={() => safePush('/sok')}
          />
          <View style={styles.categoryBleed}>
            <CategoryCircleRow items={CATEGORY_CIRCLES} activeSlug="alle" onSelect={onCategory} />
          </View>
        </View>

        <View style={styles.jobs}>
          <AppText variant="sectionHead" numberOfLines={1}>
            {nb.home.nearYou}
          </AppText>

          {loading ? (
            <JobFeedListSkeleton count={3} />
          ) : jobs.isError || items.length === 0 ? (
            <ScreenState
              status={jobs.isError ? 'error' : 'empty'}
              onRetry={() => jobs.refetch()}
              emptyText={emptyText}
            />
          ) : (
            <View style={styles.feed}>
              {items.map((listing) => (
                <JobFeedCard
                  key={listing.id}
                  listing={listing}
                  onPress={() => safePush(`/oppdrag/${listing.id}`)}
                />
              ))}
              <Button
                label={nb.common.seeAll}
                variant="secondary"
                iconRight="arrow-right"
                onPress={() => safePush('/oppdrag-liste')}
              />
            </View>
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
  // CategoryCircleRow pads its own left/right edges, so bleed it back out of
  // this screen's own horizontal padding to keep it flush with the content
  // above and below instead of double-padded.
  categoryBleed: { marginHorizontal: -tokens.space.xl },
  jobs: { gap: tokens.space.md },
  feed: { gap: tokens.space.lg },
});
