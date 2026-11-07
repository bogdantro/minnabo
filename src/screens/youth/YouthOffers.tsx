import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { postedAgo } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { colors, radius, shadow, text, type CategoryId } from '@/theme/theme';
import { EmptyScene } from '@/components/ui/EmptyScene';
import { Button, CategoryArt, FadeUp, Icon, Pill, ScaleIn, Segmented, Sheet } from '@/components/ui';

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

/** Mine tilbud on /ung: what is waiting, what was accepted, and what to do next with each one. */
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
  const stats = [
    { n: offers.filter(isOpen).length, label: nb.youth.statsWaiting },
    { n: offers.filter(MATCHES.WON).length, label: nb.youth.statsWon },
    { n: offers.length, label: nb.youth.statsAll },
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
        <FadeUp delay={60} style={styles.empty}>
          <EmptyScene icon="tag" />
          <Text style={[text.h3, styles.center]}>{nb.youth.noOffers}</Text>
          <Text style={[text.meta, styles.center]}>{nb.youth.noOffersBody}</Text>
          <Button label={nb.youth.findMore} icon="search" onPress={onFind} style={styles.stretch} />
        </FadeUp>
      ) : (
        <>
          <FadeUp delay={50} style={[styles.stats, shadow.medium]}>
            {stats.map((s, i) => (
              <View key={s.label} style={[styles.stat, i > 0 && styles.statLine]}>
                <Text style={styles.statNum}>{s.n}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </FadeUp>
          <FadeUp delay={90}>
            <Segmented
              accessibilityLabel={nb.youth.filtersA11y}
              value={filter}
              onChange={setFilter}
              options={(Object.keys(nb.youth.filters) as Filter[]).map((k) => ({ value: k, label: nb.youth.filters[k] }))}
            />
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

function OfferCard({ offer: o, now, onOpenJob, onWithdraw }: { offer: Offer; now: Date; onOpenJob: () => void; onWithdraw: () => void }) {
  const open = isOpen(o);
  const closed = o.status === 'trukket' || o.status === 'avslatt';
  return (
    <View style={[styles.card, shadow.card, closed && styles.cardClosed]}>
      <View style={styles.top}>
        <CategoryArt category={o.category} width={60} height={60} radius={18} iconSize={26} />
        <View style={styles.flex}>
          <Text style={[text.cardTitle, styles.title]} numberOfLines={2}>
            {o.title}
          </Text>
          <Text style={text.meta} numberOfLines={1}>
            {`${o.who} · ${postedAgo(o.sentAt, now)}`}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={[text.num, styles.price]}>{o.price}</Text>
        <Pill label={nb.youth.status[o.status]} tone={STATUS_TONE[o.status]} />
      </View>

      {o.status !== 'trukket' ? <Steps status={o.status} /> : null}

      {o.whenText ? (
        <View style={styles.line}>
          <Icon name="cal" size={15} color={colors.mute} />
          <Text style={[text.meta, styles.flex]}>{o.whenText}</Text>
        </View>
      ) : null}
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

function Steps({ status }: { status: OfferStatus }) {
  const at = STEP[status];
  return (
    <View style={styles.steps}>
      {nb.youth.steps.map((s, i) => (
        <View key={s} style={styles.step}>
          <View style={styles.stepTrack}>
            <View style={[styles.stepLine, i <= at && styles.stepLineOn]} />
          </View>
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

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 0 },
  stretch: { alignSelf: 'stretch' },
  center: { textAlign: 'center' },
  stack: { gap: 12, paddingTop: 10 },
  head: { gap: 4 },
  sub: { fontSize: 14 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 24 },
  none: { color: colors.mute, paddingVertical: 12, textAlign: 'center' },
  stats: { flexDirection: 'row', borderRadius: radius.card, backgroundColor: colors.ink, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statLine: { borderLeftWidth: 1, borderLeftColor: colors.onInk16b },
  statNum: { fontFamily: text.h1.fontFamily, fontSize: 28, lineHeight: 32, color: colors.lime },
  statLabel: { fontFamily: text.label.fontFamily, fontSize: 12.5, color: colors.onInk78 },
  card: { padding: 14, gap: 12, borderRadius: radius.listingCard, backgroundColor: colors.surface },
  cardClosed: { opacity: 0.8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 16, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  price: { fontSize: 21, lineHeight: 25 },
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, gap: 4 },
  stepTrack: { height: 6, borderRadius: 3, backgroundColor: colors.progressTrack, overflow: 'hidden' },
  stepLine: { flex: 1, backgroundColor: colors.progressTrack },
  stepLineOn: { backgroundColor: colors.lime2 },
  stepText: { fontFamily: text.label.fontFamily, fontSize: 11.5, color: colors.mute },
  stepTextOn: { color: colors.limeDeep },
  line: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  quote: { padding: 11, borderRadius: radius.m, backgroundColor: colors.surface2, gap: 2 },
  quoteBy: { fontFamily: text.label.fontFamily, fontSize: 12, color: colors.mute },
  quoteText: { ...text.body, fontSize: 14, lineHeight: 19, color: colors.ink2 },
  actions: { flexDirection: 'row', gap: 8 },
  leave: { alignItems: 'stretch', gap: 12, paddingTop: 8, paddingBottom: 4 },
  leaveIcon: { alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: colors.neutralPill, alignItems: 'center', justifyContent: 'center' },
  leaveIconSure: { backgroundColor: colors.dangerTint },
  leaveBody: { color: colors.ink2 },
  leaveJob: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.m, backgroundColor: colors.surface2 },
});
