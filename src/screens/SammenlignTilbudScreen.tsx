import { useMemo, useState } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import type { Proposal } from '@/domain/types';
import { formatPrice } from '@/domain/price';
import {
  useListing,
  useProfile,
  useProposalsForListing,
  useRespondToProposal,
} from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { DetailTopBar } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { ScreenState, type ScreenStatus } from '@/components/ui/ScreenState';

type Sort = 'price' | 'date';

export function SammenlignTilbudScreen({ listingId }: { listingId: string }) {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: listing } = useListing(listingId);
  const { data, isLoading, isError, refetch } = useProposalsForListing(listingId);
  const [sort, setSort] = useState<Sort>('price');

  const proposals = useMemo(() => {
    const list = [...(data ?? [])];
    if (sort === 'price') list.sort((a, b) => a.price.amountMinor - b.price.amountMinor);
    else if (sort === 'date')
      list.sort(
        (a, b) => Date.parse(a.scheduledText ?? '') - Date.parse(b.scheduledText ?? ''),
      );
    return list;
  }, [data, sort]);

  const cheapest = useMemo(
    () =>
      (data ?? []).reduce<string | undefined>(
        (min, p) =>
          min == null ||
          p.price.amountMinor < (data ?? []).find((x) => x.id === min)!.price.amountMinor
            ? p.id
            : min,
        undefined,
      ),
    [data],
  );

  let status: ScreenStatus = 'ready';
  if (isLoading) status = 'loading';
  else if (isError) status = 'error';
  else if (proposals.length === 0) status = 'empty';

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <DetailTopBar
        title={nb.tilbud.compareTitle}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/tilbud'))}
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        onProfilePress={() => safePush('/profil')}
        onNotificationsPress={() => safePush('/varsler')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{nb.tilbud.compareTitle}</ScreenTitle>
        <AppText variant="body" color="navyMuted">
          {proposals.length} {nb.tilbud.compareSub} · {listing?.title}
        </AppText>

        <View style={styles.sortRow}>
          {(
            [
              ['price', nb.tilbud.sortPrice],
              ['date', nb.tilbud.sortDate],
            ] as [Sort, string][]
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: sort === value }}
              onPress={() => setSort(value)}
            >
              <StatusPill label={label} tone={sort === value ? 'lime' : 'neutral'} filled={sort === value} soft={sort !== value} />
            </Pressable>
          ))}
        </View>

        {status === 'ready' ? (
          proposals.map((p) => (
            <CompareRow key={p.id} proposal={p} isCheap={p.id === cheapest} />
          ))
        ) : (
          <ScreenState status={status} onRetry={() => refetch()} emptyText={nb.tilbud.empty} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CompareRow({ proposal: p, isCheap }: { proposal: Proposal; isCheap: boolean }) {
  const router = useRouter();
  const { data: from } = useProfile(p.fromProfileId);
  const respond = useRespondToProposal(p.conversationId);
  const canAct = p.status === 'SENT';

  const accept = async () => {
    const ok = await confirm({
      title: nb.tilbud.acceptConfirm,
      message: `${from?.displayName ?? 'Tilbyder'} · ${formatPrice(p.price)}`,
      confirmLabel: nb.tilbud.accept,
    });
    if (!ok) return;
    respond.mutate(
      { proposalId: p.id, event: 'ACCEPT', actor: 'RECIPIENT' },
      {
        onSuccess: () => {
          haptics.success();
          router.replace(`/avtale/${p.id}`);
        },
        onError: () => toast.error(nb.toast.genericError),
      },
    );
  };

  return (
    <View style={[styles.row, isCheap && styles.rowCheap]}>
      <View style={styles.rowHead}>
        <Avatar uri={from?.avatarUrl} initials={from?.initials ?? '?'} size={40} />
        <View style={styles.rowWho}>
          <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
            {from?.displayName ?? 'Tilbyder'}
          </AppText>
          {from?.rating ? (
            <View style={styles.ratingRow}>
              <Icon name="star" size={12} color="star" />
              <AppText variant="meta" color="navyMuted">
                {from.rating.average.toLocaleString('nb-NO', { minimumFractionDigits: 1 })} ({from.rating.count})
              </AppText>
            </View>
          ) : null}
        </View>
        {isCheap ? <StatusPill label={nb.tilbud.lowest} tone="lime" soft /> : null}
      </View>

      <View style={styles.grid}>
        <Cell label={nb.tilbud.proposedPrice} value={formatPrice(p.price)} strong />
        <Cell label={nb.tilbud.when} value={p.scheduledText ?? '–'} />
      </View>
      {p.caveats ? <Cell label={nb.tilbud.caveats} value={p.caveats} /> : null}
      {p.message ? (
        <AppText variant="meta" color="navyMuted">
          “{p.message}”
        </AppText>
      ) : null}

      <View style={styles.actions}>
        {canAct ? (
          <Button
            label={nb.tilbud.accept}
            onPress={accept}
            loading={respond.isPending}
            iconRight="check"
            style={styles.acceptBtn}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.tilbud.detailTitle}
          hitSlop={8}
          onPress={() => safePush(`/tilbud/${p.id}`)}
          style={styles.detailLink}
        >
          <AppText variant="meta" weight="bold" color="cyan">
            {nb.tilbud.detailTitle} ›
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.cell}>
      <AppText variant="meta" color="navyMuted">
        {label}
      </AppText>
      <AppText variant={strong ? 'cardTitle' : 'body'} weight={strong ? 'extrabold' : 'regular'} color={strong ? 'lime' : 'navy'}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxxl },
  row: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    ...tokens.shadow.card,
  },
  rowCheap: { borderColor: tokens.color.lime, borderWidth: 1.5 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  rowWho: { flex: 1, gap: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  grid: { flexDirection: 'row', gap: tokens.space.lg },
  cell: { flex: 1, gap: 2 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm, marginBottom: tokens.space.xs },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    marginTop: tokens.space.xs,
  },
  acceptBtn: { flex: 1 },
  detailLink: { paddingVertical: 4 },
});
