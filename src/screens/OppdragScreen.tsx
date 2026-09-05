import { useState } from 'react';
import { ScrollView, View, Pressable, RefreshControl, StyleSheet } from 'react-native';
import type { Listing, PublicProfile } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { HOME_CATEGORIES as homeCategories } from '@/domain/categories';
import { useListings } from '@/api/queries';
import { useLocationScope } from '@/lib/locationScope';
import { usePresence } from '@/api/realtime';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { HomeTopBar } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { ScreenState } from '@/components/ui/ScreenState';
import { ListingListSkeleton } from '@/components/ui/Skeleton';
import type { IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { AppText } from '@/components/ui/Text';
import { LocationBar } from '@/components/LocationBar';
import { HomeSearchBar } from '@/components/HomeSearchBar';
import { RichSectionHeader } from '@/components/RichSectionHeader';
import { ActiveUsersRow } from '@/components/ActiveUsersRow';
import { ListingRowCard } from '@/components/ListingRowCard';
import { HScrollFade } from '@/components/ui/HScrollFade';

const PREVIEW = 4;

const dedupeOwners = (listings: Listing[]): PublicProfile[] => {
  const seen = new Set<string>();
  const out: PublicProfile[] = [];
  for (const l of listings) {
    if (!seen.has(l.owner.id)) {
      seen.add(l.owner.id);
      out.push(l.owner);
    }
  }
  return out;
};

export function OppdragScreen() {
  const me = useCurrentUser();
  const online = usePresence();
  const [activeSlug, setActiveSlug] = useState('alle');
  const { municipality, municipalities } = useLocationScope();

  const offers = useListings({ categorySlug: activeSlug, type: 'SERVICE_OFFER', municipalities });
  const tasks = useListings({ categorySlug: activeSlug, type: 'TASK_REQUEST', municipalities });

  const emptyText =
    municipalities.length > 0 ? nb.location.emptyListings(municipality ?? '') : undefined;

  const offerItems = (offers.data ?? []).slice(0, PREVIEW);
  const taskItems = (tasks.data ?? []).slice(0, PREVIEW);
  const activeProviders = dedupeOwners(offers.data ?? []).slice(0, 8);

  const { refetch: refetchOffers } = offers;
  const { refetch: refetchTasks } = tasks;
  // Show the pull spinner only for an actual pull, not the first load.
  const refreshing =
    (offers.isFetching && !offers.isLoading) || (tasks.isFetching && !tasks.isLoading);
  const onRefresh = () => {
    void refetchOffers();
    void refetchTasks();
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
            onRefresh={onRefresh}
            tintColor={tokens.color.cyan}
            colors={[tokens.color.cyan]}
          />
        }
      >
        <ScreenTitle style={styles.title}>{nb.home.question}</ScreenTitle>
        <LocationBar />
        <HomeSearchBar
          onPressSearch={() => safePush('/sok')}
          onPressFilter={() => safePush('/sok')}
        />

        <HScrollFade>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {homeCategories.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.label}
                icon={c.icon as IconName}
                active={activeSlug === c.slug}
                onPress={() => setActiveSlug(c.slug)}
              />
            ))}
          </ScrollView>
        </HScrollFade>

        <Section
          icon="user"
          iconColor="cyan"
          title={nb.home.offerSectionTitle}
          subtitle={nb.home.offerSectionSubtitle}
          query={offers}
          emptyText={emptyText}
          onSeeAll={() => safePush('/tilbydere')}
        >
          {activeProviders.length > 0 ? (
            <View style={styles.activeRow}>
              <HScrollFade>
                <ActiveUsersRow
                  profiles={activeProviders}
                  onlineIds={online}
                  onPressUser={(id) => safePush(`/profil/${id}`)}
                />
              </HScrollFade>
            </View>
          ) : null}
          <View style={styles.list}>
            {offerItems.map((listing) => (
              <ListingRowCard
                key={listing.id}
                listing={listing}
                onPress={() => safePush(`/oppdrag/${listing.id}`)}
              />
            ))}
          </View>
        </Section>

        <View style={styles.sectionGap} />

        <Section
          icon="clipboard"
          iconColor="lime"
          title={nb.home.taskSectionTitle}
          subtitle={nb.home.taskSectionSubtitle}
          query={tasks}
          emptyText={emptyText}
          onSeeAll={() => safePush('/oppdrag-liste')}
        >
          <View style={styles.list}>
            {taskItems.map((listing) => (
              <ListingRowCard
                key={listing.id}
                listing={listing}
                onPress={() => safePush(`/oppdrag/${listing.id}`)}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nb.leadBoard.title}
            onPress={() => safePush('/oppdrag-for-meg')}
            style={styles.leadLink}
          >
            <Icon name="target" size={16} color="lime" />
            <AppText variant="meta" weight="bold" style={styles.leadLinkText}>
              {nb.leadBoard.title}
            </AppText>
            <Icon name="chevron-right" size={16} color="navyMuted" />
          </Pressable>
        </Section>

        <View style={styles.footerNote}>
          <Icon name="zap" size={14} color="cyan" />
          <AppText variant="meta" color="navyMuted">
            {nb.home.freshDaily}
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({
  icon,
  iconColor,
  title,
  subtitle,
  query,
  emptyText,
  onSeeAll,
  children,
}: {
  icon: 'user' | 'clipboard';
  iconColor: 'lime' | 'cyan';
  title: string;
  subtitle: string;
  query: ReturnType<typeof useListings>;
  emptyText?: string;
  onSeeAll: () => void;
  children: React.ReactNode;
}) {
  const items = query.data ?? [];
  return (
    <View style={styles.section}>
      <RichSectionHeader
        icon={icon}
        iconColor={iconColor}
        title={title}
        subtitle={subtitle}
        onSeeAll={onSeeAll}
      />
      {query.isLoading ? (
        <ListingListSkeleton count={3} />
      ) : query.isError || items.length === 0 ? (
        <ScreenState
          status={query.isError ? 'error' : 'empty'}
          onRetry={() => query.refetch()}
          emptyText={emptyText}
        />
      ) : (
        <>
          {children}
          {items.length > PREVIEW ? (
            <Button
              label={`${nb.common.seeAll} (${items.length})`}
              variant="secondary"
              onPress={onSeeAll}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: {
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.xxxl,
    gap: tokens.space.md,
  },
  title: { paddingRight: 72 },
  categories: { gap: tokens.space.sm, paddingVertical: tokens.space.xs },
  sectionGap: { height: tokens.space.xxl },
  section: { gap: tokens.space.md },
  activeRow: {
    marginHorizontal: -tokens.space.xl,
    marginTop: tokens.space.xs,
    marginBottom: tokens.space.sm,
  },
  list: { gap: tokens.space.md },
  leadLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    marginTop: tokens.space.sm,
    padding: tokens.space.md,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
  leadLinkText: { flex: 1 },
  footerNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: tokens.space.sm },
});
