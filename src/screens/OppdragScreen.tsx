import { useState } from 'react';
import { ScrollView, View, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { useListings } from '@/api/queries';
import { useLocationScope } from '@/lib/locationScope';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { HomeTopBar } from '@/components/TopBar';
import { ScreenState } from '@/components/ui/ScreenState';
import { ListingListSkeleton } from '@/components/ui/Skeleton';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { HomeSearchBar } from '@/components/HomeSearchBar';
import { LocationBar } from '@/components/LocationBar';
import { HeroCard } from '@/components/home/HeroCard';
import { CategoryCircleRow, type CategoryCircle } from '@/components/home/CategoryCircleRow';
import { JobCardTile } from '@/components/home/JobCardTile';
import { CommunityTeaserCard } from '@/components/home/CommunityTeaserCard';

/** Circular category row on the front page (newhomepage.png). */
const CATEGORY_CIRCLES: CategoryCircle[] = [
  { slug: 'alle', label: 'Alle', icon: 'grid' },
  { slug: 'hage', label: 'Hage', icon: 'feather' },
  { slug: 'renhold', label: 'Renhold', icon: 'droplet' },
  { slug: 'transport', label: 'Transport', icon: 'truck' },
  { slug: 'montering', label: 'Montering', icon: 'tool' },
  { slug: 'more', label: nb.home.moreCategories, icon: 'more-horizontal' },
];

const PREVIEW = 8;

export function OppdragScreen() {
  const me = useCurrentUser();
  const { municipality, municipalities, ready } = useLocationScope();
  const [activeSlug, setActiveSlug] = useState('alle');

  // One blended list — both task requests and service offers near you.
  const jobs = useListings({ categorySlug: activeSlug, municipalities }, 'DISTANCE');
  const items = (jobs.data ?? []).slice(0, PREVIEW);
  const loading = jobs.isLoading || !ready;
  const refreshing = jobs.isFetching && !jobs.isLoading;

  const emptyText =
    municipalities.length > 0 ? nb.location.emptyListings(municipality ?? '') : nb.state.emptyListings;

  const onCategory = (slug: string) => {
    if (slug === 'more') {
      safePush('/sok');
      return;
    }
    setActiveSlug(slug);
  };

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

        <HomeSearchBar
          onPressSearch={() => safePush('/sok')}
          onPressFilter={() => safePush('/sok')}
        />

        <CategoryCircleRow
          items={CATEGORY_CIRCLES}
          activeSlug={activeSlug}
          onSelect={onCategory}
        />

        <View style={styles.nearYou}>
          <View style={styles.sectionHead}>
            <AppText weight="bold" numberOfLines={1} style={styles.sectionTitle}>
              {nb.home.nearYou}
            </AppText>
            <LocationBar />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={nb.common.seeAll}
              hitSlop={hitSlop}
              onPress={() => safePush('/oppdrag-liste')}
              style={styles.seeAll}
            >
              <AppText variant="body" color="navyMuted">
                {nb.common.seeAll}
              </AppText>
              <Icon name="chevron-right" size={16} color="navyMuted" />
            </Pressable>
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.carouselBleed}
              contentContainerStyle={styles.carousel}
            >
              {items.map((listing) => (
                <JobCardTile
                  key={listing.id}
                  listing={listing}
                  onPress={() => safePush(`/oppdrag/${listing.id}`)}
                />
              ))}
            </ScrollView>
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
  nearYou: { gap: tokens.space.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  sectionTitle: { fontSize: 19, lineHeight: 24, color: tokens.color.navy, flexShrink: 0 },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  carouselBleed: {
    marginHorizontal: -tokens.space.xl,
  },
  carousel: {
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: 2,
  },
});
