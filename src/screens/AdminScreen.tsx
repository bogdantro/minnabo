import { useState } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Report } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { formatPrice, nok } from '@/domain/price';
import { formatRelative } from '@/lib/datetime';
import {
  useDonations,
  useListings,
  useProfile,
  useReports,
  useResolveReport,
} from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { FallbackScreen } from '@/components/FallbackScreen';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';

type Tab = 'reports' | 'listings' | 'donations';

export function AdminScreen() {
  const me = useCurrentUser();
  const [tab, setTab] = useState<Tab>('reports');
  const { data: reports = [] } = useReports();
  const { data: listings = [] } = useListings({});
  const { data: donations = [] } = useDonations();
  const resolve = useResolveReport();

  if (!me.isLoading && !me.isAdmin) {
    return <FallbackScreen status="noAccess" title={nb.admin.title} />;
  }

  const resolveReport = async (id: string) => {
    const ok = await confirm({
      title: nb.admin.resolveConfirm,
      confirmLabel: nb.admin.resolve,
    });
    if (!ok) return;
    resolve.mutate(id, {
      onSuccess: () => toast.success(nb.admin.resolvedToast),
      onError: () => toast.error(nb.toast.genericError),
    });
  };

  const openCount = reports.filter((r) => r.status !== 'RESOLVED').length;
  const stats = [
    { label: nb.admin.statActiveListings, value: String(listings.length) },
    { label: nb.admin.statOpenReports, value: String(openCount) },
    { label: nb.admin.statCompleted, value: String(listings.filter((l) => l.status === 'COMPLETED' || l.status === 'REVIEWED').length) },
  ];

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.admin.title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{nb.admin.title}</ScreenTitle>
        <AppText variant="meta" color="navyMuted">
          {nb.admin.sub}
        </AppText>

        <View style={styles.statGrid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <AppText variant="section" weight="extrabold">
                {s.value}
              </AppText>
              <AppText variant="meta" color="navyMuted">
                {s.label}
              </AppText>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {(
            [
              ['reports', nb.admin.reports],
              ['listings', nb.admin.listings],
              ['donations', nb.admin.donations],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === value }}
              onPress={() => setTab(value)}
              style={[styles.tab, tab === value && styles.tabActive]}
            >
              <AppText variant="meta" weight="bold" color={tab === value ? 'navy' : 'navyMuted'}>
                {label}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>

        {tab === 'reports' ? (
          reports.length === 0 ? (
            <AppText variant="body" color="navyMuted">
              {nb.admin.noReports}
            </AppText>
          ) : (
            reports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                pending={resolve.isPending}
                onResolve={() => resolveReport(r.id)}
              />
            ))
          )
        ) : null}

        {tab === 'listings'
          ? listings.slice(0, 20).map((l) => (
              <View key={l.id} style={styles.rowCard}>
                <Icon name={l.type === 'TASK_REQUEST' ? 'clipboard' : 'user'} size={16} color="cyan" />
                <View style={styles.rowBody}>
                  <AppText variant="meta" weight="bold" numberOfLines={1}>
                    {l.title}
                  </AppText>
                  <AppText variant="meta" color="navyMuted">
                    {l.owner.displayName} · {l.status}
                  </AppText>
                </View>
                <StatusPill
                  label={l.type === 'TASK_REQUEST' ? nb.badge.needsHelp : nb.badge.offersHelp}
                  tone={l.type === 'TASK_REQUEST' ? 'lime' : 'cyan'}
                  soft
                />
              </View>
            ))
          : null}

        {tab === 'donations'
          ? donations.map((d) => (
              <View key={d.id} style={styles.rowCard}>
                <Icon name="heart" size={16} color="lime" />
                <View style={styles.rowBody}>
                  <AppText variant="meta" weight="bold">
                    {formatPrice(nok(d.amountKr))}
                  </AppText>
                  <AppText variant="meta" color="navyMuted">
                    {d.recipient} · {d.period}
                  </AppText>
                </View>
                <StatusPill label="Overført" tone="lime" soft />
              </View>
            ))
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportCard({
  report: r,
  pending,
  onResolve,
}: {
  report: Report;
  pending: boolean;
  onResolve: () => void;
}) {
  const { data: by } = useProfile(r.byProfileId);
  const done = r.status === 'RESOLVED';
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <StatusPill label={r.targetType} tone="neutral" />
        <AppText variant="meta" color="navyMuted">
          {formatRelative(r.createdAt)}
        </AppText>
      </View>
      <AppText variant="cardTitle" weight="bold">
        {r.reason}
      </AppText>
      {r.details ? (
        <AppText variant="meta" color="navyMuted">
          {r.details}
        </AppText>
      ) : null}
      <AppText variant="meta" color="navyMuted">
        Rapportert av {by?.displayName ?? r.byProfileId}
      </AppText>
      {done ? (
        <StatusPill label={nb.admin.resolved} tone="lime" soft />
      ) : (
        <Button
          label={nb.admin.resolve}
          variant="secondary"
          loading={pending}
          onPress={onResolve}
          style={styles.cardBtn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxxl },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  stat: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    gap: 2,
  },
  tabs: { gap: tokens.space.sm, paddingVertical: tokens.space.xs },
  tab: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  tabActive: { borderColor: tokens.color.lime, backgroundColor: tokens.color.limeTint },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    gap: tokens.space.xs,
    ...tokens.shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardBtn: { alignSelf: 'flex-start', marginTop: tokens.space.xs, paddingHorizontal: tokens.space.xl },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.tile,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
  },
  rowBody: { flex: 1, gap: 1 },
});
