import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Proposal, ProposalStatus } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import { formatPrice } from '@/domain/price';
import nb from '@/i18n/nb';
import { useListing, useProfile, useReceivedProposals } from '@/api/queries';
import { formatTime, shortDate } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import {
  Avatar,
  Button,
  CategoryArt,
  ErrorState,
  FadeUp,
  Icon,
  IconButton,
  ListingListSkeleton,
  Note,
  PaymentNote,
  Pill,
  type PillTone,
  ScaleIn,
  Screen,
  Segmented,
  Sheet,
  SubHeader,
} from '@/components/ui';

type Seg = 'alle' | 'nye' | 'besvart';
const DAY_MS = 24 * 60 * 60 * 1000;
const isNew = (p: Proposal) => p.status === 'SENT';
const TONE: Record<ProposalStatus, PillTone> = {
  SENT: 'dark',
  REVISION_PENDING: 'warn',
  ACCEPTED: 'ok',
  DECLINED: 'danger',
  WITHDRAWN: 'neutral',
  DRAFT: 'neutral',
};
const DONE_STATUSES = ['COMPLETED', 'REVIEWED'];

/** Mottatte tilbud (design/screens/MottatteTilbud.dc.html). */
export function MottatteTilbudScreen() {
  const router = useRouter();
  const { data, isLoading, isError, isFetching, refetch } = useReceivedProposals();
  const [seg, setSeg] = useState<Seg>('alle');
  const [info, setInfo] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const all = useMemo(() => (data ?? []).filter((p) => p.status !== 'DRAFT'), [data]);
  const fresh = all.filter(isNew);
  const freshListings = new Set(fresh.map((p) => p.listingId)).size;
  const sinceYesterday = fresh.some((p) => Date.parse(p.createdAt) >= openedAt - DAY_MS);
  const freshSenders = [...new Set(fresh.map((p) => p.fromProfileId))].slice(0, 3);

  const match = (p: Proposal) => seg === 'alle' || (seg === 'nye' ? isNew(p) : !isNew(p));
  const groups = useMemo(() => {
    const by = new Map<string, Proposal[]>();
    for (const p of all) by.set(p.listingId, [...(by.get(p.listingId) ?? []), p]);
    // Groups with new offers first, then newest activity.
    return [...by.entries()]
      .map(([listingId, ps]) => ({
        listingId,
        all: ps,
        latest: Math.max(...ps.map((p) => Date.parse(p.createdAt))),
        hasNew: ps.some(isNew),
      }))
      .sort((a, b) => Number(b.hasNew) - Number(a.hasNew) || b.latest - a.latest);
  }, [all]);
  const visible = groups
    .map((g) => ({
      ...g,
      rows: g.all.filter(match).sort((a, b) => Number(isNew(b)) - Number(isNew(a)) || Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    }))
    .filter((g) => g.rows.length > 0);

  const counts = { alle: all.length, nye: fresh.length, besvart: all.length - fresh.length };

  return (
    <Screen
      scroll
      header={
        <SubHeader
          title={nb.mottatte.title}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          right={<IconButton icon="info" iconSize={18} accessibilityLabel={nb.mottatte.info} onPress={() => setInfo(true)} />}
        />
      }
      scrollProps={{
        refreshControl: <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={colors.limeDeep} />,
      }}
    >
      {isLoading ? (
        <View style={styles.skel}>
          <ListingListSkeleton count={3} />
        </View>
      ) : isError ? (
        <View style={styles.errorBox}>
          <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
        </View>
      ) : (
        <>
          {/* summary */}
          <FadeUp delay={50} style={[styles.px, styles.mt8]}>
            <View style={styles.sumcard}>
              <View style={styles.glow} />
              <View style={styles.sumTop}>
                <View style={styles.sumTitle}>
                  {sinceYesterday ? (
                    <Pill label={nb.mottatte.sinceYesterday} tone="accent" icon="sparkle" style={styles.selfStart} />
                  ) : null}
                  <Text style={[text.h2, styles.sumH]} accessibilityRole="header">
                    {nb.mottatte.headline(fresh.length, freshListings)}
                  </Text>
                </View>
                {freshSenders.length ? (
                  <ScaleIn delay={150} style={styles.avstack}>
                    {freshSenders.map((id, i) => (
                      <SenderAvatar key={id} profileId={id} style={i > 0 ? styles.avOverlap : undefined} />
                    ))}
                  </ScaleIn>
                ) : null}
              </View>
              <View style={styles.minis}>
                <Mini n={all.length} label={nb.mottatte.total} />
                <Mini n={all.filter((p) => p.status === 'REVISION_PENDING').length} label={nb.mottatte.pendingChange} />
                <Mini n={all.filter((p) => p.status === 'ACCEPTED').length} label={nb.mottatte.agreed} />
              </View>
            </View>
          </FadeUp>

          {/* segment */}
          <FadeUp delay={100} style={[styles.px, styles.mt18]}>
            <Segmented
              accessibilityLabel={nb.mottatte.filterLabel}
              options={(['alle', 'nye', 'besvart'] as const).map((s) => ({ value: s, label: nb.mottatte.segs[s], count: counts[s] }))}
              value={seg}
              onChange={setSeg}
              countStyle="inline"
            />
          </FadeUp>

          <View style={[styles.px, styles.list]}>
            {visible.map((g, i) => (
              <FadeUp key={g.listingId} delay={Math.min(i + 3, 10) * 50}>
                <GroupCard listingId={g.listingId} total={g.all.length} rows={g.rows} canCompare={seg !== 'besvart' && g.all.filter((p) => p.status === 'SENT' || p.status === 'REVISION_PENDING').length > 1} />
              </FadeUp>
            ))}

            {visible.length === 0 ? (
              <ScaleIn style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Icon name="checks" size={24} color={colors.limeDeep} />
                </View>
                <Text style={[text.label, styles.f155]}>
                  {seg === 'nye' ? nb.mottatte.emptyNew : seg === 'besvart' ? nb.mottatte.emptyAnswered : nb.mottatte.emptyAll}
                </Text>
                <Text style={[text.meta, styles.center]}>{nb.mottatte.emptySub}</Text>
                {seg !== 'alle' ? (
                  <Button label={nb.mottatte.showAll} variant="ghost" size="sm" block={false} onPress={() => setSeg('alle')} />
                ) : null}
              </ScaleIn>
            ) : null}

            <FadeUp delay={300}>
              <PaymentNote style={styles.note} />
            </FadeUp>
          </View>
        </>
      )}
      <View style={styles.bottom} />

      <Sheet visible={info} onClose={() => setInfo(false)} title={nb.mottatte.info} titleSize="h2">
        <View style={styles.steps}>
          {nb.mottatte.steps.map((s, i) => (
            <FadeUp key={s.t} delay={(i + 1) * 50} style={styles.stepRow}>
              <View style={[styles.stepn, STEP_TONES[i]]}>
                <Text style={[styles.stepnText, { color: STEP_TONES[i].color }]}>{i + 1}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={text.label}>{s.t}</Text>
                <Text style={text.meta}>{s.d}</Text>
              </View>
            </FadeUp>
          ))}
        </View>
        <View style={styles.infoNote}>
          <Note>{nb.giTilbud.payNote}</Note>
        </View>
        <Button label={nb.mottatte.gotIt} variant="ink" onPress={() => setInfo(false)} style={styles.mt18} />
      </Sheet>
    </Screen>
  );
}

const STEP_TONES = [
  { backgroundColor: colors.limeTint, color: colors.limeDeep },
  { backgroundColor: colors.cyanTint, color: colors.cyanDeep },
  { backgroundColor: colors.ink, color: colors.lime },
];

function Mini({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniN}>{n}</Text>
      <Text style={styles.miniL}>{label}</Text>
    </View>
  );
}

function SenderAvatar({ profileId, style }: { profileId: string; style?: object }) {
  const { data: p } = useProfile(profileId);
  return (
    <View style={[styles.avRing, style]}>
      <Avatar initials={p?.initials ?? '·'} uri={p?.avatarUrl} seed={profileId} size={32} ring={false} />
    </View>
  );
}

function GroupCard({
  listingId,
  total,
  rows,
  canCompare,
}: {
  listingId: string;
  total: number;
  rows: Proposal[];
  canCompare: boolean;
}) {
  const { data: listing, isError } = useListing(listingId);
  const cat = categoryArtId(listing?.category.slug ?? 'annet');
  const archived = !!listing && DONE_STATUSES.includes(listing.status);
  const meta = [nb.mottatte.groupMeta(total), listing?.task?.scheduledText, listing?.location.place || listing?.location.municipality]
    .filter(Boolean)
    .join(' · ');
  const budget = listing?.price && listing.priceMode !== 'BY_AGREEMENT' ? formatPrice(listing.price) : null;
  // Only oppdrag (rule 1); offers on a removed listing or another listing type are not shown.
  if (isError || (listing && listing.type !== 'TASK_REQUEST')) return null;

  return (
    <View style={[styles.gcard, shadow.card]} accessibilityLabel={listing?.title}>
      <Pressable accessibilityRole="link" onPress={() => safePush(`/oppdrag/${listingId}`)} style={styles.ghead}>
        <CategoryArt category={cat} uri={listing?.images[0]?.url} width={58} height={58} radius={17} iconSize={26} />
        <View style={styles.gheadText}>
          <View style={styles.row6}>
            <Pill label={nb.mottatte.needHelp} tone="need" dot />
            {archived ? <Pill label={nb.mottatte.done} tone="neutral" icon="archive" /> : null}
          </View>
          <Text style={[text.h3, styles.h4]} numberOfLines={1}>
            {listing?.title ?? ' '}
          </Text>
          <Text style={text.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </Pressable>
      {rows.map((p) => (
        <OfferRow key={p.id} p={p} />
      ))}
      {canCompare ? (
        <View style={styles.gfoot}>
          <Pressable accessibilityRole="link" onPress={() => safePush(`/tilbud/sammenlign/${listingId}`)} style={styles.compare}>
            <Icon name="chart" size={16} color={colors.cyanDeep} />
            <Text style={text.link}>{nb.mottatte.compare}</Text>
          </Pressable>
          {budget ? (
            <Text style={text.meta}>
              {`${nb.mottatte.budget} `}
              <Text style={styles.budget}>{budget}</Text>
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function OfferRow({ p }: { p: Proposal }) {
  const { data: from } = useProfile(p.fromProfileId);
  const fresh = isNew(p);
  const name = from?.displayName ?? '';
  const price = formatPrice(p.price);
  const status = nb.mottatte.status[p.status];
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${name}, ${price}, ${status}`}
      onPress={() => safePush(`/tilbud/${p.id}`)}
      style={({ pressed }) => [styles.orow, pressed && styles.orowPressed]}
    >
      <View style={styles.sep} />
      {fresh ? <View style={styles.newdot} /> : null}
      <Avatar initials={from?.initials ?? '·'} uri={from?.avatarUrl} seed={p.fromProfileId} size={48} />
      <View style={styles.ogrow}>
        <View style={styles.oname}>
          <Text style={styles.onameText} numberOfLines={1}>
            {name}
          </Text>
          {from?.rating?.count ? (
            <View style={styles.stars}>
              <Icon name="star" size={14} color={colors.star} filled />
              <Text style={styles.starsVal}>{from.rating.average.toFixed(1).replace('.', ',')}</Text>
            </View>
          ) : null}
        </View>
        {p.scheduledText ? (
          <Text style={text.meta} numberOfLines={1}>
            {p.scheduledText}
          </Text>
        ) : null}
        <Text style={[text.meta, styles.date]}>{nb.mottatte.sent(shortDate(p.createdAt).replace(/^\S+ /, ''), formatTime(p.createdAt))}</Text>
      </View>
      <View style={styles.oright}>
        <Text style={[text.num, styles.f18]}>{price}</Text>
        <Pill label={status} tone={TONE[p.status]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  center: { textAlign: 'center' },
  selfStart: { alignSelf: 'flex-start' },
  f155: { fontSize: 15.5 },
  f18: { fontSize: 18, lineHeight: 20 },
  mt8: { marginTop: 8 },
  mt18: { marginTop: 18 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  skel: { marginTop: 12 },
  errorBox: { height: 420 },
  sumcard: { borderRadius: 28, backgroundColor: colors.ink, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 18, overflow: 'hidden' },
  glow: { position: 'absolute', right: -50, top: -70, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.lime, opacity: 0.32 },
  sumTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sumTitle: { flex: 1, gap: 8 },
  sumH: { color: colors.white, fontSize: 26, lineHeight: 29 },
  avstack: { flexDirection: 'row', marginTop: 4 },
  avRing: { borderRadius: 18, borderWidth: 2.5, borderColor: colors.ink },
  avOverlap: { marginLeft: -10 },
  minis: { flexDirection: 'row', gap: 8, marginTop: 16 },
  mini: { flex: 1, borderRadius: 16, backgroundColor: colors.onInk08, paddingVertical: 10, paddingHorizontal: 12, gap: 3 },
  miniN: { fontFamily: text.h3.fontFamily, fontSize: 20, lineHeight: 22, letterSpacing: -0.4, color: colors.white },
  miniL: { fontFamily: text.body.fontFamily, fontSize: 12, lineHeight: 15, color: colors.onInk72 },
  list: { gap: 16, marginTop: 18 },
  gcard: { backgroundColor: colors.white, borderRadius: 26, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  ghead: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12 },
  gheadText: { flex: 1, minWidth: 0, gap: 6 },
  h4: { fontSize: 17, lineHeight: 20 },
  orow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, minHeight: 72 },
  orowPressed: { backgroundColor: colors.surface2 },
  sep: { position: 'absolute', top: 0, left: 74, right: 14, height: 1, backgroundColor: colors.line2 },
  newdot: { position: 'absolute', left: 6, top: '50%', width: 6, height: 6, marginTop: -3, borderRadius: 3, backgroundColor: colors.notifDot },
  ogrow: { flex: 1, minWidth: 0, gap: 4 },
  oname: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onameText: { fontFamily: text.label.fontFamily, fontSize: 15.5, lineHeight: 19, color: colors.ink, flexShrink: 1 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsVal: { fontFamily: text.meta.fontFamily, fontSize: 13, color: colors.mute },
  date: { fontSize: 12, color: colors.faint },
  oright: { alignItems: 'flex-end', gap: 6 },
  gfoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderTopWidth: 1,
    borderTopColor: colors.line2,
    backgroundColor: colors.footTint,
  },
  compare: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  budget: { fontFamily: text.num.fontFamily, color: colors.ink },
  empty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: radius.option,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  note: { paddingHorizontal: 4, paddingTop: 4 },
  bottom: { height: 48 },
  steps: { gap: 14 },
  stepRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepnText: { fontFamily: text.label.fontFamily, fontSize: 13 },
  stepText: { flex: 1, gap: 3 },
  infoNote: { marginTop: 18, padding: 14, borderRadius: radius.card, backgroundColor: colors.surface2 },
});
