import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { homeCategories } from '@/data/seed';
import { useListings } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { HomeTopBar } from '@/components/TopBar';
import { AppText } from '@/components/ui/Text';
import { SearchField } from '@/components/ui/SearchField';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ScreenState, type ScreenStatus } from '@/components/ui/ScreenState';
import { ListingCard } from '@/components/ListingCard';
import type { IconName } from '@/components/ui/Icon';

export function OppdragScreen() {
  const me = useCurrentUser();
  const [activeSlug, setActiveSlug] = useState('alle');
  const { data, isLoading, isError, refetch } = useListings({ categorySlug: activeSlug });

  const listings = data ?? [];

  let status: ScreenStatus = 'ready';
  if (isLoading) status = 'loading';
  else if (isError) status = 'error';
  else if (listings.length === 0) status = 'empty';

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
        <AppText variant="question" weight="bold" style={styles.question}>
          {nb.home.question}
        </AppText>

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

        <SectionHeader title={nb.home.nearYou} />

        {status === 'ready' ? (
          <View style={styles.list}>
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onPress={() => safePush(`/oppdrag/${listing.id}`)}
              />
            ))}
          </View>
        ) : (
          <ScreenState
            status={status}
            onRetry={() => refetch()}
            emptyText={nb.state.emptyListings}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  content: {
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.xxxl,
    gap: tokens.space.lg,
  },
  question: {
    marginTop: tokens.space.sm,
  },
  categories: {
    gap: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  list: {
    gap: tokens.space.lg,
  },
});
