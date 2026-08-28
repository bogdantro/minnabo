import { useSyncExternalStore, useState } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { formatPrice, nok } from '@/domain/price';
import { formatRelative } from '@/lib/datetime';
import { safetyStore } from '@/data/safetyStore';
import { repositories } from '@/data/repositories';
import { profiles } from '@/data/seed';
import { documentedDonations } from '@/data/seedCommunity';
import { profileRepository } from '@/data/profileRepository';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';

type Tab = 'reports' | 'listings' | 'users' | 'donations';

export function AdminScreen() {
  const [tab, setTab] = useState<Tab>('reports');
  useSyncExternalStore(safetyStore.subscribe, safetyStore.version, safetyStore.version);
  const reports = safetyStore.listReports();

  const listings = repositories.listings.list();
  const users = Object.values(profiles);

  const stats = [
    { label: nb.admin.statTotalUsers, value: String(users.length) },
    { label: nb.admin.statActiveListings, value: String(listings.length) },
    { label: nb.admin.statOpenReports, value: String(safetyStore.openReportCount()) },
    { label: nb.admin.statCompleted, value: '37' },
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
              ['users', nb.admin.users],
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
            reports.map((r) => {
              const done = safetyStore.isResolved(r.id);
              const by = profileRepository.getProfile(r.byProfileId);
              return (
                <View key={r.id} style={styles.card}>
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
                      onPress={() => safetyStore.resolveReport(r.id)}
                      style={styles.cardBtn}
                    />
                  )}
                </View>
              );
            })
          )
        ) : null}

        {tab === 'listings'
          ? listings.slice(0, 12).map((l) => (
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
                <StatusPill label={l.type === 'TASK_REQUEST' ? nb.badge.needsHelp : nb.badge.offersHelp} tone={l.type === 'TASK_REQUEST' ? 'lime' : 'cyan'} soft />
              </View>
            ))
          : null}

        {tab === 'users'
          ? users.map((u) => (
              <View key={u.id} style={styles.rowCard}>
                <Icon name={u.isBusiness ? 'home' : 'user'} size={16} color="navy" />
                <View style={styles.rowBody}>
                  <AppText variant="meta" weight="bold">
                    {u.displayName}
                  </AppText>
                  <AppText variant="meta" color="navyMuted">
                    {u.location.place} · medlem siden {u.memberSince}
                  </AppText>
                </View>
                {u.verifications.some((v) => v.verified) ? (
                  <Icon name="shield" size={15} color="shieldGreen" />
                ) : null}
              </View>
            ))
          : null}

        {tab === 'donations'
          ? documentedDonations.map((d) => (
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
