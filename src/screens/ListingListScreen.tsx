import { useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { Listing, ListingSort, ListingType } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { homeCategories } from '@/data/seed';
import { useListings } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { DetailTopBar } from '@/components/TopBar';
import { StaticBottomNav } from '@/components/StaticBottomNav';
import { AppText } from '@/components/ui/Text';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { ScreenState, type ScreenStatus } from '@/components/ui/ScreenState';
import { SortDropdown } from '@/components/ui/SortDropdown';
import { HScrollFade } from '@/components/ui/HScrollFade';
import { HomeSearchBar } from '@/components/HomeSearchBar';
import { RichSectionHeader } from '@/components/RichSectionHeader';
import { ListingRowCard } from '@/components/ListingRowCard';
import { MiniJobCard } from '@/components/MiniJobCard';
import { ProfilePeekRow } from '@/components/ProfilePeekRow';
import type { IconName } from '@/components/ui/Icon';

const SORTS = [
  { value: 'DISTANCE', label: nb.listSort.nearest },
  { value: 'NEWEST', label: nb.listSort.newest },
  { value: 'PRICE', label: nb.listSort.priceLow },
];

const dedupeOwners = (items: Listing[]) => {
  const seen = new Set<string>();
  const out = [];
  for (const l of items) {
    if (!seen.has(l.owner.id)) {
      seen.add(l.owner.id);
      out.push(l.owner);
    }
  }
  return out;
};

export function ListingListScreen({ type }: { type: ListingType }) {
  const router = useRouter();
  const me = useCurrentUser();
  const isTasks = type === 'TASK_REQUEST';
  const copy = isTasks ? nb.tasksPage : nb.offersPage;

  const [activeSlug, setActiveSlug] = useState('alle');
  const [sort, setSort] = useState<ListingSort>('DISTANCE');

  const { data, isLoading, isError, refetch } = useListings({ type, categorySlug: activeSlug }, sort);
  const items = data ?? [];

  const recent = useMemo(
    () =>
      [...(data ?? [])]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 6),
    [data],
  );
  const recentProfiles = useMemo(() => dedupeOwners(recent).slice(0, 8), [recent]);

  let status: ScreenStatus = 'ready';
  if (isLoading) status = 'loading';
  else if (isError) status = 'error';
  else if (items.length === 0) status = 'empty';

  return (
    <View style={styles.wrap}>
      <DetailTopBar
        title={copy.title}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        unreadNotifications
        onProfilePress={() => safePush('/profil')}
        onNotificationsPress={() => safePush('/varsler')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText variant="meta" color="navyMuted" align="center" style={styles.subtitle}>
          {copy.subtitle}
        </AppText>

        <View style={styles.sectionHead}>
          <RichSectionHeader
            icon={isTasks ? 'clock' : 'zap'}
            iconColor={isTasks ? 'lime' : 'cyan'}
            title={copy.recentTitle}
            onSeeAll={() => {}}
          />
        </View>
        <HScrollFade>
          {isTasks ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              {recent.map((l, i) => (
                <MiniJobCard
                  key={l.id}
                  listing={l}
                  isNew={i < 2}
                  onPress={() => safePush(`/oppdrag/${l.id}`)}
                />
              ))}
            </ScrollView>
          ) : (
            <ProfilePeekRow
              profiles={recentProfiles}
              onPressUser={(id) => safePush(`/profil/${id}`)}
            />
          )}
        </HScrollFade>

        <View style={styles.pad}>
          <HomeSearchBar onPressSearch={() => safePush('/sok')} onPressFilter={() => safePush('/sok')} />
        </View>

        <HScrollFade>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
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

        <View style={styles.allHeader}>
          <View style={styles.allHeaderText}>
            <AppText variant="section" weight="bold">
              {copy.allTitle}
            </AppText>
            <AppText variant="meta" color="navyMuted">
              {items.length} {copy.countUnit}
            </AppText>
          </View>
          <SortDropdown value={sort} options={SORTS} onChange={(v) => setSort(v as ListingSort)} />
        </View>

        {status === 'ready' ? (
          <View style={styles.list}>
            {items.map((l) => (
              <ListingRowCard key={l.id} listing={l} onPress={() => safePush(`/oppdrag/${l.id}`)} />
            ))}
          </View>
        ) : (
          <ScreenState status={status} onRetry={() => refetch()} emptyText={nb.state.emptyListings} />
        )}
      </ScrollView>

      <StaticBottomNav active="oppdrag" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { paddingBottom: tokens.space.xxxl, gap: tokens.space.md },
  subtitle: { paddingHorizontal: tokens.space.xl, marginTop: -tokens.space.xs },
  sectionHead: { paddingHorizontal: tokens.space.xl },
  pad: { paddingHorizontal: tokens.space.xl },
  strip: { gap: tokens.space.md, paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.xs },
  chips: { gap: tokens.space.sm, paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xs },
  allHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.xl,
    marginTop: tokens.space.sm,
    gap: tokens.space.md,
  },
  allHeaderText: { gap: 1, flexShrink: 1 },
  list: { paddingHorizontal: tokens.space.xl, gap: tokens.space.md },
});
