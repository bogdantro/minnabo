import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeOutRight, LinearTransition } from 'react-native-reanimated';
import type { Listing, ListingStatus, Proposal } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import nb from '@/i18n/nb';
import { useMyListings, useReceivedProposals, useSetListingStatus } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { listingPrice, listingSchedule } from '@/components/OppdragCard';
import {
  Button,
  CategoryArt,
  Chip,
  ChipRow,
  Dialog,
  ErrorState,
  FadeUp,
  Icon,
  IconButton,
  Note,
  PAYMENT_NOTE,
  Pill,
  PressableScale,
  RowSkeleton,
  Screen,
  Sheet,
  StickyFooter,
  SubHeader,
  type IconName,
  type PillTone,
} from '@/components/ui';

type Group = 'aktiv' | 'pauset' | 'arkivert';
const GROUPS: { id: Group; icon: IconName }[] = [
  { id: 'aktiv', icon: 'zap' },
  { id: 'pauset', icon: 'pause' },
  { id: 'arkivert', icon: 'archive' },
];
const ONGOING: ListingStatus[] = ['OFFER_ACCEPTED', 'AGREED', 'IN_PROGRESS', 'COMPLETION_SENT'];
const DONE: ListingStatus[] = ['COMPLETED', 'REVIEWED'];
const PAUSABLE: ListingStatus[] = ['PUBLISHED', 'RECEIVING_OFFERS', 'ACTIVE', 'DRAFT'];

function groupOf(s: ListingStatus): Group {
  if (s === 'PAUSED') return 'pauset';
  if (s === 'ARCHIVED' || s === 'CANCELLED' || s === 'EXPIRED' || DONE.includes(s)) return 'arkivert';
  return 'aktiv';
}

function statusPill(l: Listing): { tone: PillTone; icon: IconName; label: string } {
  const g = groupOf(l.status);
  if (g === 'aktiv') return { tone: 'ok', icon: 'zap', label: nb.mine.pill.aktiv };
  if (g === 'pauset') return { tone: 'warn', icon: 'pause', label: nb.mine.pill.pauset };
  return DONE.includes(l.status)
    ? { tone: 'neutral', icon: 'check', label: nb.mine.pill.done }
    : { tone: 'neutral', icon: 'archive', label: nb.mine.pill.arkivert };
}

const isPending = (p: Proposal) => p.status === 'SENT' || p.status === 'REVISION_PENDING';

/** Mine oppføringer (design/screens/MineOppforinger.dc.html). */
export function MyListingsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMyListings('TASK_REQUEST');
  const { data: received } = useReceivedProposals();
  const setStatus = useSetListingStatus();

  const [group, setGroup] = useState<Group>('aktiv');
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const listings = data ?? [];
  const mineIds = new Set(listings.map((l) => l.id));
  const offers = (received ?? []).filter((p) => mineIds.has(p.listingId) && p.status !== 'DRAFT');
  const pendingFor = (id: string) => offers.filter((p) => p.listingId === id && isPending(p));
  const shown = listings.filter((l) => groupOf(l.status) === group);
  const sel = listings.find((l) => l.id === (sheetId ?? confirmId));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const change = (l: Listing, next: ListingStatus, msg: string, icon: IconName) => {
    const prev = l.status;
    setSheetId(null);
    setConfirmId(null);
    haptics.light();
    setStatus.mutate(
      { id: l.id, status: next },
      {
        onSuccess: () =>
          toast.success(msg, {
            icon,
            bottom: 124,
            action: { label: nb.mine.undo, onPress: () => setStatus.mutate({ id: l.id, status: prev }) },
          }),
        onError: () => toast.error(nb.toast.genericError, { bottom: 124 }),
      },
    );
  };
  const activeStatus = (l: Listing): ListingStatus => (pendingFor(l.id).length ? 'RECEIVING_OFFERS' : 'PUBLISHED');
  const activate = (l: Listing) => change(l, activeStatus(l), nb.mine.toastActive(l.title), 'play');

  const empty = nb.mine.empty[group];

  return (
    <Screen
      scroll
      spacer="foot"
      header={
        <SubHeader
          title={nb.mine.title}
          onBack={back}
          right={<IconButton icon="plus" variant="dark" iconSize={18} accessibilityLabel={nb.mine.newListing} onPress={() => safePush('/legg-ut')} />}
        />
      }
      footer={
        <StickyFooter>
          <Button label={nb.mine.newListing} variant="ink" size="lg" icon="plus" onPress={() => safePush('/legg-ut')} />
        </StickyFooter>
      }
    >
      <FadeUp style={[styles.px, styles.pt8]}>
        <Text style={text.h1} accessibilityRole="header">
          {nb.mine.heading}
        </Text>
        <Text style={[text.meta, styles.mt8]}>{nb.mine.sub}</Text>
      </FadeUp>

      <FadeUp delay={80} style={[styles.px, styles.minis]}>
        <View style={styles.mini}>
          <Text style={styles.miniNum}>{listings.filter((l) => groupOf(l.status) === 'aktiv').length}</Text>
          <Text style={styles.miniLabel}>{nb.mine.miniActive}</Text>
        </View>
        <View style={styles.mini}>
          <Text style={styles.miniNum}>{offers.length}</Text>
          <Text style={styles.miniLabel}>{nb.mine.miniOffers}</Text>
        </View>
      </FadeUp>

      <FadeUp delay={140} style={styles.mt14}>
        <ChipRow>
          {GROUPS.map((g) => {
            const on = group === g.id;
            const n = listings.filter((l) => groupOf(l.status) === g.id).length;
            return (
              <Chip
                key={g.id}
                label={nb.mine.statuses[g.id]}
                icon={g.icon}
                selected={on}
                onPress={() => setGroup(g.id)}
                accessibilityLabel={`${nb.mine.statuses[g.id]}, ${n}`}
                trailing={
                  <View style={[styles.count, on && styles.countOn]}>
                    <Text style={[styles.countText, on && styles.countTextOn]}>{n}</Text>
                  </View>
                }
              />
            );
          })}
        </ChipRow>
      </FadeUp>

      <View style={[styles.px, styles.list]}>
        {isLoading ? (
          <>
            <RowSkeleton />
            <RowSkeleton />
          </>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : shown.length === 0 ? (
          <FadeUp style={styles.empty}>
            <View style={[styles.emptyIcon, shadow.card]}>
              <Icon name={GROUPS.find((g) => g.id === group)!.icon} size={24} color={colors.mute} />
            </View>
            <Text style={styles.emptyTitle}>{empty.title}</Text>
            <Text style={[text.meta, styles.emptyText]}>{empty.text}</Text>
            <Button label={nb.mine.newListing} variant="ink" size="sm" icon="plus" block={false} align="center" onPress={() => safePush('/legg-ut')} style={styles.mt6} />
          </FadeUp>
        ) : (
          shown.map((l) => (
            <Animated.View key={l.id} exiting={FadeOutRight.duration(450)} layout={LinearTransition.duration(300)}>
              <ListingRow
                listing={l}
                pending={pendingFor(l.id)}
                onMore={ONGOING.includes(l.status) ? undefined : () => setSheetId(l.id)}
                onActivate={() => activate(l)}
              />
            </Animated.View>
          ))
        )}
      </View>

      <View style={[styles.px, styles.mt18]}>
        <Note style={styles.center}>{PAYMENT_NOTE}</Note>
      </View>

      <Sheet visible={!!sheetId} onClose={() => setSheetId((s) => (s === sel?.id ? null : s))}>
        {sel ? (
          <>
            <View style={styles.shHead}>
              <CategoryArt category={categoryArtId(sel.category.slug)} uri={sel.images[0]?.url} width={48} height={48} radius={14} iconSize={22} />
              <View style={styles.flex}>
                <Text style={styles.shTitle} numberOfLines={2} accessibilityRole="header">
                  {sel.title}
                </Text>
                <Text style={text.meta}>{`${nb.mine.sheetType} · ${statusPill(sel).label}`}</Text>
              </View>
              <IconButton icon="x" iconSize={18} accessibilityLabel="Lukk" onPress={() => setSheetId(null)} />
            </View>
            {PAUSABLE.includes(sel.status) ? (
              <Act icon="pause" title={nb.mine.pause} sub={nb.mine.pauseSub} onPress={() => change(sel, 'PAUSED', nb.mine.toastPaused, 'pause')} />
            ) : null}
            {groupOf(sel.status) !== 'aktiv' && !DONE.includes(sel.status) ? (
              <Act
                icon="play"
                iconBg={colors.okTint}
                iconFg={colors.ok}
                title={sel.status === 'PAUSED' ? nb.mine.activate : nb.mine.restore}
                sub={nb.mine.activateSub}
                onPress={() => activate(sel)}
              />
            ) : null}
            {groupOf(sel.status) !== 'arkivert' ? (
              <Act icon="archive" title={nb.mine.archive} sub={nb.mine.archiveSub} onPress={() => change(sel, 'ARCHIVED', nb.mine.toastArchived, 'archive')} />
            ) : null}
            <Act
              icon="trash"
              danger
              title={nb.mine.del}
              sub={nb.mine.delSub}
              onPress={() => {
                setConfirmId(sel.id);
                setSheetId(null);
              }}
            />
          </>
        ) : null}
      </Sheet>

      <Dialog
        visible={!!confirmId}
        onClose={() => setConfirmId(null)}
        icon="trash"
        tone="danger"
        title={nb.mine.confirmTitle(sel?.title ?? '')}
        body={nb.mine.confirmText}
        actions={
          <View style={styles.stack8}>
            <Button label={nb.mine.confirmBtn} variant="danger" onPress={() => sel && change(sel, 'REMOVED', nb.mine.toastDeleted, 'trash')} />
            <Button label={nb.mine.cancel} variant="ghost" onPress={() => setConfirmId(null)} />
          </View>
        }
      />
    </Screen>
  );
}

function ListingRow({
  listing: l,
  pending,
  onMore,
  onActivate,
}: {
  listing: Listing;
  pending: Proposal[];
  onMore?: () => void;
  onActivate: () => void;
}) {
  const g = groupOf(l.status);
  const st = statusPill(l);
  const price = listingPrice(l);
  const sub = [l.location.place || l.location.municipality, listingSchedule(l), [price.label, price.value].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  const n = pending.length;
  const hot = g === 'aktiv' && n > 0;
  return (
    <FadeUp style={[styles.mo, shadow.card]}>
      <View style={styles.moTop}>
        <PressableScale accessibilityRole="link" accessibilityLabel={l.title} onPress={() => safePush(`/oppdrag/${l.id}`)} style={styles.moMain}>
          <CategoryArt category={categoryArtId(l.category.slug)} uri={l.images[0]?.url} width={66} height={66} radius={18} iconSize={26} />
          <View style={styles.moBody}>
            <View style={styles.pills}>
              <Pill label={nb.mine.need} tone="need" dot />
              <Pill label={st.label} tone={st.tone} icon={st.icon} />
            </View>
            <Text style={styles.moTitle}>{l.title}</Text>
            <Text style={[text.meta, styles.f125]}>{sub}</Text>
          </View>
        </PressableScale>
        {onMore ? (
          <IconButton icon="more" variant="ghost" accessibilityLabel={nb.mine.more(l.title)} onPress={onMore} style={styles.more} />
        ) : null}
      </View>
      <View style={styles.mstats}>
        <View style={[styles.mstat, hot && styles.mstatHot]}>
          <Icon name="tag" size={14} color={hot ? colors.limeDeep : colors.faint} />
          <Text style={[styles.mstatText, hot && styles.mstatTextHot]}>{nb.mine.offers(n)}</Text>
        </View>
      </View>
      {g === 'aktiv' && n > 0 ? (
        <Button
          label={nb.mine.seeOffers(n)}
          variant="lime"
          size="sm"
          iconRight="arrow"
          onPress={() => safePush(n >= 2 ? `/tilbud/sammenlign/${l.id}` : `/tilbud/${pending[0].id}`)}
        />
      ) : g === 'aktiv' && ONGOING.includes(l.status) ? (
        <Button label={nb.mine.seeAgreements} variant="ghost" size="sm" iconRight="arrow" onPress={() => safePush('/avtaler')} />
      ) : DONE.includes(l.status) ? (
        <Button label={nb.mine.seeAgreements} variant="ghost" size="sm" iconRight="arrow" onPress={() => safePush('/avtaler')} />
      ) : g === 'pauset' ? (
        <Button label={nb.mine.activateAgain} variant="ghost" size="sm" icon="play" onPress={onActivate} />
      ) : null}
    </FadeUp>
  );
}

function Act({
  icon,
  title,
  sub,
  onPress,
  danger,
  iconBg,
  iconFg,
}: {
  icon: IconName;
  title: string;
  sub: string;
  onPress: () => void;
  danger?: boolean;
  iconBg?: string;
  iconFg?: string;
}) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.act}>
      <View style={[styles.actIcon, { backgroundColor: iconBg ?? (danger ? colors.dangerTint : colors.bg) }]}>
        <Icon name={icon} size={18} color={iconFg ?? (danger ? colors.danger : colors.ink)} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.actTitle, danger && { color: colors.danger }]}>{title}</Text>
        <Text style={[styles.actSub, danger && styles.actSubDanger]}>{sub}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  pt8: { paddingTop: 8 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt14: { marginTop: 14 },
  mt18: { marginTop: 18 },
  f125: { fontSize: 12.5 },
  stack8: { gap: 8 },
  center: { justifyContent: 'center' },
  minis: { flexDirection: 'row', gap: 8, marginTop: 16 },
  mini: {
    flex: 1,
    gap: 4,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.line,
  },
  miniNum: { fontFamily: fonts.display, fontSize: 20, lineHeight: 20, letterSpacing: -0.4, color: colors.ink },
  miniLabel: { fontFamily: fonts.body, fontSize: 12, lineHeight: 15, color: colors.mute },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.dateChipBg, alignItems: 'center', justifyContent: 'center' },
  countOn: { backgroundColor: colors.onInk16b },
  countText: { fontFamily: fonts.bodyHeavy, fontSize: 11.5, color: colors.ink },
  countTextOn: { color: colors.white },
  list: { gap: 12, marginTop: 10 },
  mo: { backgroundColor: colors.surface, borderRadius: 26, padding: 14, gap: 12 },
  moTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  moMain: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  moBody: { flex: 1, minWidth: 0, gap: 7 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  moTitle: { fontFamily: fonts.bodyBold, fontSize: 16.5, lineHeight: 20.6, color: colors.ink },
  more: { marginTop: -6, marginRight: -6 },
  mstats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mstat: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: radius.s, backgroundColor: colors.surface2 },
  mstatHot: { backgroundColor: colors.limeTint },
  mstatText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink2 },
  mstatTextHot: { color: colors.limeDeep },
  empty: {
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: 20,
    backgroundColor: colors.dashedCardBg,
  },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 21, color: colors.ink, textAlign: 'center' },
  emptyText: { maxWidth: 260, textAlign: 'center' },
  shHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line2,
    marginBottom: 8,
  },
  shTitle: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 20, color: colors.ink },
  act: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, minHeight: 60 },
  actIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  actTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 19, color: colors.ink },
  actSub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16, color: colors.mute, marginTop: 2 },
  actSubDanger: { color: colors.danger, opacity: 0.8 },
});
