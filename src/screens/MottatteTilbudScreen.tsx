import { useMemo } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { Proposal } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { repositories } from '@/data/repositories';
import { useReceivedProposals } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { DetailTopBar } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { ScreenState, type ScreenStatus } from '@/components/ui/ScreenState';
import { ProposalCard } from '@/components/ProposalCard';

export function MottatteTilbudScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const { data, isLoading, isError, refetch } = useReceivedProposals();

  const groups = useMemo(() => {
    const byListing = new Map<string, Proposal[]>();
    for (const p of data ?? []) {
      byListing.set(p.listingId, [...(byListing.get(p.listingId) ?? []), p]);
    }
    return [...byListing.entries()].map(([listingId, proposals]) => ({
      listingId,
      listing: repositories.listings.get(listingId),
      proposals: [...proposals].sort((a, b) => a.price.amountMinor - b.price.amountMinor),
    }));
  }, [data]);

  let status: ScreenStatus = 'ready';
  if (isLoading) status = 'loading';
  else if (isError) status = 'error';
  else if (groups.length === 0) status = 'empty';

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <DetailTopBar
        title={nb.tilbud.title}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        unreadNotifications
        onProfilePress={() => safePush('/profil')}
        onNotificationsPress={() => safePush('/varsler')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{nb.tilbud.title}</ScreenTitle>

        {status === 'ready' ? (
          groups.map((g) => {
            const cheapestId = g.proposals[0]?.id;
            return (
              <View key={g.listingId} style={styles.group}>
                <View style={styles.groupHead}>
                  <View style={styles.groupTitle}>
                    <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
                      {g.listing?.title ?? 'Oppdrag'}
                    </AppText>
                    <AppText variant="meta" color="navyMuted">
                      {g.proposals.length} {nb.tilbud.compareSub}
                    </AppText>
                  </View>
                  {g.proposals.length > 1 ? (
                    <AppText
                      variant="meta"
                      weight="bold"
                      color="cyan"
                      onPress={() => safePush(`/tilbud/sammenlign/${g.listingId}`)}
                    >
                      {nb.tilbud.compareTitle} ›
                    </AppText>
                  ) : null}
                </View>

                {g.proposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    cheapest={g.proposals.length > 1 && p.id === cheapestId}
                    onPress={() => safePush(`/tilbud/${p.id}`)}
                  />
                ))}
              </View>
            );
          })
        ) : (
          <ScreenState status={status} onRetry={() => refetch()} emptyText={nb.tilbud.empty} />
        )}

        <View style={styles.note}>
          <Icon name="lock" size={13} color="navyMuted" />
          <AppText variant="meta" color="navyMuted" style={styles.noteText}>
            {nb.tilbud.priceInfoNote}
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.lg, paddingBottom: tokens.space.xxxl },
  group: { gap: tokens.space.sm },
  groupHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: tokens.space.md },
  groupTitle: { flex: 1, gap: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: tokens.space.md },
  noteText: { flex: 1 },
});
