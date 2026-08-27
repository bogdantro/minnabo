import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import type { Listing } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { homeCategories } from '@/data/seed';
import { useListings } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { HomeTopBar } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { SearchField } from '@/components/ui/SearchField';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ScreenState } from '@/components/ui/ScreenState';
import { Button } from '@/components/ui/Button';
import { ListingCard } from '@/components/ListingCard';
import type { IconName } from '@/components/ui/Icon';

const PREVIEW_COUNT = 5;

export function OppdragScreen() {
  const me = useCurrentUser();
  const [activeSlug, setActiveSlug] = useState('alle');

  const tasks = useListings({ categorySlug: activeSlug, type: 'TASK_REQUEST' });
  const offers = useListings({ categorySlug: activeSlug, type: 'SERVICE_OFFER' });

  return (
    <View style={styles.wrap}>
      <HomeTopBar
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        unreadNotifications
        onProfilePress={() => safePush('/profil')}
        onNotificationsPress={() => safePush('/varsler')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle style={styles.title}>{nb.home.question}</ScreenTitle>

        <SearchField
          placeholder={nb.home.searchPlaceholder}
          editable={false}
          onPress={() => safePush('/sok')}
        />

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

        <ListingSection
          title={nb.home.needHelpSection}
          query={tasks}
          onSeeAll={() => safePush('/oppdrag-liste')}
        />

        <ListingSection
          title={nb.home.offerHelpSection}
          query={offers}
          onSeeAll={() => safePush('/tilbydere')}
        />
      </ScrollView>
    </View>
  );
}

function ListingSection({
  title,
  query,
  onSeeAll,
}: {
  title: string;
  query: ReturnType<typeof useListings>;
  onSeeAll: () => void;
}) {
  const items: Listing[] = query.data ?? [];
  const preview = items.slice(0, PREVIEW_COUNT);
  const hasMore = items.length > PREVIEW_COUNT;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        actionLabel={hasMore ? nb.common.seeAll : undefined}
        onAction={hasMore ? onSeeAll : undefined}
      />

      {query.isLoading || query.isError || preview.length === 0 ? (
        <ScreenState
          status={query.isLoading ? 'loading' : query.isError ? 'error' : 'empty'}
          onRetry={() => query.refetch()}
        />
      ) : (
        <View style={styles.list}>
          {preview.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onPress={() => safePush(`/oppdrag/${listing.id}`)}
            />
          ))}
          {hasMore ? (
            <Button label={nb.common.seeAll} variant="secondary" onPress={onSeeAll} />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: {
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.xxxl,
    gap: tokens.space.lg,
  },
  title: { marginTop: tokens.space.sm },
  categories: { gap: tokens.space.md, paddingVertical: tokens.space.xs },
  section: { gap: tokens.space.sm },
  list: { gap: tokens.space.lg },
});
