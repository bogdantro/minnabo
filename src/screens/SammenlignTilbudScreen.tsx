import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { Proposal, PublicProfile } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import { formatPrice } from '@/domain/price';
import nb from '@/i18n/nb';
import { apiClient } from '@/api/client';
import { profileKeys, useListing, useProposalsForListing, useReplyMinutes } from '@/api/queries';
import { replyTime } from '@/lib/datetime';
import { agreedDate } from '@/lib/deviceCalendar';
import { safePush } from '@/lib/nav';
import { colors, fonts, motion, radius, screenPadding, shadow, text } from '@/theme/theme';
import {
  Avatar,
  Button,
  CategoryArt,
  ErrorState,
  FadeUp,
  Icon,
  IconButton,
  ListingListSkeleton,
  PaymentNote,
  Pill,
  Radio,
  ScaleIn,
  Screen,
  Segmented,
  SlideIn,
  StickyFooter,
  SubHeader,
} from '@/components/ui';

type Sort = 'pris' | 'vurdering' | 'dato';
type Row = { p: Proposal; from?: PublicProfile; kr: number };
const COL_W = 164;
const kr = (n: number) => formatPrice({ amountMinor: n * 100, currency: 'NOK' });
const OPEN = ['SENT', 'REVISION_PENDING', 'ACCEPTED'];

/** Sammenlign tilbud (design/screens/Sammenlign.dc.html). */
export function SammenlignTilbudScreen({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { data: listing } = useListing(listingId);
  const { data, isLoading, isError, isFetching, refetch } = useProposalsForListing(listingId);
  const [sort, setSort] = useState<Sort>('pris');
  const [sel, setSel] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const proposals = useMemo(() => (data ?? []).filter((p) => OPEN.includes(p.status)), [data]);
  const profiles = useQueries({
    queries: proposals.map((p) => ({
      queryKey: profileKeys.profile(p.fromProfileId),
      queryFn: () => apiClient.getProfile(p.fromProfileId),
    })),
  });
  const rows: Row[] = proposals.map((p, i) => ({ p, from: profiles[i]?.data, kr: Math.round(p.price.amountMinor / 100) }));
  const sorted = [...rows].sort((a, b) => {
    if (sort === 'vurdering') return (b.from?.rating?.average ?? 0) - (a.from?.rating?.average ?? 0);
    if (sort === 'dato') return whenKey(a.p) - whenKey(b.p);
    return a.kr - b.kr;
  });
  const prices = rows.map((r) => r.kr);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const ratings = rows.map((r) => r.from?.rating?.average ?? 0);
  const bestR = Math.max(...ratings);
  const budget = listing?.price && listing.priceMode !== 'BY_AGREEMENT' ? Math.round(listing.price.amountMinor / 100) : null;
  const selRow = rows.find((r) => r.p.id === sel);
  const cat = categoryArtId(listing?.category.slug ?? 'annet');

  const header = (
    <SubHeader title={nb.sammenlign.title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/tilbud'))} />
  );

  if (isLoading || isError || rows.length === 0) {
    return (
      <Screen header={header}>
        {isLoading ? (
          <ListingListSkeleton count={3} />
        ) : isError ? (
          <View style={styles.errorBox}>
            <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
          </View>
        ) : (
          <View style={styles.errorBox}>
            <ErrorState title={nb.sammenlign.empty} onRetry={() => void refetch()} />
          </View>
        )}
      </Screen>
    );
  }

  // Price track: from a bit under the cheapest to a bit over the dearest (incl. budget).
  const lo = Math.min(minP, budget ?? minP);
  const hi = Math.max(maxP, budget ?? maxP);
  const pad = Math.max((hi - lo) * 0.18, 50);
  const pos = (v: number) => (v - (lo - pad)) / (hi + pad - (lo - pad));

  return (
    <View style={styles.flex}>
      <Screen scroll header={header}>
        {/* context + price range */}
        <FadeUp delay={50} style={[styles.px, styles.mt6]}>
          <View style={[styles.card, styles.ctxCard, shadow.card]}>
            <View style={styles.row12}>
              <CategoryArt category={cat} uri={listing?.images[0]?.url} width={48} height={48} radius={15} iconSize={22} />
              <View style={styles.ctxText}>
                <Pill label={nb.sammenlign.needHelp} tone="need" dot size="sm" style={styles.selfStart} />
                <Text style={[text.label, styles.f155]} numberOfLines={1}>
                  {listing?.title ?? ''}
                </Text>
              </View>
              <Pill label={nb.sammenlign.count(rows.length)} tone="line" />
            </View>
            <View style={[styles.between, styles.mt16]}>
              <Text style={text.eyebrow}>{nb.sammenlign.range}</Text>
              <Text style={[text.num, styles.f16]}>{minP === maxP ? kr(minP) : `${kr(minP).replace(/\s*kr$/, '')} – ${kr(maxP)}`}</Text>
            </View>
            <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.ln} />
              {budget != null ? (
                <View style={[styles.bd, { left: `${pos(budget) * 100}%` }]}>
                  <View style={styles.bdl}>
                    <Text style={styles.bdlText} numberOfLines={1}>
                      {nb.sammenlign.budget(kr(budget).replace(/\s*kr$/, ''))}
                    </Text>
                  </View>
                </View>
              ) : null}
              {rows.map((r, i) => (
                <ScaleIn key={r.p.id} delay={150 + i * 50} style={[styles.pt, { left: `${pos(r.kr) * 100}%` }]}>
                  <Avatar initials={r.from?.initials ?? '·'} uri={r.from?.avatarUrl} seed={r.p.fromProfileId} size={28} />
                </ScaleIn>
              ))}
            </View>
          </View>
        </FadeUp>

        {/* sort */}
        <FadeUp delay={100} style={[styles.px, styles.mt18]}>
          <View style={[styles.between, styles.mb10]}>
            <Text style={text.eyebrow}>{nb.sammenlign.sortBy}</Text>
            {rows.length > 2 ? (
              <View style={styles.row4}>
                <Text style={text.meta}>{nb.sammenlign.swipe}</Text>
                <Icon name="arrow" size={14} color={colors.mute} />
              </View>
            ) : null}
          </View>
          <Segmented
            accessibilityLabel={nb.sammenlign.sortLabel}
            options={(['pris', 'vurdering', 'dato'] as const).map((s) => ({ value: s, label: nb.sammenlign.sorts[s] }))}
            value={sort}
            onChange={(s) => {
              if (s === sort) return;
              setSort(s);
              setRound((r) => r + 1);
            }}
          />
        </FadeUp>

        {/* columns */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={COL_W + 12}
          decelerationRate="fast"
          contentContainerStyle={styles.cols}
          accessibilityRole="radiogroup"
          accessibilityLabel={nb.sammenlign.pick}
        >
          {sorted.map((r, i) => {
            const on = sel === r.p.id;
            const low = r.kr === minP;
            const best = !!r.from?.rating?.count && r.from.rating.average === bestR;
            const Wrap = round > 0 ? SlideIn : FadeUp;
            return (
              <Wrap key={`${r.p.id}-${round}`} delay={(i + 2) * 50}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${r.from?.displayName ?? ''}, ${formatPrice(r.p.price)}`}
                  onPress={() => setSel(on ? null : r.p.id)}
                  style={[styles.col, on ? [styles.colOn, shadow.colOn] : shadow.card]}
                >
                  <View style={styles.colTop}>
                    <View style={styles.marks}>
                      {low ? (
                        <View style={[styles.mk, styles.mkLow]}>
                          <Icon name="tag" size={12} color={colors.okText} />
                          <Text style={[styles.mkText, { color: colors.okText }]}>{nb.sammenlign.lowest}</Text>
                        </View>
                      ) : null}
                      {best ? (
                        <View style={[styles.mk, styles.mkBest]}>
                          <Icon name="star" size={12} color={colors.bestText} filled />
                          <Text style={[styles.mkText, { color: colors.bestText }]}>{nb.sammenlign.best}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Radio selected={on} />
                  </View>
                  <View style={styles.who}>
                    <Avatar initials={r.from?.initials ?? '·'} uri={r.from?.avatarUrl} seed={r.p.fromProfileId} size={56} />
                    <Text style={styles.whoName} numberOfLines={1}>
                      {r.from?.displayName ?? ''}
                    </Text>
                  </View>
                  <Text style={[text.num, styles.colPrice]}>{formatPrice(r.p.price)}</Text>
                  <PriceBar fill={r.kr / maxP} color={low ? colors.areaBorder : on ? colors.ink : colors.barMute} playKey={round} />
                  <Cell label={nb.sammenlign.when}>
                    <Text style={styles.cellB}>{r.p.scheduledText || '–'}</Text>
                  </Cell>
                  <Cell label={nb.sammenlign.duration}>
                    <Text style={styles.cellB}>{r.p.durationText ?? listing?.task?.durationText ?? '–'}</Text>
                  </Cell>
                  <Cell label={nb.sammenlign.rating}>
                    {r.from?.rating?.count ? (
                      <View style={styles.stars}>
                        <Icon name="star" size={14} color={colors.star} filled />
                        <Text style={styles.starsVal}>{r.from.rating.average.toFixed(1).replace('.', ',')}</Text>
                        <Text style={styles.starsMeta}>{`(${r.from.rating.count})`}</Text>
                      </View>
                    ) : (
                      <Text style={styles.cellB}>{nb.sammenlign.noRating}</Text>
                    )}
                  </Cell>
                  <Cell label={nb.sammenlign.jobs}>
                    <Text style={styles.cellB}>{String(r.from?.completedTasks ?? 0)}</Text>
                  </Cell>
                  <Cell label={nb.sammenlign.reply}>
                    <ReplyValue profileId={r.p.fromProfileId} />
                  </Cell>
                  <Cell label={nb.sammenlign.caveats} tall>
                    <Text style={styles.clamp} numberOfLines={2}>
                      {r.p.caveats || nb.sammenlign.noCaveats}
                    </Text>
                  </Cell>
                </Pressable>
              </Wrap>
            );
          })}
        </ScrollView>

        <FadeUp delay={300} style={[styles.px, styles.gap12]}>
          <View style={styles.tip}>
            <View style={styles.tipIc}>
              <Icon name="sparkle" size={16} color={colors.cyanDeep} />
            </View>
            <View style={styles.tipText}>
              <Text style={[text.label, styles.f145]}>{nb.sammenlign.tipTitle}</Text>
              <Text style={text.meta}>{nb.sammenlign.tipBody}</Text>
            </View>
          </View>
          <PaymentNote />
        </FadeUp>
        <View style={styles.bottom} />
      </Screen>

      <StickyFooter>
        {selRow ? (
          <FadeUp>
            <View style={styles.selRow}>
              <Avatar initials={selRow.from?.initials ?? '·'} uri={selRow.from?.avatarUrl} seed={selRow.p.fromProfileId} size={40} />
              <View style={styles.selText}>
                <Text style={[text.label, styles.f145]} numberOfLines={1}>
                  {selRow.from?.displayName ?? ''}
                </Text>
                {selRow.p.scheduledText ? (
                  <Text style={text.meta} numberOfLines={1}>
                    {selRow.p.scheduledText}
                  </Text>
                ) : null}
              </View>
              <Text style={[text.num, styles.f19]}>{formatPrice(selRow.p.price)}</Text>
              <IconButton icon="x" iconSize={16} variant="ghost" accessibilityLabel={nb.sammenlign.clear} onPress={() => setSel(null)} />
            </View>
            <Button
              label={nb.sammenlign.goOnWith((selRow.from?.displayName ?? '').split(' ')[0])}
              iconRight="arrow"
              size="lg"
              onPress={() => safePush(`/tilbud/${selRow.p.id}`)}
              style={styles.mt10}
            />
          </FadeUp>
        ) : (
          <>
            <View style={styles.hint}>
              <Icon name="hand" size={16} color={colors.mute} />
              <Text style={text.meta}>{nb.sammenlign.tapHint}</Text>
            </View>
            <Button label={nb.sammenlign.goOn} size="lg" disabled onPress={() => undefined} style={styles.mt10} />
          </>
        )}
      </StickyFooter>
    </View>
  );
}

/** Sort key for "Dato": the offered time, offers without a day last. */
const whenKey = (p: Proposal) => agreedDate(p)?.getTime() ?? Number.MAX_SAFE_INTEGER;

/** "Svartid" – the helper's median reply time, "–" until there is enough history. */
function ReplyValue({ profileId }: { profileId: string }) {
  const minutes = useReplyMinutes(profileId).data;
  return <Text style={styles.cellB}>{minutes != null ? replyTime(minutes) : '–'}</Text>;
}

function Cell({ label, children, tall }: { label: string; children: ReactNode; tall?: boolean }) {
  return (
    <View style={[styles.cell, tall && styles.cellTall]}>
      <Text style={styles.cellLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** `.pbar` – price relative to the dearest offer; grows in (and again after a re-sort). */
function PriceBar({ fill, color, playKey }: { fill: number; color: string; playKey: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? fill : 0);
  useEffect(() => {
    if (reduced) return;
    p.set(0);
    p.set(withDelay(150, withTiming(fill, { duration: 1000, easing: Easing.bezier(...motion.ease) })));
  }, [fill, playKey, reduced, p]);
  const bar = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={styles.pbar}>
      <Animated.View style={[styles.pbarFill, { backgroundColor: color }, bar]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  px: { paddingHorizontal: screenPadding },
  selfStart: { alignSelf: 'flex-start' },
  f145: { fontSize: 14.5 },
  f155: { fontSize: 15.5 },
  f16: { fontSize: 16, lineHeight: 19 },
  f19: { fontSize: 19, lineHeight: 22 },
  mt6: { marginTop: 6 },
  mt10: { marginTop: 10 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  mb10: { marginBottom: 10 },
  gap12: { gap: 12 },
  row4: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row12: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  errorBox: { height: 420 },
  card: { backgroundColor: colors.white, borderRadius: radius.card },
  ctxCard: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 12 },
  ctxText: { flex: 1, minWidth: 0, gap: 5 },
  track: { height: 64, marginTop: 10 },
  ln: { position: 'absolute', left: 0, right: 0, top: 30, height: 6, borderRadius: 3, backgroundColor: colors.lime, opacity: 0.45 },
  bd: { position: 'absolute', top: 10, bottom: 0, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.ink },
  bdl: {
    position: 'absolute',
    top: -18,
    left: -70,
    width: 142,
    alignItems: 'center',
  },
  bdlText: {
    fontFamily: text.label.fontFamily,
    fontSize: 11,
    color: colors.ink,
    backgroundColor: colors.white,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  pt: { position: 'absolute', top: 18, marginLeft: -14 },
  cols: { gap: 12, paddingTop: 8, paddingHorizontal: screenPadding, paddingBottom: 18 },
  col: {
    width: COL_W,
    backgroundColor: colors.white,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  colOn: { borderColor: colors.ink },
  colTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 28 },
  marks: { gap: 4, flexShrink: 1 },
  mk: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 8, borderRadius: radius.pill, alignSelf: 'flex-start' },
  mkLow: { backgroundColor: colors.okTint },
  mkBest: { backgroundColor: colors.bestTint },
  mkText: { fontFamily: text.label.fontFamily, fontSize: 11 },
  who: { alignItems: 'center', gap: 8, paddingTop: 6, paddingBottom: 12 },
  whoName: { fontFamily: text.label.fontFamily, fontSize: 15, lineHeight: 18, color: colors.ink, textAlign: 'center' },
  colPrice: { fontSize: 25, lineHeight: 28 },
  pbar: { height: 8, borderRadius: 4, backgroundColor: colors.line2, overflow: 'hidden', marginTop: 8, marginBottom: 12 },
  pbarFill: { height: '100%', borderRadius: 4 },
  cell: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line2, gap: 4, minHeight: 60 },
  cellTall: { minHeight: 74 },
  cellLabel: { fontFamily: text.label.fontFamily, fontSize: 10.5, letterSpacing: 0.74, textTransform: 'uppercase', color: colors.faint },
  cellB: { fontFamily: text.label.fontFamily, fontSize: 14, lineHeight: 18, color: colors.ink },
  clamp: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 17.5, color: colors.ink2 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsVal: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink },
  starsMeta: { fontFamily: text.meta.fontFamily, fontSize: 13, color: colors.mute },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, paddingHorizontal: 16, borderRadius: radius.card, backgroundColor: colors.white },
  tipIc: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, gap: 3 },
  bottom: { height: 180 },
  selRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selText: { flex: 1, minWidth: 0, gap: 2 },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
