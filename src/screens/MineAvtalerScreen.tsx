import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { AgendaItem } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import { formatPrice } from '@/domain/price';
import nb from '@/i18n/nb';
import { useListing, useMyAgreements, useProfile } from '@/api/queries';
import { useSession } from '@/auth/session';
import { shortDate } from '@/lib/datetime';
import {
  addAgreementToCalendar,
  daysUntil,
  deviceCalendarSupported,
  parseAgreedTime,
  parseDurationHours,
} from '@/lib/deviceCalendar';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import {
  Avatar,
  Button,
  CategoryArt,
  Chip,
  ErrorState,
  FadeUp,
  Icon,
  IconButton,
  ListingListSkeleton,
  PaymentNote,
  Pill,
  ScaleIn,
  Screen,
  Segmented,
  StatTile,
  SubHeader,
} from '@/components/ui';

type Seg = 'up' | 'done';
const WD = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const MON = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
const dayKeyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** ISO week number. */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86_400_000 + 1) / 7);
}

/** "Omtrent 3 timer" → "ca. 3 t" (fits the 58 px time column). */
function compactDuration(textValue?: string): string | null {
  if (!textValue) return null;
  const m = /(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+))?\s*(?:t\b|timer|time)/i.exec(textValue);
  if (m) return `ca. ${m[1]}${m[2] ? `–${m[2]}` : ''} t`;
  if (/dag/i.test(textValue)) return 'ca. 1 dag';
  return textValue.length <= 10 ? textValue : null;
}

const relLabel = (d: Date) => {
  const n = daysUntil(d);
  return n < 0 ? nb.agenda.rel.past : n === 0 ? nb.agenda.rel.today : n === 1 ? nb.agenda.rel.tomorrow : nb.agenda.rel.inDays(n);
};

/** Mine avtaler (design/screens/MineAvtaler.dc.html). */
export function MineAvtalerScreen() {
  const router = useRouter();
  const { userId } = useSession();
  const me = useProfile(userId ?? '');
  const { data, isLoading, isError, isFetching, refetch } = useMyAgreements();
  const [seg, setSeg] = useState<Seg>('up');
  const [day, setDay] = useState<string | null>(null);

  const all = useMemo(() => (data ?? []).map((a) => ({ a, at: parseAgreedTime(a.scheduledText) })), [data]);
  const upcoming = all
    .filter(({ a, at }) => !a.fullyCompleted && !a.cancelled && (!at || daysUntil(at) >= 0))
    .sort((x, y) => (x.at?.getTime() ?? Infinity) - (y.at?.getTime() ?? Infinity));
  const done = all.filter(({ a }) => a.fullyCompleted).sort((x, y) => Date.parse(y.a.agreedAt) - Date.parse(x.a.agreedAt));
  const cancelled = all.filter(({ a }) => a.cancelled && !a.fullyCompleted);

  // 14-day strip from Monday of this week.
  const days = useMemo(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    return Array.from({ length: 14 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  }, []);
  const todayKey = dayKeyOf(new Date());
  const byDay = new Map<string, AgendaItem['role']>();
  for (const { a, at } of upcoming) if (at && !byDay.has(dayKeyOf(at))) byDay.set(dayKeyOf(at), a.role);
  const selDay = days.find((d) => dayKeyOf(d) === day);

  const visible = upcoming.filter(({ at }) => !day || (at && dayKeyOf(at) === day));
  const groups: { key: string; label: string; rel: string; items: typeof visible }[] = [];
  for (const it of visible) {
    const key = it.at ? dayKeyOf(it.at) : 'none';
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = it.at
        ? { key, label: shortDate(it.at.toISOString()), rel: relLabel(it.at), items: [] }
        : { key, label: nb.agenda.noDate, rel: nb.agenda.noDateSub, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }

  const first = days[0];
  const last = days[13];
  const monthLabel = selDay
    ? `${nb.agenda.months[selDay.getMonth()]} ${selDay.getFullYear()}`
    : first.getMonth() === last.getMonth()
      ? `${nb.agenda.months[first.getMonth()]} ${first.getFullYear()}`
      : `${nb.agenda.months[first.getMonth()].slice(0, 3)} – ${MON[last.getMonth()]} ${last.getFullYear()}`;
  const weekLabel = selDay
    ? nb.agenda.weekDay(isoWeek(selDay), `${WD[selDay.getDay()]} ${selDay.getDate()}. ${MON[selDay.getMonth()]}`)
    : nb.agenda.weekRange(isoWeek(first), isoWeek(last));

  const calAll = async () => {
    const dated = upcoming.filter((x) => x.at);
    if (!dated.length) {
      toast.info(nb.agenda.calNone, { icon: 'cal' });
      return;
    }
    let ok = 0;
    for (const { a, at } of dated) {
      const res = await addAgreementToCalendar({ title: a.listingTitle, start: at!, hours: parseDurationHours(undefined), notes: formatPrice(a.price) });
      if (res.ok) ok += 1;
      else if (res.reason === 'denied') {
        toast.error(nb.avtaleSum.calDenied);
        return;
      }
    }
    toast.success(nb.agenda.calAllToast(ok), { icon: 'cal' });
  };

  const thisMonth = new Date().getMonth();
  const doneThisMonth = done.filter(({ a }) => new Date(a.agreedAt).getMonth() === thisMonth).length;
  const rating = me.data?.rating;

  return (
    <Screen
      scroll
      header={
        <SubHeader
          title={nb.agenda.title}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          right={
            deviceCalendarSupported ? (
              <IconButton icon="cal" iconSize={18} accessibilityLabel={nb.agenda.calAll} onPress={() => void calAll()} />
            ) : undefined
          }
        />
      }
      scrollProps={{
        refreshControl: <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={colors.limeDeep} />,
      }}
    >
      <FadeUp style={[styles.px, styles.mt4]}>
        <Segmented
          accessibilityLabel={nb.agenda.segLabel}
          countStyle="inline"
          options={[
            { value: 'up', label: nb.agenda.upcoming, count: upcoming.length },
            { value: 'done', label: nb.agenda.done, count: done.length },
          ]}
          value={seg}
          onChange={setSeg}
        />
      </FadeUp>

      {isLoading ? (
        <View style={styles.mt20}>
          <ListingListSkeleton count={2} />
        </View>
      ) : isError ? (
        <View style={styles.errorBox}>
          <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
        </View>
      ) : seg === 'up' ? (
        <View>
          <FadeUp delay={50} style={[styles.px, styles.monthRow]}>
            <View style={styles.gap4}>
              <Text style={styles.month}>{monthLabel}</Text>
              <Text style={text.meta}>{weekLabel}</Text>
            </View>
            {day ? (
              <ScaleIn>
                <Chip label={nb.agenda.showAll} icon="x" size="sm" onPress={() => setDay(null)} />
              </ScaleIn>
            ) : null}
          </FadeUp>

          <FadeUp delay={100}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.week}
              accessibilityRole="list"
              accessibilityLabel={nb.agenda.pickDay}
            >
              {days.map((d, i) => {
                const key = dayKeyOf(d);
                const on = day === key;
                const isToday = key === todayKey;
                const past = d.getTime() < new Date().setHours(0, 0, 0, 0);
                const dot = byDay.get(key);
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${WD[d.getDay()]} ${d.getDate()}. ${MON[d.getMonth()]}${isToday ? nb.agenda.today : ''}${dot ? nb.agenda.hasDeal : ''}`}
                    onPress={() => setDay(on ? null : key)}
                    style={({ pressed }) => [
                      styles.wd,
                      i === 7 && styles.wk2,
                      isToday && styles.wdToday,
                      on && styles.wdOn,
                      pressed && styles.pressed,
                    ]}
                  >
                    {i === 7 ? <View style={styles.wkSep} /> : null}
                    <Text style={[styles.wdSmall, past && !on && styles.past, on && styles.onText]}>{WD[d.getDay()]}</Text>
                    <Text style={[styles.wdNum, past && !on && styles.past, on && styles.onText]}>{d.getDate()}</Text>
                    <View style={[styles.dot, dot === 'HELPER' && styles.dotL, dot === 'CLIENT' && styles.dotC]} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </FadeUp>

          <FadeUp delay={150} style={[styles.px, styles.legend]}>
            <Legend color={colors.limeDot} label={nb.agenda.youHelp} />
            <Legend color={colors.cyan} label={nb.agenda.youGetHelp} />
          </FadeUp>

          <View style={styles.px}>
            {groups.map((g, gi) => (
              <FadeUp key={g.key} delay={(gi + 4) * 50}>
                <View style={styles.dh}>
                  <Text style={styles.dhLabel}>{g.label}</Text>
                  <Text style={text.meta}>{g.rel}</Text>
                </View>
                <View style={styles.gap10}>
                  {g.items.map(({ a, at }) => (
                    <AgendaCard key={a.proposalId} item={a} at={at} />
                  ))}
                </View>
              </FadeUp>
            ))}

            {day && visible.length === 0 ? (
              <ScaleIn style={styles.mt20}>
                <EmptyCard
                  icon="cal"
                  title={nb.agenda.emptyDay(selDay ? `${WD[selDay.getDay()].toLowerCase()} ${selDay.getDate()}. ${MON[selDay.getMonth()]}` : '')}
                  sub={nb.agenda.emptyDaySub}
                >
                  <View style={styles.row8}>
                    <Button label={nb.agenda.showAll} variant="ghost" size="sm" block={false} onPress={() => setDay(null)} />
                    <Button label={nb.agenda.findJob} size="sm" block={false} onPress={() => router.replace('/')} />
                  </View>
                </EmptyCard>
              </ScaleIn>
            ) : !day && upcoming.length === 0 ? (
              <ScaleIn style={styles.mt20}>
                <EmptyCard icon="cal" title={nb.agenda.emptyUp} sub={nb.agenda.emptyUpSub}>
                  <Button label={nb.agenda.findJob} size="sm" block={false} onPress={() => router.replace('/')} />
                </EmptyCard>
              </ScaleIn>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={[styles.px, styles.mt20]}>
          <FadeUp style={styles.stats}>
            <StatTile value={String(doneThisMonth)} label={nb.agenda.statDone(nb.agenda.months[thisMonth])} style={styles.flex} />
            <View style={[styles.stat, shadow.card]}>
              <View style={styles.row5}>
                <Icon name="star" size={18} color={colors.star} filled />
                <Text style={text.num}>{rating?.count ? rating.average.toFixed(1).replace('.', ',') : '–'}</Text>
              </View>
              <Text style={text.statLabel}>{rating?.count ? nb.agenda.statRating(rating.count) : nb.agenda.noRating}</Text>
            </View>
          </FadeUp>

          {monthGroups(done.map((d) => d.a)).map((g, gi) => (
            <FadeUp key={g.key} delay={(gi + 1) * 50}>
              <View style={styles.dh}>
                <Text style={styles.dhLabel}>{g.label}</Text>
                <Text style={text.meta}>{nb.agenda.deals(g.items.length)}</Text>
              </View>
              <View style={styles.gap10}>
                {g.items.map((a) => (
                  <DoneCard key={a.proposalId} item={a} />
                ))}
              </View>
            </FadeUp>
          ))}

          {cancelled.length ? (
            <FadeUp delay={200}>
              <View style={styles.dh}>
                <Text style={styles.dhLabel}>{nb.agenda.cancelledGroup}</Text>
                <Text style={text.meta}>{nb.agenda.deals(cancelled.length)}</Text>
              </View>
              <View style={styles.gap10}>
                {cancelled.map(({ a }) => (
                  <DoneCard key={a.proposalId} item={a} />
                ))}
              </View>
            </FadeUp>
          ) : null}

          {done.length === 0 && cancelled.length === 0 ? (
            <ScaleIn style={styles.mt20}>
              <EmptyCard icon="checks" title={nb.agenda.emptyDone} sub={nb.agenda.reviewTip} />
            </ScaleIn>
          ) : (
            <FadeUp delay={250} style={[styles.tip, shadow.card]}>
              <View style={styles.tipIc}>
                <Icon name="thumb" size={16} color={colors.limeDeep} />
              </View>
              <Text style={[text.meta, styles.flex]}>{nb.agenda.reviewTip}</Text>
            </FadeUp>
          )}
        </View>
      )}

      <View style={[styles.px, styles.mt22]}>
        <PaymentNote />
      </View>
      <View style={styles.bottom} />
    </Screen>
  );
}

function monthGroups(items: AgendaItem[]) {
  const out: { key: string; label: string; items: AgendaItem[] }[] = [];
  for (const a of items) {
    const d = parseAgreedTime(a.scheduledText) ?? new Date(a.agreedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let g = out.find((x) => x.key === key);
    if (!g) {
      g = { key, label: nb.agenda.months[d.getMonth()], items: [] };
      out.push(g);
    }
    g.items.push(a);
  }
  return out;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.row6}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={text.meta}>{label}</Text>
    </View>
  );
}

function EmptyCard({ icon, title, sub, children }: { icon: 'cal' | 'checks'; title: string; sub: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIc}>
        <Icon name={icon} size={24} color={colors.cyanDeep} />
      </View>
      <Text style={[text.label, styles.f155, styles.center]}>{title}</Text>
      <Text style={[text.meta, styles.center]}>{sub}</Text>
      {children ? <View style={styles.mt4}>{children}</View> : null}
    </View>
  );
}

function AgendaCard({ item, at }: { item: AgendaItem; at: Date | null }) {
  const { data: other } = useProfile(item.counterpartId);
  const { data: listing } = useListing(item.listingId);
  const helper = item.role === 'HELPER';
  const time = at && /kl\.?\s*\d/.test(item.scheduledText ?? '') ? `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` : '–';
  const place = listing?.location.place || listing?.location.municipality;
  const name = other?.displayName ?? '';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${helper ? nb.agenda.youHelp : nb.agenda.youGetHelp}: ${item.listingTitle}, ${item.scheduledText ?? ''}`}
      onPress={() => safePush(`/avtale/${item.proposalId}`)}
      style={({ pressed }) => [styles.acard, shadow.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.tcol, helper ? styles.tcolL : styles.tcolC]}>
        <Text style={[text.num, styles.f20]}>{time}</Text>
        {compactDuration(listing?.task?.durationText) ? <Text style={text.meta}>{compactDuration(listing?.task?.durationText)}</Text> : null}
      </View>
      <View style={styles.acardBody}>
        <Pill label={helper ? nb.agenda.youHelp : nb.agenda.youGetHelp} tone={helper ? 'need' : 'offer'} icon={helper ? 'hand' : 'user'} style={styles.selfStart} />
        <Text style={[text.label, styles.f16]} numberOfLines={2}>
          {item.listingTitle}
        </Text>
        <View style={styles.row8}>
          <Avatar initials={other?.initials ?? '·'} uri={other?.avatarUrl} seed={item.counterpartId} size={28} />
          <Text style={styles.who} numberOfLines={1}>
            {helper ? nb.agenda.at(name) : nb.agenda.helpsYou(name)}
          </Text>
        </View>
        <View style={styles.row6}>
          <Icon name="pin" size={16} color={colors.faint} />
          <Text style={text.meta} numberOfLines={1}>
            {place ? `${place} · ` : ''}
            <Text style={styles.priceB}>{formatPrice(item.price)}</Text>
          </Text>
        </View>
      </View>
      <Icon name="right" size={18} color={colors.faint} />
    </Pressable>
  );
}

function DoneCard({ item }: { item: AgendaItem }) {
  const { data: other } = useProfile(item.counterpartId);
  const { data: listing } = useListing(item.listingId);
  const cat = categoryArtId(listing?.category.slug ?? 'annet');
  const at = parseAgreedTime(item.scheduledText);
  const when = at ? shortDate(at.toISOString()) : item.scheduledText;
  const needsReview = !item.cancelled && item.fullyCompleted && item.myRating == null;
  return (
    <View style={[styles.fcard, shadow.card]}>
      <Pressable accessibilityRole="link" onPress={() => safePush(`/avtale/${item.proposalId}`)} style={styles.fmain}>
        <CategoryArt category={cat} uri={listing?.images[0]?.url} width={52} height={52} radius={16} iconSize={22} />
        <View style={styles.fText}>
          <Text style={[text.label, styles.f155]} numberOfLines={1}>
            {item.listingTitle}
          </Text>
          <Text style={text.meta} numberOfLines={1}>
            {[other?.displayName, when].filter(Boolean).join(' · ')}
          </Text>
          {item.cancelled ? (
            <Pill label={nb.agenda.cancelledPill} tone="danger" icon="ban" style={styles.selfStart} />
          ) : item.myRating != null ? (
            <Pill label={nb.agenda.reviewed(item.myRating)} tone="ok" icon="star" style={styles.selfStart} />
          ) : (
            <Pill label={nb.agenda.missingReview} tone="warn" icon="star" style={styles.selfStart} />
          )}
        </View>
      </Pressable>
      {needsReview ? (
        <Button label={nb.agenda.giveReview} size="sm" block={false} onPress={() => safePush(`/vurder/${item.proposalId}`)} />
      ) : (
        <Icon name="right" size={18} color={colors.faint} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  px: { paddingHorizontal: screenPadding },
  center: { textAlign: 'center' },
  selfStart: { alignSelf: 'flex-start' },
  pressed: { transform: [{ scale: 0.94 }] },
  cardPressed: { transform: [{ scale: 0.985 }] },
  f155: { fontSize: 15.5 },
  f16: { fontSize: 16, lineHeight: 20 },
  f20: { fontSize: 20, lineHeight: 22 },
  gap4: { gap: 4 },
  gap10: { gap: 10 },
  mt4: { marginTop: 4 },
  mt20: { marginTop: 20 },
  mt22: { marginTop: 22 },
  row5: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorBox: { height: 420 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  month: { fontFamily: text.h3.fontFamily, fontSize: 19, lineHeight: 21, letterSpacing: -0.38, color: colors.ink },
  week: { gap: 6, paddingTop: 4, paddingBottom: 10, paddingHorizontal: screenPadding },
  wd: {
    width: 46,
    height: 68,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  wk2: { marginLeft: 13 },
  wkSep: { position: 'absolute', left: -11, top: 12, bottom: 12, width: 1, backgroundColor: colors.line },
  wdToday: { borderColor: colors.todayBorder, backgroundColor: colors.todayBg },
  wdOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  wdSmall: { fontFamily: text.label.fontFamily, fontSize: 11, letterSpacing: 0.22, color: colors.mute },
  wdNum: { fontFamily: text.h3.fontFamily, fontSize: 18, lineHeight: 20, letterSpacing: -0.36, color: colors.ink },
  past: { opacity: 0.45 },
  onText: { color: colors.white },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotL: { backgroundColor: colors.limeDot },
  dotC: { backgroundColor: colors.cyan },
  legend: { flexDirection: 'row', gap: 14, marginTop: 2 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  dh: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 10, marginHorizontal: 4 },
  dhLabel: { fontFamily: text.h3.fontFamily, fontSize: 17, lineHeight: 19, letterSpacing: -0.34, color: colors.ink },
  acard: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: radius.listingCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
  },
  tcol: { width: 58, alignSelf: 'stretch', gap: 4, paddingRight: 12, borderRightWidth: 3 },
  tcolL: { borderRightColor: colors.todayBorder },
  tcolC: { borderRightColor: colors.cyan },
  acardBody: { flex: 1, minWidth: 0, gap: 7 },
  who: { fontFamily: text.body.fontFamily, fontSize: 13.5, color: colors.ink2, flexShrink: 1 },
  priceB: { fontFamily: text.label.fontFamily, color: colors.ink },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 14, borderRadius: 18, backgroundColor: colors.white, gap: 4 },
  fcard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 14,
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  fmain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  fText: { flex: 1, minWidth: 0, gap: 4 },
  tip: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.card, backgroundColor: colors.white, flexDirection: 'row', gap: 12, alignItems: 'center' },
  tipIc: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  empty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: 20,
    backgroundColor: colors.dashedCardBg,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 10,
  },
  emptyIc: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  bottom: { height: 48 },
});
