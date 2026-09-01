import { useMemo } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AgendaItem } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { formatPrice } from '@/domain/price';
import { useMyAgreements, useProfile } from '@/api/queries';
import { safePush } from '@/lib/nav';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { StatusPill } from '@/components/ui/StatusPill';
import { ScreenState } from '@/components/ui/ScreenState';
import { ListingListSkeleton } from '@/components/ui/Skeleton';

export function AgendaScreen() {
  const { data, isLoading, isError, refetch } = useMyAgreements();

  const { upcoming, done } = useMemo(() => {
    const items = data ?? [];
    return {
      upcoming: items.filter((i) => !i.fullyCompleted),
      done: items.filter((i) => i.fullyCompleted),
    };
  }, [data]);

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.agenda.title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{nb.agenda.title}</ScreenTitle>

        {isLoading ? (
          <ListingListSkeleton count={3} />
        ) : isError ? (
          <ScreenState status="error" onRetry={() => refetch()} />
        ) : (data ?? []).length === 0 ? (
          <ScreenState status="empty" emptyText={nb.agenda.empty} />
        ) : (
          <>
            {upcoming.length > 0 ? (
              <Section title={nb.agenda.upcoming} items={upcoming} />
            ) : null}
            {done.length > 0 ? <Section title={nb.agenda.done} items={done} /> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, items }: { title: string; items: AgendaItem[] }) {
  return (
    <View style={styles.section}>
      <AppText variant="meta" weight="bold" color="navyMuted">
        {title.toUpperCase()}
      </AppText>
      {items.map((item) => (
        <AgendaRow key={item.proposalId} item={item} />
      ))}
    </View>
  );
}

function AgendaRow({ item }: { item: AgendaItem }) {
  const { data: other } = useProfile(item.counterpartId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.listingTitle}
      onPress={() => safePush(`/avtale/${item.proposalId}`)}
      style={styles.row}
    >
      <Avatar uri={other?.avatarUrl} initials={other?.initials ?? '?'} size={40} ring={false} />
      <View style={styles.rowBody}>
        <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
          {item.listingTitle}
        </AppText>
        <AppText variant="meta" color="navyMuted" numberOfLines={1}>
          {other?.displayName ?? 'Motpart'} · {formatPrice(item.price)}
        </AppText>
        {item.scheduledText ? (
          <View style={styles.metaRow}>
            <Icon name="calendar" size={12} color="cyan" />
            <AppText variant="meta" color="navyMuted">
              {item.scheduledText}
            </AppText>
          </View>
        ) : null}
      </View>
      {item.fullyCompleted ? <StatusPill label={nb.agenda.completed} tone="lime" /> : null}
      <Icon name="chevron-right" size={16} color="navyMuted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.lg, paddingBottom: tokens.space.xxxl },
  section: { gap: tokens.space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    ...tokens.shadow.card,
  },
  rowBody: { flex: 1, gap: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
