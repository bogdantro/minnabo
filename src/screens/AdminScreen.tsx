import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, LinearTransition, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import type { AdminBusiness, AdminDayStat, AdminPartner, AdminReport, AdminUser, ReportOutcome } from '@/api/ApiClient';
import nb from '@/i18n/nb';
import { MAX_MAIN_PARTNERS } from '@/domain/types';
import {
  useAdminBusinesses,
  useAdminOverview,
  useAdminPartners,
  useAdminReports,
  useAdminUsers,
  useDecideBusiness,
  useDecideReport,
  useFlaggedListings,
  useReopenReport,
  useSetListingHidden,
  useSetMainPartner,
  useSetPartnerActive,
  useSetPartnerHero,
  useSetUserSuspended,
  useKommuneWaitlist,
  useWeekStats,
} from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { categoryArtId, categoryBySlug } from '@/domain/categories';
import { lookupOrgNr } from '@/lib/brreg';
import { formatTime, postedAgo } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { apiClient } from '@/api/client';
import { colors, fonts, radius, screenPadding, shadow, sizes, text } from '@/theme/theme';
import { FallbackScreen } from '@/components/FallbackScreen';
import {
  Avatar,
  Button,
  CategoryArt,
  ErrorState,
  FadeUp,
  Icon,
  IconButton,
  Note,
  Pill,
  RowSkeleton,
  ScaleIn,
  Screen,
  Segmented,
  TextLink,
  Toggle,
  type IconName,
  type PillTone,
} from '@/components/ui';

type Tab = 'rap' | 'ver' | 'usr' | 'opp' | 'par' | 'sta';
type Metric = 'o' | 't' | 'f';

const t = nb.admin;
const TAB_ORDER: Tab[] = ['rap', 'ver', 'usr', 'opp', 'par', 'sta'];
const TYPE_ICON: Record<AdminReport['targetType'], IconName> = {
  USER: 'user', LISTING: 'clip', PROPOSAL: 'tag', MESSAGE: 'msg', REVIEW: 'star', NOTICE: 'pinned', COMMENT: 'reply',
};
const OUTCOME_TONE: Record<ReportOutcome, PillTone> = { dismiss: 'neutral', remove: 'danger', warn: 'warn' };
const OUTCOME_TOAST: Record<ReportOutcome, [string, IconName]> = {
  dismiss: [t.dismissed, 'check'],
  remove: [t.removed, 'trash'],
  warn: [t.warned, 'alert'],
};
const BAR_COLOR: Record<Metric, string> = { o: colors.limeDeep, t: colors.cyan2, f: colors.ink };
const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
const DAYS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

/** "tirsdag 29. sep" */
const todayLabel = (d: Date) => `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
/** "923 609 016" */
const orgFmt = (org: string) => org.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
/** Verification card time: "i dag kl. 14:32", "i går", "27. sep". */
function whenLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000,
  );
  if (days <= 0) return `i dag kl. ${formatTime(iso)}`;
  if (days === 1) return 'i går';
  return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}
/** ISO week number of a yyyy-mm-dd date. */
function isoWeek(day: string): number {
  const d = new Date(`${day}T12:00:00Z`);
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((thu.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}
/** "21.–27. sep" / "28. sep–4. okt" */
function weekRange(days: AdminDayStat[]): string {
  if (days.length === 0) return '';
  const a = new Date(`${days[0].day}T12:00:00Z`);
  const b = new Date(`${days[days.length - 1].day}T12:00:00Z`);
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}.–${b.getUTCDate()}. ${MONTHS[b.getUTCMonth()]}`
    : `${a.getUTCDate()}. ${MONTHS[a.getUTCMonth()]}–${b.getUTCDate()}. ${MONTHS[b.getUTCMonth()]}`;
}
const dayLong = (day: string, i: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  return `${DAYS_SHORT[i]} ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
};

/** Adminpanel (design/screens/Admin.dc.html). Admin role only – enforced in the database (0032_admin.sql). */
export function AdminScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const isAdmin = me.isAdmin;
  const [tab, setTab] = useState<Tab>('rap');
  const [now] = useState(() => new Date());

  const overview = useAdminOverview(isAdmin);
  const reports = useAdminReports(isAdmin);
  const businesses = useAdminBusinesses(isAdmin);

  if (!me.isLoading && !isAdmin) {
    return <FallbackScreen status="noAccess" title={t.title} />;
  }

  const openN = (reports.data ?? []).filter((r) => r.status === 'OPEN').length;
  const verN = (businesses.data ?? []).filter((b) => b.status === 'PENDING').length;
  const counts: Partial<Record<Tab, number>> = { rap: openN, ver: verN };

  return (
    <Screen scroll spacer="none">
      {/* header */}
      <View style={styles.head}>
        <IconButton icon="back" accessibilityLabel="Tilbake" onPress={() => (router.canGoBack() ? router.back() : safePush('/innstillinger'))} />
        <View style={styles.headText}>
          <View style={styles.titleRow}>
            <Text style={styles.title} accessibilityRole="header">{t.title}</Text>
            <Pill label={t.badge} tone="dark" icon="shield" size="sm" style={styles.adminPill} />
          </View>
          <Text style={text.meta}>{`${t.region} · ${todayLabel(now)}`}</Text>
        </View>
        <Pressable accessibilityRole="link" accessibilityLabel="Åpne profil" onPress={() => safePush('/profil')} style={styles.avbtn}>
          <Avatar initials={me.initials} uri={me.avatarUrl} me size={38} />
        </Pressable>
      </View>

      {/* KPIs */}
      <View style={styles.kpis}>
        <Kpi i={0} icon="flag" bg={colors.dangerTint} fg={colors.danger} value={overview.data?.openReports ?? openN} label={t.kpiOpen} />
        <Kpi i={1} icon="verified" bg={colors.cyanTint} fg={colors.cyanDeep} value={overview.data?.pendingBusinesses ?? verN} label={t.kpiVer} />
        <Kpi i={2} icon="user" bg={colors.limeTint} fg={colors.limeDeep} value={overview.data?.newUsersToday} label={t.kpiNewUsers} />
        <Kpi i={3} icon="clip" bg={colors.lavenderTint} fg={colors.lavender} value={overview.data?.activeListings} label={t.kpiActive} />
      </View>

      {/* tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsWrap} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
        {TAB_ORDER.map((id) => {
          const on = tab === id;
          const n = counts[id];
          return (
            <Pressable key={id} accessibilityRole="tab" accessibilityLabel={n ? `${t.tabs[id]}, ${n}` : t.tabs[id]} accessibilityState={{ selected: on }} onPress={() => setTab(id)} style={styles.tab}>
              <View style={styles.tabRow}>
                <Text style={[text.tab, { color: on ? colors.ink : colors.mute }]}>{t.tabs[id]}</Text>
                {n ? (
                  <View style={styles.tc}>
                    <Text style={styles.tcText}>{n}</Text>
                  </View>
                ) : null}
              </View>
              {on ? <Animated.View entering={FadeIn.duration(200)} style={styles.tabBar} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.body}>
        {tab === 'rap' ? <ReportsTab q={reports} /> : null}
        {tab === 'ver' ? <VerifyTab q={businesses} now={now} /> : null}
        {tab === 'usr' ? <UsersTab nowYear={String(now.getFullYear())} /> : null}
        {tab === 'opp' ? <ListingsTab /> : null}
        {tab === 'par' ? <PartnersTab /> : null}
        {tab === 'sta' ? <StatsTab /> : null}
      </View>
      <View style={styles.bottom} />
    </Screen>
  );
}

function Kpi({ i, icon, bg, fg, value, label }: { i: number; icon: IconName; bg: string; fg: string; value?: number; label: string }) {
  return (
    <FadeUp delay={i * 50} style={styles.kpiCell}>
      <View style={styles.kpi} accessible accessibilityLabel={`${label}: ${value ?? '–'}`}>
        <View style={[styles.icirc32, { backgroundColor: bg }]}>
          <Icon name={icon} size={16} color={fg} />
        </View>
        <ScaleIn playKey={value}>
          <Text style={styles.kpiNum}>{value ?? '–'}</Text>
        </ScaleIn>
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
    </FadeUp>
  );
}

function Loading() {
  return (
    <View style={styles.list}>
      <RowSkeleton />
      <RowSkeleton />
      <RowSkeleton />
    </View>
  );
}

function Empty({ icon, title, sub }: { icon: IconName; title: string; sub?: string }) {
  return (
    <ScaleIn style={styles.dashCard}>
      <View style={[styles.icirc52, { backgroundColor: colors.okTint }]}>
        <Icon name={icon} size={22} color={colors.ok} />
      </View>
      <Text style={styles.b15}>{title}</Text>
      {sub ? <Text style={text.meta}>{sub}</Text> : null}
    </ScaleIn>
  );
}

// ---------------------------------------------------------------- Rapporter

function ReportsTab({ q }: { q: ReturnType<typeof useAdminReports> }) {
  const decide = useDecideReport();
  const reopen = useReopenReport();
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  const all = q.data ?? [];
  const open = all.filter((r) => r.status === 'OPEN').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const done = all
    .filter((r) => r.status === 'RESOLVED' && r.outcome)
    .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''));

  const act = (r: AdminReport, outcome: ReportOutcome) =>
    decide.mutate(
      { id: r.id, outcome },
      {
        onSuccess: () => toast.success(OUTCOME_TOAST[outcome][0], { icon: OUTCOME_TOAST[outcome][1] }),
        onError: () => toast.error(t.failed),
      },
    );

  return (
    <View style={styles.stack}>
      <View style={styles.between}>
        <Text style={text.eyebrow}>{t.queue(open.length)}</Text>
        <Text style={text.meta}>{t.oldestFirst}</Text>
      </View>
      {open.map((r) => (
        <Animated.View key={r.id} entering={FadeIn} exiting={SlideOutRight.duration(350)} layout={LinearTransition} style={styles.rcard}>
          <View style={styles.rowCenter}>
            <Pill label={t.types[r.targetType]} tone="warn" icon={TYPE_ICON[r.targetType]} />
            <Text style={[text.meta, styles.ml]}>{postedAgo(r.createdAt)}</Text>
          </View>
          <Text style={styles.reason}>{r.reason}</Text>
          <View style={styles.rtarget}>
            <Text style={styles.rtargetText}>{r.targetText}</Text>
            {r.details ? <Text style={[styles.rtargetText, styles.details]}>{r.details}</Text> : null}
          </View>
          {r.attachmentPath ? (
            <TextLink
              label={t.seeScreenshot}
              icon="image"
              onPress={() =>
                void apiClient
                  .getReportAttachmentUrl(r.attachmentPath!)
                  .then((url) => Linking.openURL(url))
                  .catch(() => toast.error(nb.toast.genericError))
              }
            />
          ) : null}
          <Text style={styles.meta125}>{t.reportedBy(r.byName)}</Text>
          <View style={styles.acts}>
            <Button label={t.dismiss} variant="ghost" size="sm" style={styles.act} onPress={() => act(r, 'dismiss')} />
            <Button label={t.remove} variant="dangerGhost" size="sm" style={styles.act} onPress={() => act(r, 'remove')} />
            <Button label={t.warn} variant="ink" size="sm" style={styles.act} onPress={() => act(r, 'warn')} />
          </View>
        </Animated.View>
      ))}
      {open.length === 0 ? <Empty icon="checks" title={t.queueEmpty} sub={t.queueEmptySub} /> : null}
      {done.length > 0 ? (
        <>
          <Text style={[text.eyebrow, styles.mt10]}>{t.handled}</Text>
          <View style={styles.list}>
            {done.map((d, i) => (
              <Animated.View key={d.id} entering={FadeIn} layout={LinearTransition} style={styles.hrow}>
                {i > 0 ? <View style={styles.divider14} /> : null}
                <View style={styles.flex}>
                  <Text style={styles.b14} numberOfLines={1}>{d.reason}</Text>
                  <Text style={text.small}>{`${t.types[d.targetType]} · ${postedAgo(d.resolvedAt ?? d.createdAt)}`}</Text>
                </View>
                <Pill label={t.outcomes[d.outcome!]} tone={OUTCOME_TONE[d.outcome!]} size="sm" />
                <IconButton
                  icon="undo"
                  iconSize={16}
                  variant="ghost"
                  accessibilityLabel={t.undo}
                  onPress={() =>
                    reopen.mutate(d.id, {
                      onSuccess: () => toast.info(t.undone, { icon: 'undo' }),
                      onError: () => toast.error(t.failed),
                    })
                  }
                />
              </Animated.View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Verifisering

function RegistryValue({ orgNr }: { orgNr: string }) {
  const q = useQuery({ queryKey: ['brreg', orgNr], queryFn: () => lookupOrgNr(orgNr), staleTime: 3_600_000, retry: 1 });
  if (q.isLoading) return <Text style={[styles.kvVal, { color: colors.mute }]}>{t.registryChecking}</Text>;
  if (q.data) return <Text style={[styles.kvVal, { color: colors.okText }]}>{t.registryFound}</Text>;
  return <Text style={[styles.kvVal, { color: colors.danger }]}>{q.isError ? '–' : t.registryMissing}</Text>;
}

function VerifyTab({ q, now }: { q: ReturnType<typeof useAdminBusinesses>; now: Date }) {
  const decide = useDecideBusiness();
  const [dir, setDir] = useState<Record<string, 'R' | 'L'>>({});
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  const all = q.data ?? [];
  const pending = all.filter((b) => b.status === 'PENDING');
  const done = all.filter((b) => b.status !== 'PENDING');

  const act = (b: AdminBusiness, approve: boolean) => {
    setDir((d) => ({ ...d, [b.profileId]: approve ? 'R' : 'L' }));
    decide.mutate(
      { profileId: b.profileId, approve },
      {
        onSuccess: () =>
          approve
            ? toast.success(t.approved(b.companyName), { icon: 'verified' })
            : toast.info(t.rejected(b.companyName), { icon: 'x' }),
        onError: () => toast.error(t.failed),
      },
    );
  };

  return (
    <View style={styles.stack}>
      <Text style={text.eyebrow}>{t.waiting(pending.length)}</Text>
      {pending.map((b) => (
        <Animated.View
          key={b.profileId}
          entering={FadeIn}
          exiting={(dir[b.profileId] === 'L' ? SlideOutLeft : SlideOutRight).duration(350)}
          layout={LinearTransition}
          style={styles.rcard}
        >
          <View style={styles.rowCenter12}>
            <View style={[styles.icirc44, { backgroundColor: colors.cyanTint }]}>
              <Icon name="building" size={18} color={colors.cyanDeep} />
            </View>
            <View style={styles.flex3}>
              <Text style={styles.b155}>{b.companyName}</Text>
              <Text style={styles.meta125}>{t.orgLine(orgFmt(b.orgNr), whenLabel(b.createdAt, now))}</Text>
            </View>
          </View>
          <View style={styles.kvCard}>
            <View style={styles.kv}>
              <Text style={styles.kvKey}>{t.contact}</Text>
              <Text style={styles.kvVal}>{b.contactPerson}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.kvKey}>{t.registry}</Text>
              <RegistryValue orgNr={b.orgNr} />
            </View>
            <View style={[styles.kv, styles.kvLast]}>
              <Text style={styles.kvKey}>{t.cats}</Text>
              <Text style={styles.kvVal}>{b.categorySlugs.map((s) => categoryBySlug(s).label).join(', ') || '–'}</Text>
            </View>
          </View>
          <View style={styles.acts}>
            <Button label={t.reject} icon="x" variant="dangerGhost" size="sm" style={styles.act} onPress={() => act(b, false)} />
            <Button label={t.approve} icon="check" variant="lime" size="sm" style={styles.act} onPress={() => act(b, true)} />
          </View>
        </Animated.View>
      ))}
      {pending.length === 0 ? <Empty icon="verified" title={t.noPending} /> : null}
      {done.length > 0 ? (
        <>
          <Text style={[text.eyebrow, styles.mt10]}>{t.handled}</Text>
          <View style={styles.list}>
            {done.map((d, i) => (
              <Animated.View key={d.profileId} entering={FadeIn} style={styles.hrow}>
                {i > 0 ? <View style={styles.divider14} /> : null}
                <View style={styles.flex}>
                  <Text style={styles.b14}>{d.companyName}</Text>
                  <Text style={text.small}>{t.org(orgFmt(d.orgNr))}</Text>
                </View>
                <Pill label={d.status === 'APPROVED' ? t.verified : t.declined} tone={d.status === 'APPROVED' ? 'ok' : 'danger'} size="sm" />
              </Animated.View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Brukere

function userMeta(u: AdminUser, nowYear: string): string {
  const parts = [u.place ?? u.municipality ?? ''];
  if (u.rating !== null) parts.push(`★ ${u.rating.toFixed(1).replace('.', ',')}${u.ratingCount ? ` (${u.ratingCount})` : ''}`);
  parts.push(u.memberSince === nowYear ? t.newThisYear : t.since(u.memberSince));
  return parts.filter(Boolean).join(' · ');
}

function UsersTab({ nowYear }: { nowYear: string }) {
  const [q, setQ] = useState('');
  const query = q.trim();
  const users = useAdminUsers(query);
  const suspend = useSetUserSuspended();
  // optimistic switch state until the list refetches
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const list = users.data ?? [];
  const isOn = (u: AdminUser) => local[u.id] ?? u.suspended;
  const suspendedN = list.filter(isOn).length;

  const flip = (u: AdminUser) => {
    const on = !isOn(u);
    setLocal((l) => ({ ...l, [u.id]: on }));
    suspend.mutate(
      { id: u.id, suspended: on },
      {
        onSuccess: () => (on ? toast.info(t.suspendedToast(u.displayName), { icon: 'ban' }) : toast.success(t.activeToast(u.displayName))),
        onError: () => {
          setLocal((l) => ({ ...l, [u.id]: !on }));
          toast.error(t.failed);
        },
      },
    );
  };

  return (
    <View style={styles.stack}>
      <View style={styles.search}>
        <Icon name="search" size={20} color={colors.mute} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t.searchPh}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={t.searchAria}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {q ? (
          <ScaleIn>
            <IconButton icon="x" iconSize={16} variant="ghost" accessibilityLabel={t.clear} onPress={() => setQ('')} />
          </ScaleIn>
        ) : null}
      </View>
      {users.isLoading ? (
        <Loading />
      ) : users.isError ? (
        <ErrorState onRetry={() => void users.refetch()} retrying={users.isFetching} />
      ) : (
        <>
          <Text style={text.meta}>{t.userCount(list.length, suspendedN)}</Text>
          {list.length > 0 ? (
            <View style={styles.list}>
              {list.map((u, i) => {
                const on = isOn(u);
                return (
                  <View key={u.id} style={styles.urow}>
                    {i > 0 ? <View style={styles.divider66} /> : null}
                    <Avatar initials={u.initials} uri={u.avatarUrl} seed={u.id} size={40} />
                    <View style={styles.flex3}>
                      <View style={styles.rowCenter6}>
                        <Text style={styles.b145} numberOfLines={1}>{u.displayName}</Text>
                        {on ? (
                          <ScaleIn>
                            <Pill label={t.suspended} tone="danger" size="sm" />
                          </ScaleIn>
                        ) : null}
                      </View>
                      <Text style={styles.meta125} numberOfLines={1}>{userMeta(u, nowYear)}</Text>
                    </View>
                    {u.isAdmin ? null : (
                      <View style={styles.susp}>
                        <Toggle value={on} onValueChange={() => flip(u)} tone="danger" size="sm" accessibilityLabel={t.suspendAria(u.displayName)} />
                        <Text style={styles.suspLabel} importantForAccessibility="no">{t.suspend}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[text.meta, styles.center]}>{query ? t.noUsers(query) : t.noUsers('')}</Text>
          )}
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- Oppføringer

function ListingsTab() {
  const q = useFlaggedListings();
  const setHidden = useSetListingHidden();
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  const list = q.data ?? [];
  return (
    <View style={styles.stack}>
      <Text style={text.eyebrow}>{t.flagged}</Text>
      {list.length === 0 ? <Empty icon="checks" title={t.noFlagged} /> : null}
      {list.map((l) => {
        const toggle = () =>
          setHidden.mutate(
            { id: l.id, hidden: !l.hidden },
            {
              onSuccess: () => (l.hidden ? toast.success(t.shownToast) : toast.info(t.hiddenToast, { icon: 'eye' })),
              onError: () => toast.error(t.failed),
            },
          );
        return (
          <Animated.View key={l.id} layout={LinearTransition} style={[styles.rcard, styles.lrow, l.hidden && styles.hid]}>
            <CategoryArt category={categoryArtId(l.categorySlug)} width={64} height={72} radius={14} iconSize={26} />
            <View style={styles.flex5}>
              <Pill label={t.kindOppdrag} tone="need" dot size="sm" style={styles.selfStart} />
              <Text style={styles.b145} numberOfLines={1}>{l.title}</Text>
              <View style={styles.rowCenter4}>
                <Icon name="flag" size={14} color={colors.danger} />
                <Text style={text.small} numberOfLines={1}>{t.flagLine(l.reportCount, l.lastReason)}</Text>
              </View>
            </View>
            {l.hidden ? (
              <Button label={t.show} icon="undo" variant="ghost" size="sm" block={false} onPress={toggle} />
            ) : (
              <Button label={t.hide} icon="eye" variant="dangerGhost" size="sm" block={false} onPress={toggle} />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Partnere

function PartnersTab() {
  const q = useAdminPartners();
  const setMain = useSetMainPartner();
  const setActive = useSetPartnerActive();
  const setHero = useSetPartnerHero();
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  const all = q.data ?? [];
  const mains = all.filter((p) => p.main);
  const full = mains.length >= MAX_MAIN_PARTNERS;
  const sorted = [...mains, ...all.filter((p) => !p.main)];
  const sups = all.filter((p) => !p.main);

  const flipMain = (p: AdminPartner) => {
    if (!p.main && full) {
      toast.info(t.maxMain, { icon: 'alert' });
      return;
    }
    setMain.mutate(
      { id: p.id, main: !p.main },
      {
        onSuccess: () => (p.main ? toast.info(t.mainOff(p.name), { icon: 'x' }) : toast.success(t.mainOn(p.name), { icon: 'award' })),
        onError: (e) => toast.error(e instanceof Error && e.message.includes('Maks') ? t.maxMain : t.failed),
      },
    );
  };
  const flipHero = (p: AdminPartner) =>
    setHero.mutate(
      { id: p.id, hero: !p.hero },
      { onSuccess: () => toast.success(p.hero ? t.heroOff(p.name) : t.heroOn(p.name), { icon: 'heart' }), onError: () => toast.error(t.failed) },
    );
  const flipSup = (p: AdminPartner) =>
    setActive.mutate(
      { id: p.id, active: !p.active },
      { onSuccess: () => toast.success(p.active ? t.supOff : t.supOn), onError: () => toast.error(t.failed) },
    );

  if (all.length === 0) return <Empty icon="building" title={t.noPartners} />;

  return (
    <View style={styles.stack}>
      <View style={styles.between}>
        <Text style={text.eyebrow}>{t.mains}</Text>
        <Pill label={`${mains.length} / ${MAX_MAIN_PARTNERS}`} tone={full ? 'dark' : 'line'} size="sm" />
      </View>
      <View style={styles.slots}>
        {Array.from({ length: MAX_MAIN_PARTNERS }, (_, i) => i).map((i) => {
          const m = mains[i];
          return (
            <View key={i} style={[styles.slot, m && styles.slotOn]}>
              <Icon name={m ? 'award' : 'plus'} size={18} color={m ? colors.ink : colors.mute} />
              <Text style={[styles.slotText, m && { color: colors.ink }]} numberOfLines={1}>{m ? m.name : t.freeSlot}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.list}>
        {sorted.map((p, i) => {
          const dis = !p.main && full;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="switch"
              accessibilityLabel={p.name}
              accessibilityState={{ checked: p.main, disabled: dis }}
              onPress={() => flipMain(p)}
              style={styles.prow}
            >
              {i > 0 ? <View style={styles.divider14} /> : null}
              <View style={styles.lph}>
                <Icon name="building" size={18} color={colors.faint} />
              </View>
              <View style={styles.flex3}>
                <Text style={styles.b145}>{p.name}</Text>
                <Text style={styles.meta125}>{p.main ? t.onFellesskap : dis ? t.noSlot : t.notShown}</Text>
              </View>
              <View style={dis ? styles.dim : null} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Toggle value={p.main} onValueChange={() => flipMain(p)} accessibilityLabel={p.name} />
              </View>
            </Pressable>
          );
        })}
      </View>
      {full ? (
        <FadeUp style={styles.fullNote}>
          <Icon name="info" size={16} color={colors.warn} />
          <Text style={styles.fullNoteText}>{t.full}</Text>
        </FadeUp>
      ) : null}
      {sups.length > 0 ? (
        <>
          <Text style={[text.eyebrow, styles.mt12]}>{t.supporters}</Text>
          <View style={styles.list}>
            {sups.map((p, i) => (
              <Pressable
                key={p.id}
                accessibilityRole="switch"
                accessibilityLabel={p.name}
                accessibilityState={{ checked: p.active }}
                onPress={() => flipSup(p)}
                style={styles.prow}
              >
                {i > 0 ? <View style={styles.divider14} /> : null}
                <View style={[styles.lph, styles.round]}>
                  <Icon name="building" size={16} color={colors.faint} />
                </View>
                <View style={styles.flex3}>
                  <Text style={styles.b145}>{p.name}</Text>
                  <Text style={styles.meta125}>{[p.blurb, p.municipality].filter(Boolean).join(' · ')}</Text>
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityLabel={t.heroAria(p.name)}
                    accessibilityState={{ checked: !!p.hero }}
                    hitSlop={10}
                    onPress={() => flipHero(p)}
                    style={[styles.heroChip, p.hero && styles.heroChipOn]}
                  >
                    <Icon name="heart" size={14} color={p.hero ? colors.limeDeep : colors.mute} />
                    <Text style={[styles.heroChipText, p.hero && { color: colors.limeDeep }]}>{t.hero}</Text>
                  </Pressable>
                </View>
                <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <Toggle value={p.active} onValueChange={() => flipSup(p)} accessibilityLabel={p.name} />
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <Note>{t.partnerNote}</Note>
    </View>
  );
}

// ---------------------------------------------------------------- Statistikk

function StatsTab() {
  const q = useWeekStats();
  const { data: waitlist } = useKommuneWaitlist();
  const [metric, setMetric] = useState<Metric>('o');
  const [day, setDay] = useState<number | null>(null);
  const days = useMemo(() => q.data ?? [], [q.data]);
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} retrying={q.isFetching} />;

  const pick = (d: AdminDayStat) => (metric === 'o' ? d.listings : metric === 't' ? d.offers : d.completed);
  const vals = days.map(pick);
  const max = Math.max(1, ...vals);
  const sel = day ?? Math.max(0, vals.indexOf(Math.max(...vals)));
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const label = t.metricLabels[metric];

  return (
    <View style={styles.stack14}>
      <Segmented
        options={(['o', 't', 'f'] as Metric[]).map((m) => ({ value: m, label: t.metrics[m] }))}
        value={metric}
        onChange={(m) => {
          setMetric(m);
          setDay(null);
        }}
      />
      <View style={styles.card}>
        <Text style={text.eyebrow}>{days.length ? t.week(isoWeek(days[0].day), weekRange(days)) : ''}</Text>
        <View style={styles.totalRow}>
          <Text style={styles.total}>{sum(vals)}</Text>
          <Text style={text.meta}>{label}</Text>
        </View>
        <Text style={[text.meta, styles.readout]}>
          {days[sel] ? `${dayLong(days[sel].day, sel)}: ${vals[sel]} ${label}${day === null ? t.busiest : ''}` : ''}
        </Text>
        <View style={styles.bars}>
          {days.map((d, i) => (
            <Pressable
              key={d.day}
              accessibilityRole="button"
              accessibilityLabel={`${dayLong(d.day, i)}: ${vals[i]} ${label}`}
              onPress={() => setDay(i)}
              style={styles.brow}
            >
              <Text style={styles.bday}>{DAYS_SHORT[i]}</Text>
              <View style={styles.bar}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.round((vals[i] / max) * 100)}%`, backgroundColor: BAR_COLOR[metric], opacity: i === sel ? 1 : 0.45 },
                  ]}
                />
              </View>
              <Text style={styles.bval}>{i === sel ? String(vals[i]) : ''}</Text>
            </Pressable>
          ))}
        </View>
        <Note style={styles.mt12}>{t.tapDay}</Note>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{sum(days.map((d) => d.listings))}</Text>
          <Text style={text.statLabel}>{t.sumO}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{sum(days.map((d) => d.offers))}</Text>
          <Text style={text.statLabel}>{t.sumT}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{sum(days.map((d) => d.completed))}</Text>
          <Text style={text.statLabel}>{t.sumF}</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={text.eyebrow}>{nb.waitlist.adminTitle}</Text>
        {(waitlist ?? []).length === 0 ? (
          <Text style={[text.meta, styles.mt10]}>{nb.waitlist.adminEmpty}</Text>
        ) : (
          (waitlist ?? []).map((w) => (
            <View key={w.kommune} style={styles.waitRow}>
              <Text style={[text.label, styles.waitName]}>{w.kommune}</Text>
              <Text style={text.meta}>{nb.waitlist.adminCount(w.count)}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  waitRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40, gap: 10 },
  waitName: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 56, paddingHorizontal: 16, paddingBottom: 6 },
  headText: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 22, letterSpacing: -0.44, color: colors.ink },
  adminPill: { height: 22 },
  avbtn: { width: sizes.minTouch, height: sizes.minTouch, alignItems: 'center', justifyContent: 'center' },

  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: screenPadding, marginTop: 14 },
  kpiCell: { width: '48%', flexGrow: 1 },
  kpi: { padding: 14, borderRadius: 20, backgroundColor: colors.white, gap: 8, ...shadow.card },
  kpiNum: { fontFamily: fonts.display, fontSize: 28, lineHeight: 28, letterSpacing: -0.84, color: colors.ink },
  kpiLabel: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16, color: colors.mute },
  icirc32: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  icirc44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  icirc52: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },

  tabsWrap: { marginTop: 20, flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.line },
  tabs: { gap: 20, paddingHorizontal: screenPadding },
  tab: { height: sizes.tab, justifyContent: 'center' },
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.ink },
  tc: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.notifDot, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  tcText: { fontFamily: fonts.bodyHeavy, fontSize: 11, lineHeight: 13, color: colors.white },

  body: { paddingHorizontal: screenPadding, marginTop: 16 },
  bottom: { height: 60 },
  stack: { gap: 12 },
  stack14: { gap: 14 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowCenter12: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCenter6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowCenter4: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ml: { marginLeft: 'auto', fontSize: 12 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  flex: { flex: 1, minWidth: 0 },
  flex3: { flex: 1, minWidth: 0, gap: 3 },
  flex5: { flex: 1, minWidth: 0, gap: 5 },
  selfStart: { alignSelf: 'flex-start' },
  center: { textAlign: 'center', padding: 20 },

  rcard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadow.card,
  },
  reason: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 20, color: colors.ink },
  rtarget: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    borderLeftWidth: 3,
    borderLeftColor: colors.jurBorder,
    gap: 4,
  },
  rtargetText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.ink2 },
  details: { color: colors.mute },
  meta125: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16, color: colors.mute },
  acts: { flexDirection: 'row', gap: 6 },
  act: { flex: 1, height: 40, paddingHorizontal: 8 },

  dashCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  b14: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18, color: colors.ink },
  b145: { fontFamily: fonts.bodyBold, fontSize: 14.5, lineHeight: 18, color: colors.ink, flexShrink: 1 },
  b15: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20, color: colors.ink },
  b155: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 20, color: colors.ink },

  list: { backgroundColor: colors.white, borderRadius: radius.card, overflow: 'hidden', ...shadow.card },
  hrow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  divider14: { position: 'absolute', top: 0, left: 14, right: 0, height: 1, backgroundColor: colors.line2 },
  divider66: { position: 'absolute', top: 0, left: 66, right: 0, height: 1, backgroundColor: colors.line2 },

  kvCard: { backgroundColor: colors.surface2, borderRadius: radius.m, paddingVertical: 2, paddingHorizontal: 12 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.line2 },
  kvLast: { borderBottomWidth: 0 },
  kvKey: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18, color: colors.mute },
  kvVal: { fontFamily: fonts.bodyBold, fontSize: 13.5, lineHeight: 18, color: colors.ink, flexShrink: 1, textAlign: 'right' },

  search: {
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 18,
    paddingRight: 6,
    ...shadow.card,
  },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.bodyMedium, fontSize: 15.5, color: colors.ink },
  urow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 14, paddingRight: 8 },
  susp: { alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 60, minHeight: 48 },
  suspLabel: { fontFamily: fonts.bodyBold, fontSize: 10.5, lineHeight: 11, color: colors.mute },

  lrow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hid: { opacity: 0.55 },

  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    flexGrow: 1,
    flexBasis: '45%',
    height: 84,
    borderRadius: radius.tile,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    backgroundColor: colors.dashedCardBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  slotOn: { borderStyle: 'solid', borderColor: colors.ink, backgroundColor: colors.white, ...shadow.card },
  slotText: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 16, color: colors.mute },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    height: 26,
    paddingHorizontal: 10,
    marginTop: 6,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  heroChipOn: { backgroundColor: colors.limeTint, borderColor: colors.chipLimeBorder },
  heroChipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.mute },
  prow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: sizes.minTouch },
  lph: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.control,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: { borderRadius: 20 },
  dim: { opacity: 0.4 },
  fullNote: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.m, backgroundColor: colors.warnTint },
  fullNoteText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18, color: colors.warn },

  card: { backgroundColor: colors.white, borderRadius: radius.card, padding: 18, ...shadow.card },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  total: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, letterSpacing: -0.68, color: colors.ink },
  readout: { marginTop: 4, minHeight: 18 },
  bars: { marginTop: 14, gap: 2 },
  brow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  bday: { width: 34, fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 16, color: colors.mute },
  bar: { flex: 1, height: 22, borderTopRightRadius: 6, borderBottomRightRadius: 6, backgroundColor: colors.line2, overflow: 'hidden' },
  barFill: { height: '100%', borderTopRightRadius: 6, borderBottomRightRadius: 6 },
  bval: { width: 34, textAlign: 'right', fontFamily: fonts.display, fontSize: 14, lineHeight: 16, color: colors.ink },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 14, borderRadius: radius.tile, backgroundColor: colors.white, gap: 4, ...shadow.card },
  statNum: { fontFamily: fonts.display, fontSize: 22, lineHeight: 22, letterSpacing: -0.44, color: colors.ink },
});
