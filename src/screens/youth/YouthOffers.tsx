import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { postedAgo } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { colors, radius, shadow, text, type CategoryId } from '@/theme/theme';
import { Button, CategoryArt, FadeUp, Icon, Pill, ScaleIn, Sheet, type IconName } from '@/components/ui';

export type OfferStatus = 'sendt' | 'venter' | 'godtatt' | 'trukket' | 'avslatt';
export type Offer = {
  id: string;
  /** set for offers stored on the backend → the row opens the real chat */
  conversationId?: string;
  listingId: string;
  category: CategoryId;
  title: string;
  who: string;
  price: string;
  message: string;
  status: OfferStatus;
  sentAt: string;
  whenText?: string;
};

type Filter = keyof typeof nb.youth.filters;

const STATUS_TONE: Record<OfferStatus, 'dark' | 'warn' | 'ok' | 'neutral'> = {
  sendt: 'dark',
  venter: 'warn',
  godtatt: 'ok',
  trukket: 'neutral',
  avslatt: 'neutral',
};
const isOpen = (o: Offer) => o.status === 'sendt' || o.status === 'venter';
const MATCHES: Record<Filter, (o: Offer) => boolean> = {
  ALL: () => true,
  OPEN: isOpen,
  WON: (o) => o.status === 'godtatt',
  CLOSED: (o) => o.status === 'trukket' || o.status === 'avslatt',
};
/** How far along the offer has come: Sendt → Sett → Svar. */
const STEP: Record<OfferStatus, number> = { sendt: 0, venter: 1, godtatt: 2, avslatt: 2, trukket: 0 };

/** Mine tilbud on /ung (redesigned 2026-11-10): a summary, the filters, and one card per tilbud with where it stands. */
export function YouthOffers({
  offers,
  onFind,
  onOpenJob,
  onWithdraw,
}: {
  offers: Offer[];
  onFind: () => void;
  onOpenJob: (listingId: string) => void;
  onWithdraw: (o: Offer) => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [leaving, setLeaving] = useState<Offer | null>(null);
  const [now] = useState(() => new Date());
  const shown = offers.filter(MATCHES[filter]);
  const stats: { n: number; label: string; icon: IconName }[] = [
    { n: offers.filter(isOpen).length, label: nb.youth.statsWaiting, icon: 'hourglass' },
    { n: offers.filter(MATCHES.WON).length, label: nb.youth.statsWon, icon: 'check' },
    { n: offers.length, label: nb.youth.statsAll, icon: 'tag' },
  ];

  return (
    <View style={styles.stack}>
      <FadeUp style={styles.head}>
        <Text style={text.h1} accessibilityRole="header">
          {nb.youth.myOffers}
        </Text>
        <Text style={[text.meta, styles.sub]}>{nb.youth.myOffersSub}</Text>
      </FadeUp>

      {offers.length === 0 ? (
        <FadeUp delay={60} style={[styles.emptyCard, shadow.card]}>
          {/* the base design: blobs, a ring-framed disc and two floating chips */}
          <View style={styles.emptyArt} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.blob, styles.blobL]} />
            <View style={[styles.blob, styles.blobR]} />
            <View style={styles.emptyRing} />
            <View style={[styles.emptyDisc, shadow.medium]}>
              <Icon name="tag" size={30} color={colors.cyanDeep} />
            </View>
            <View style={[styles.chip, styles.chipL, shadow.card]}>
              <View style={styles.chipTick}>
                <Icon name="check" size={11} color={colors.white} />
              </View>
              <Text style={styles.chipText}>{nb.youth.emptyChipSent}</Text>
            </View>
            <View style={[styles.chip, styles.chipR, styles.chipDark]}>
              <Text style={[styles.chipText, styles.white]}>{nb.youth.emptyChipSay}</Text>
            </View>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
          </View>
          <View style={styles.emptyBody}>
            <Text style={[text.h3, styles.center]}>{nb.youth.noOffers}</Text>
            <Text style={[text.meta, styles.center]}>{nb.youth.noOffersBody}</Text>
            <Button label={nb.youth.findMore} icon="search" onPress={onFind} style={styles.stretch} />
          </View>
        </FadeUp>
      ) : (
        <>
          <FadeUp delay={50} style={[styles.stats, shadow.medium]}>
            <View style={styles.statsBlob} />
            {stats.map((s, i) => (
              <View key={s.label} style={[styles.stat, i > 0 && styles.statLine]}>
                <View style={styles.statIcon}>
                  <Icon name={s.icon} size={14} color={colors.ink} />
                </View>
                <Text style={styles.statNum}>{s.n}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </FadeUp>
          <FadeUp delay={90}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityLabel={nb.youth.filtersA11y}>
              {(Object.keys(nb.youth.filters) as Filter[]).map((k) => {
                const on = filter === k;
                const n = offers.filter(MATCHES[k]).length;
                return (
                  <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFilter(k)} style={[styles.fchip, on && styles.fchipOn]}>
                    <Text style={[styles.fchipText, on && styles.white]}>{nb.youth.filters[k]}</Text>
                    <View style={[styles.fcount, on && styles.fcountOn]}>
                      <Text style={[styles.fcountText, on && styles.inkText]}>{n}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </FadeUp>
          {shown.length === 0 ? <Text style={[text.body, styles.none]}>{nb.youth.noneHere}</Text> : null}
          {shown.map((o, i) => (
            <FadeUp key={o.id} delay={Math.min(i, 6) * 40}>
              <OfferCard offer={o} now={now} onOpenJob={() => onOpenJob(o.listingId)} onWithdraw={() => setLeaving(o)} />
            </FadeUp>
          ))}
          <Button label={nb.youth.findMore} icon="search" variant="ghost" onPress={onFind} />
        </>
      )}

      {/* a new key per offer, so the second step never stays open for the next one */}
      <WithdrawSheet key={leaving?.id ?? 'none'} offer={leaving} onClose={() => setLeaving(null)} onConfirm={onWithdraw} />
    </View>
  );
}

/** The colour that says where a tilbud stands, on the card's left edge. */
const EDGE: Record<OfferStatus, string> = {
  sendt: colors.cyan,
  venter: colors.warn,
  godtatt: colors.lime,
  trukket: colors.line,
  avslatt: colors.line,
};

function OfferCard({ offer: o, now, onOpenJob, onWithdraw }: { offer: Offer; now: Date; onOpenJob: () => void; onWithdraw: () => void }) {
  const open = isOpen(o);
  const closed = o.status === 'trukket' || o.status === 'avslatt';
  return (
    <View style={[styles.card, shadow.card, closed && styles.cardClosed]}>
      <View style={[styles.edge, { backgroundColor: EDGE[o.status] }]} />
      <View style={styles.top}>
        <CategoryArt category={o.category} width={56} height={56} radius={16} iconSize={24} />
        <View style={styles.flex}>
          <Text style={[text.cardTitle, styles.title]} numberOfLines={2}>
            {o.title}
          </Text>
          <Text style={text.meta} numberOfLines={1}>
            {`${o.who} · ${postedAgo(o.sentAt, now)}`}
          </Text>
        </View>
        <Pill label={nb.youth.status[o.status]} tone={STATUS_TONE[o.status]} size="sm" />
      </View>

      <View style={styles.row}>
        <Text style={[text.num, styles.price]}>{o.price}</Text>
        {o.whenText ? (
          <View style={styles.when}>
            <Icon name="cal" size={13} color={colors.cyanDeep} />
            <Text style={styles.whenText} numberOfLines={1}>
              {o.whenText}
            </Text>
          </View>
        ) : null}
      </View>

      {o.status !== 'trukket' ? <Steps status={o.status} /> : null}

      {o.message ? (
        <View style={styles.quote}>
          <Text style={styles.quoteBy}>{nb.youth.yourMessage}</Text>
          <Text style={styles.quoteText} numberOfLines={2}>
            {o.message}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {o.status === 'godtatt' ? <Button label={nb.youth.finish} icon="star" size="sm" onPress={() => safePush(`/fullfor/${o.id}`)} style={styles.flex} /> : null}
        {o.conversationId && !closed ? (
          <Button label={nb.youth.openChat} icon="msg" variant="ink" size="sm" onPress={() => safePush(`/chat/${o.conversationId}`)} style={styles.flex} />
        ) : null}
        {closed || open ? <Button label={nb.youth.seeJob} variant="ghost" size="sm" onPress={onOpenJob} style={closed ? styles.flex : styles.shrink} block={closed} /> : null}
      </View>
      {open ? <Button label={nb.youth.withdraw} variant="dangerGhost" size="sm" accessibilityLabel={nb.youth.withdrawingA11y(o.title)} onPress={onWithdraw} /> : null}
    </View>
  );
}

/** Sendt → Sett → Svar as three dots on a line, the reached ones in lime. */
function Steps({ status }: { status: OfferStatus }) {
  const at = STEP[status];
  return (
    <View style={styles.steps}>
      <View style={styles.stepLineBg} />
      <View style={[styles.stepLineFill, { width: `${(at / (nb.youth.steps.length - 1)) * (100 - 100 / nb.youth.steps.length)}%` }]} />
      {nb.youth.steps.map((s, i) => (
        <View key={s} style={styles.step}>
          <View style={[styles.stepDot, i <= at && styles.stepDotOn]}>{i <= at ? <Icon name="check" size={10} color={colors.ink} /> : null}</View>
          <Text style={[styles.stepText, i <= at && styles.stepTextOn]}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

/** Two steps on purpose: withdrawing can't be undone, and the neighbour is told. */
function WithdrawSheet({ offer, onClose, onConfirm }: { offer: Offer | null; onClose: () => void; onConfirm: (o: Offer) => Promise<void> }) {
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const finish = async () => {
    if (!offer) return;
    setBusy(true);
    await onConfirm(offer);
    setBusy(false);
    onClose();
  };
  return (
    <Sheet visible={!!offer} onClose={onClose}>
      {offer ? (
        <View style={styles.leave}>
          <ScaleIn style={[styles.leaveIcon, sure && styles.leaveIconSure]}>
            <Icon name={sure ? 'alert' : 'undo'} size={28} color={sure ? colors.danger : colors.ink} />
          </ScaleIn>
          <Text style={[text.h2, styles.center]}>{sure ? nb.youth.withdrawSureTitle : nb.youth.withdrawTitle}</Text>
          <Text style={[text.body, styles.center, styles.leaveBody]}>{sure ? nb.youth.withdrawSureBody : nb.youth.withdrawBody(offer.who)}</Text>
          <View style={styles.leaveJob}>
            <CategoryArt category={offer.category} width={44} height={44} radius={14} iconSize={20} />
            <View style={styles.flex}>
              <Text style={text.label} numberOfLines={1}>
                {offer.title}
              </Text>
              <Text style={text.meta}>{offer.price}</Text>
            </View>
          </View>
          {sure ? (
            <Button label={nb.youth.withdrawFinal} variant="danger" size="lg" loading={busy} onPress={() => void finish()} />
          ) : (
            <Button label={nb.youth.withdrawYes} variant="dangerGhost" size="lg" onPress={() => setSure(true)} />
          )}
          <Button label={nb.youth.withdrawKeep} variant="ink" size="lg" onPress={onClose} />
        </View>
      ) : null}
    </Sheet>
  );
}

const STEP_SIDE = `${100 / 6}%` as const;

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 0 },
  stretch: { alignSelf: 'stretch' },
  center: { textAlign: 'center' },
  white: { color: colors.white },
  inkText: { color: colors.ink },
  stack: { gap: 12, paddingTop: 10 },
  head: { gap: 4 },
  sub: { fontSize: 14 },
  none: { color: colors.mute, paddingVertical: 12, textAlign: 'center' },
  emptyCard: { borderRadius: radius.listingCard, backgroundColor: colors.white, overflow: 'hidden', marginTop: 6 },
  emptyArt: { height: 170, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  blobL: { width: 200, height: 200, left: -70, bottom: -110, backgroundColor: colors.limeTint },
  blobR: { width: 180, height: 180, right: -60, top: -80, backgroundColor: colors.white, opacity: 0.6 },
  emptyRing: { position: 'absolute', width: 124, height: 124, borderRadius: 62, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.cyan },
  emptyDisc: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  chip: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.white },
  chipL: { left: 18, bottom: 22, transform: [{ rotate: '-6deg' }], paddingLeft: 5 },
  chipR: { right: 16, top: 26, transform: [{ rotate: '5deg' }] },
  chipDark: { backgroundColor: colors.ink },
  chipTick: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: text.label.fontFamily, fontSize: 12.5, color: colors.okText },
  dot: { position: 'absolute', borderRadius: 99 },
  dot1: { width: 10, height: 10, left: 40, top: 30, backgroundColor: colors.lime },
  dot2: { width: 7, height: 7, right: 60, bottom: 30, backgroundColor: colors.cyan },
  emptyBody: { padding: 18, gap: 8, alignItems: 'center' },
  stats: { flexDirection: 'row', borderRadius: radius.listingCard, backgroundColor: colors.ink, paddingVertical: 16, overflow: 'hidden' },
  statsBlob: { position: 'absolute', right: -60, top: -70, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.onInk16b },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statLine: { borderLeftWidth: 1, borderLeftColor: colors.onInk16b },
  statIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statNum: { fontFamily: text.h1.fontFamily, fontSize: 26, lineHeight: 30, color: colors.white },
  statLabel: { fontFamily: text.label.fontFamily, fontSize: 12, color: colors.onInk78 },
  filters: { gap: 8, paddingRight: 8 },
  fchip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingLeft: 14, paddingRight: 6, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  fchipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  fchipText: { fontFamily: text.label.fontFamily, fontSize: 13.5, color: colors.ink },
  fcount: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 7, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  fcountOn: { backgroundColor: colors.lime },
  fcountText: { fontFamily: text.label.fontFamily, fontSize: 12, color: colors.ink2 },
  card: { padding: 14, paddingLeft: 18, gap: 12, borderRadius: radius.listingCard, backgroundColor: colors.surface, overflow: 'hidden' },
  cardClosed: { opacity: 0.75 },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 16, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  price: { fontSize: 22, lineHeight: 26 },
  when: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.cyanTint },
  whenText: { flexShrink: 1, fontFamily: text.label.fontFamily, fontSize: 12.5, color: colors.cyanDeep },
  steps: { flexDirection: 'row', paddingTop: 2 },
  stepLineBg: { position: 'absolute', top: 10, left: STEP_SIDE, right: STEP_SIDE, height: 3, borderRadius: 2, backgroundColor: colors.progressTrack },
  stepLineFill: { position: 'absolute', top: 10, left: STEP_SIDE, height: 3, borderRadius: 2, backgroundColor: colors.lime2 },
  step: { flex: 1, alignItems: 'center', gap: 5 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.progressTrack, alignItems: 'center', justifyContent: 'center' },
  stepDotOn: { backgroundColor: colors.lime, borderColor: colors.lime },
  stepText: { fontFamily: text.label.fontFamily, fontSize: 11.5, color: colors.mute },
  stepTextOn: { color: colors.limeDeep },
  quote: { padding: 11, borderRadius: 16, borderBottomLeftRadius: 6, backgroundColor: colors.bg, gap: 2 },
  quoteBy: { fontFamily: text.label.fontFamily, fontSize: 12, color: colors.mute },
  quoteText: { ...text.body, fontSize: 14, lineHeight: 19, color: colors.ink2 },
  actions: { flexDirection: 'row', gap: 8 },
  leave: { alignItems: 'stretch', gap: 12, paddingTop: 8, paddingBottom: 4 },
  leaveIcon: { alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: colors.neutralPill, alignItems: 'center', justifyContent: 'center' },
  leaveIconSure: { backgroundColor: colors.dangerTint },
  leaveBody: { color: colors.ink2 },
  leaveJob: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.m, backgroundColor: colors.surface2 },
});
