import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { formatPrice } from '@/domain/price';
import { useAgreementByProposal, useCancelAgreement, useListing, useProfile, useProposal } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatTime, shortDate } from '@/lib/datetime';
import {
  addAgreementToCalendar,
  daysUntil,
  deviceCalendarSupported,
  parseAgreedTime,
  parseDurationHours,
  removeCalendarEvent,
} from '@/lib/deviceCalendar';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, motion, radius, screenPadding, shadow, text } from '@/theme/theme';
import { FallbackScreen } from '@/components/FallbackScreen';
import {
  Avatar,
  Button,
  Chip,
  Dialog,
  FadeUp,
  FooterRow,
  Icon,
  IconButton,
  KeyValueRow,
  PaymentNote,
  Pill,
  ScaleIn,
  Screen,
  StickyFooter,
  SubHeader,
  type IconKey,
} from '@/components/ui';

type Step = { key: keyof typeof nb.avtaleSum.steps; icon: IconKey; state: 'done' | 'cur' | 'x' | '' };

/** Avtalesammendrag (design/screens/Avtale.dc.html). */
export function AvtaleSammendragScreen({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: proposal, isLoading, isError, refetch } = useProposal(proposalId);
  const { data: agreement } = useAgreementByProposal(proposalId);
  const { data: listing } = useListing(proposal?.listingId ?? '');
  const helperId = proposal?.fromProfileId ?? '';
  const clientId = proposal?.toProfileId ?? '';
  const { data: helper } = useProfile(helperId);
  const { data: client } = useProfile(clientId);
  const cancel = useCancelAgreement(proposalId, proposal?.conversationId ?? '');

  const [dialog, setDialog] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);

  if (!proposal) {
    return (
      <FallbackScreen status={isError ? 'error' : isLoading ? 'loading' : 'empty'} onRetry={() => refetch()} title={nb.avtaleSum.title} />
    );
  }

  const cancelled = proposal.status === 'CANCELLED' || !!agreement?.cancelledAt;
  const iAmHelper = me.id === helperId;
  const other = iAmHelper ? client : helper;
  const first = (other?.displayName ?? '').split(' ')[0];
  const price = agreement?.price ?? proposal.price;
  const when = agreement?.scheduledText ?? proposal.scheduledText;
  const duration = listing?.task?.durationText;
  const description = agreement?.description || listing?.task?.description || '';
  const caveats = agreement?.caveats ?? proposal.caveats;
  const place = listing?.location.place || listing?.location.municipality;
  const start = parseAgreedTime(when);
  const days = start ? daysUntil(start) : null;
  const countdown =
    days == null || days < 0 ? null : days === 0 ? nb.avtaleSum.today : days === 1 ? nb.avtaleSum.tomorrow : nb.avtaleSum.inDays(days);
  const agreedAt = agreement?.agreedAt ?? proposal.createdAt;

  const ls = listing?.status;
  const steps: Step[] = cancelled
    ? [
        { key: 'sent', icon: 'check', state: 'done' },
        { key: 'accepted', icon: 'check', state: 'done' },
        { key: 'cancelled', icon: 'x', state: 'x' },
        { key: 'done', icon: 'checks', state: '' },
        { key: 'reviewed', icon: 'star', state: '' },
      ]
    : [
        { key: 'sent', icon: 'check', state: 'done' },
        { key: 'accepted', icon: 'check', state: 'done' },
        { key: 'jobDay', icon: 'cal', state: ls === 'COMPLETION_SENT' || ls === 'COMPLETED' || ls === 'REVIEWED' ? 'done' : 'cur' },
        { key: 'done', icon: 'checks', state: ls === 'COMPLETED' || ls === 'REVIEWED' ? 'done' : ls === 'COMPLETION_SENT' ? 'cur' : '' },
        { key: 'reviewed', icon: 'star', state: ls === 'REVIEWED' ? 'done' : ls === 'COMPLETED' ? 'cur' : '' },
      ];
  const lastDone = steps.reduce((n, s, i) => (s.state === 'done' ? i : n), 0);

  const toggleCalendar = async () => {
    if (eventId) {
      await removeCalendarEvent(eventId);
      setEventId(null);
      toast.info(nb.avtaleSum.calRemoved, { icon: 'x', bottom: 150 });
      return;
    }
    if (!start) return;
    const res = await addAgreementToCalendar({
      title: listing?.title ?? nb.avtaleSum.title,
      start,
      hours: parseDurationHours(duration),
      location: place,
      notes: `${nb.avtaleSum.kvPrice}: ${formatPrice(price)}\n${nb.giTilbud.payNote}`,
    });
    if (res.ok) {
      setEventId(res.eventId);
      toast.success(nb.avtaleSum.calToast(when ?? ''), {
        icon: 'cal',
        bottom: 150,
        action: {
          label: nb.avtaleSum.undo,
          onPress: () => {
            void removeCalendarEvent(res.eventId);
            setEventId(null);
          },
        },
      });
    } else {
      toast.error(res.reason === 'denied' ? nb.avtaleSum.calDenied : nb.avtaleSum.calFailed, { bottom: 150 });
    }
  };

  const confirmCancel = async () => {
    try {
      await cancel.mutateAsync(reason ?? undefined);
      setDialog(false);
      toast.info(nb.avtaleSum.cancelledToast(first), { icon: 'ban', bottom: 150 });
    } catch {
      toast.error(nb.toast.genericError);
    }
  };

  const openChat = () => safePush(`/chat/${proposal.conversationId}`);

  return (
    <View style={styles.flex}>
      <Screen
        scroll
        header={
          <SubHeader
            title={nb.avtaleSum.title}
            onBack={() => (router.canGoBack() ? router.back() : router.replace('/avtaler'))}
            right={<IconButton icon="shield" iconSize={18} accessibilityLabel={nb.avtaleSum.trusted} onPress={() => safePush('/trygge-kontakter')} />}
          />
        }
      >
        {cancelled ? (
          <ScaleIn style={[styles.px, styles.mb10]}>
            <View style={styles.cancelBanner}>
              <View style={styles.cancelIc}>
                <Icon name="ban" size={18} color={colors.danger} />
              </View>
              <View style={styles.flex1}>
                <Text style={[text.label, styles.cancelTitle]}>{nb.avtaleSum.cancelledBanner}</Text>
                <Text style={styles.cancelSub}>{nb.avtaleSum.cancelledInfo(first, agreement?.cancelReason)}</Text>
              </View>
            </View>
          </ScaleIn>
        ) : null}

        {/* heading */}
        <FadeUp style={[styles.px, styles.heading]}>
          <Text style={text.eyebrow} numberOfLines={1}>
            {listing?.title ?? ''}
          </Text>
          <Text style={text.h1} accessibilityRole="header">
            {cancelled ? nb.avtaleSum.cancelledTitle : nb.avtaleSum.ready}
          </Text>
          <View style={styles.pills}>
            {!cancelled && countdown ? <Pill label={countdown} tone="accent" icon="hourglass" size="lg" /> : null}
            {when ? <Pill label={when} tone="line" icon="cal" size="lg" /> : null}
          </View>
        </FadeUp>

        {/* document */}
        <FadeUp delay={100} style={[styles.px, styles.mt18]}>
          <View style={[styles.doc, shadow.medium]} accessibilityLabel={nb.avtaleSum.docLabel}>
            <View style={[styles.edge, cancelled && styles.edgeOff]} />
            <ScaleIn delay={250} style={styles.stamp}>
              <View style={[styles.stampIn, cancelled && styles.stampOff]}>
                <Icon name={cancelled ? 'ban' : 'lock'} size={14} color={cancelled ? colors.stampOffText : colors.stampOkText} />
                <Text style={[styles.stampText, cancelled && { color: colors.stampOffText }]}>
                  {cancelled ? nb.avtaleSum.stampCancelled : nb.avtaleSum.stampAgreed}
                </Text>
              </View>
            </ScaleIn>
            <View style={styles.paper}>
              <View style={styles.row10}>
                <View style={styles.lockIc}>
                  <Icon name="lock" size={16} color={colors.lime} />
                </View>
                <View style={styles.gap3}>
                  <Text style={[text.label, styles.f145]}>{nb.avtaleSum.locked}</Text>
                  <Text style={text.meta}>{nb.avtaleSum.agreedAt(`${shortDate(agreedAt).replace(/^\S+ /, '')} kl. ${formatTime(agreedAt)}`)}</Text>
                </View>
              </View>

              <View style={styles.parties}>
                <Party
                  name={client?.displayName ?? ''}
                  initials={client?.initials ?? '·'}
                  uri={client?.avatarUrl}
                  id={clientId}
                  me={!iAmHelper}
                  role={nb.avtaleSum.client}
                  tone="need"
                />
                <View style={styles.linkLine}>
                  <View style={styles.dash} />
                  <View style={[styles.hs, cancelled && styles.hsOff]}>
                    <Icon name="hand" size={18} color={cancelled ? colors.faint : colors.lime} />
                  </View>
                </View>
                <Party
                  name={helper?.displayName ?? ''}
                  initials={helper?.initials ?? '·'}
                  uri={helper?.avatarUrl}
                  id={helperId}
                  me={iAmHelper}
                  role={nb.avtaleSum.helper}
                  tone="offer"
                />
              </View>

              <View style={styles.divider} />
              <View style={cancelled ? styles.kvsOff : undefined}>
                {(
                  [
                    [nb.avtaleSum.kvTask, listing?.title],
                    [nb.avtaleSum.kvPrice, formatPrice(price)],
                    [nb.avtaleSum.kvWhen, when],
                    [nb.avtaleSum.kvDuration, duration],
                    [nb.avtaleSum.kvPlace, place ? nb.avtaleSum.placeNote(place) : undefined],
                    [nb.avtaleSum.kvDescription, description],
                    [nb.avtaleSum.kvCaveats, caveats],
                  ] as [string, string | undefined][]
                )
                  .filter((r): r is [string, string] => !!r[1])
                  .map(([k, v], i, arr) => (
                    <KeyValueRow key={k} label={k} value={v} last={i === arr.length - 1} />
                  ))}
              </View>
            </View>
          </View>
        </FadeUp>

        {/* progress */}
        <FadeUp delay={150} style={[styles.px, styles.mt14]}>
          <View style={[styles.card, styles.progressCard, shadow.card]}>
            <Text style={[text.eyebrow, styles.progressTitle]}>{nb.avtaleSum.progress}</Text>
            <Progress steps={steps} lastDone={lastDone} />
          </View>
        </FadeUp>

        {/* notes */}
        <FadeUp delay={200} style={[styles.px, styles.mt14, styles.gap10]}>
          <View style={styles.changeNote}>
            <Icon name="repeat" size={18} color={colors.warnDark} />
            <Text style={styles.changeText}>{nb.avtaleSum.changesNote}</Text>
          </View>
          <PaymentNote style={styles.noteIndent} />
        </FadeUp>

        {/* quick actions */}
        <FadeUp delay={250} style={[styles.px, styles.mt20, styles.qa]}>
          {deviceCalendarSupported && start && !cancelled ? (
            <QuickAction
              icon={eventId ? 'check' : 'cal'}
              bg={eventId ? colors.okTint : colors.limeTint}
              fg={eventId ? colors.ok : colors.limeDeep}
              label={eventId ? nb.avtaleSum.addedCal : nb.avtaleSum.addCal}
              selected={!!eventId}
              onPress={() => void toggleCalendar()}
            />
          ) : null}
          <QuickAction icon="msg" bg={colors.cyanTint} fg={colors.cyanDeep} label={nb.avtaleSum.openChat} onPress={openChat} />
          <QuickAction icon="shield" bg={colors.bg} fg={colors.ink} label={nb.avtaleSum.shareTrusted} onPress={() => safePush('/trygge-kontakter')} />
        </FadeUp>

        {!cancelled ? (
          <FadeUp delay={300} style={[styles.px, styles.mt18]}>
            <Button label={nb.avtaleSum.cancel} icon="ban" variant="dangerGhost" onPress={() => { setReason(null); setDialog(true); }} />
          </FadeUp>
        ) : null}
        <View style={styles.bottom} />
      </Screen>

      <StickyFooter>
        <FooterRow>
          <Button label={nb.avtaleSum.openChat} icon="msg" variant="ghost" block={false} onPress={openChat} style={styles.grow1} />
          {cancelled ? (
            <Button
              label={iAmHelper ? nb.avtaleSum.toOppdrag : nb.avtaleSum.otherOffers}
              iconRight="arrow"
              variant="ink"
              block={false}
              onPress={() => router.replace(iAmHelper ? '/' : '/tilbud')}
              style={styles.grow135}
            />
          ) : (
            <Button label={nb.avtaleSum.openJobDay} iconRight="arrow" block={false} onPress={() => safePush(`/jobbdag/${proposalId}`)} style={styles.grow135} />
          )}
        </FooterRow>
      </StickyFooter>

      <Dialog
        visible={dialog}
        onClose={() => !cancel.isPending && setDialog(false)}
        icon="ban"
        tone="danger"
        title={nb.avtaleSum.dlgTitle}
        body={nb.avtaleSum.dlgBody(first)}
        actions={
          <View style={styles.dlg}>
            <View style={styles.reasons}>
              {nb.avtaleSum.reasons.map((r) => (
                <Chip key={r} label={r} size="sm" selected={reason === r} onPress={() => setReason(reason === r ? null : r)} />
              ))}
            </View>
            <Button
              label={nb.avtaleSum.cancel}
              variant="danger"
              loading={cancel.isPending}
              loadingLabel={nb.avtaleSum.cancelling}
              onPress={confirmCancel}
            />
            <Button label={nb.avtaleSum.keep} variant="ghost" onPress={() => setDialog(false)} />
          </View>
        }
      />
    </View>
  );
}

function Party({
  name,
  initials,
  uri,
  id,
  me,
  role,
  tone,
}: {
  name: string;
  initials: string;
  uri?: string;
  id: string;
  me: boolean;
  role: string;
  tone: 'need' | 'offer';
}) {
  return (
    <View style={styles.party}>
      <Avatar initials={initials} uri={uri} seed={id} me={me} size={56} />
      <Text style={styles.partyName} numberOfLines={1}>
        {name}
      </Text>
      <Pill label={role} tone={tone} size="sm" />
    </View>
  );
}

function QuickAction({
  icon,
  bg,
  fg,
  label,
  onPress,
  selected,
}: {
  icon: IconKey;
  bg: string;
  fg: string;
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={selected != null ? { selected } : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.qaItem, shadow.card, pressed && styles.pressed]}
    >
      <View style={[styles.qaIc, { backgroundColor: bg }]}>
        <Icon name={icon} size={18} color={fg} />
      </View>
      <Text style={styles.qaText}>{label}</Text>
    </Pressable>
  );
}

/** `.ptl` – five nodes with a green fill line that grows to the last finished step. */
function Progress({ steps, lastDone }: { steps: Step[]; lastDone: number }) {
  const reduced = useReducedMotion();
  const target = lastDone / (steps.length - 1);
  const p = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    if (!reduced) p.set(withDelay(400, withTiming(target, { duration: 1200, easing: Easing.bezier(...motion.ease) })));
  }, [target, reduced, p]);
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={styles.ptl}>
      <View style={styles.ptlTrack}>
        <Animated.View style={[styles.ptlFill, fill]} />
      </View>
      {steps.map((s) => (
        <View key={s.key} style={styles.pn} accessible accessibilityLabel={`${nb.avtaleSum.steps[s.key]}${s.state === 'done' ? ', ferdig' : s.state === 'cur' ? ', nå' : ''}`}>
          <View style={[styles.pnC, s.state === 'done' && styles.pnDone, s.state === 'cur' && styles.pnCur, s.state === 'x' && styles.pnX]}>
            <Icon
              name={s.icon}
              size={16}
              color={s.state === 'done' ? colors.white : s.state === 'cur' ? colors.lime : s.state === 'x' ? colors.danger : colors.control}
            />
          </View>
          <Text style={[styles.pnText, (s.state === 'done' || s.state === 'cur') && { color: colors.ink }, s.state === 'x' && { color: colors.danger }]}>
            {nb.avtaleSum.steps[s.key]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex1: { flex: 1, gap: 2 },
  px: { paddingHorizontal: screenPadding },
  f145: { fontSize: 14.5 },
  gap3: { gap: 3 },
  gap10: { gap: 10 },
  mb10: { marginBottom: 10 },
  mt14: { marginTop: 14 },
  mt18: { marginTop: 18 },
  mt20: { marginTop: 20 },
  row10: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { transform: [{ scale: 0.96 }] },
  grow1: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  grow135: { flexGrow: 1.35, flexShrink: 1, flexBasis: 'auto' },
  heading: { gap: 10, paddingTop: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cancelBanner: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 20, backgroundColor: colors.dangerTint },
  cancelIc: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  cancelTitle: { fontSize: 15, color: colors.danger },
  cancelSub: { fontFamily: text.body.fontFamily, fontSize: 13, lineHeight: 18, color: colors.dangerDark },
  doc: { backgroundColor: colors.white, borderRadius: 28, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  edge: { height: 6, backgroundColor: colors.lime },
  edgeOff: { backgroundColor: colors.edgeOff },
  stamp: { position: 'absolute', right: 16, top: 26, zIndex: 2 },
  stampIn: {
    transform: [{ rotate: '-12deg' }],
    borderWidth: 2.5,
    borderColor: colors.stampOkBorder,
    backgroundColor: colors.stampOkBg,
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stampOff: { borderColor: colors.stampOffBorder, backgroundColor: colors.stampOffBg },
  stampText: { fontFamily: text.h1.fontFamily, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', color: colors.stampOkText },
  paper: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 8 },
  lockIc: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  parties: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 16, paddingBottom: 14 },
  party: { flex: 1, alignItems: 'center', gap: 8 },
  partyName: { fontFamily: text.label.fontFamily, fontSize: 14.5, lineHeight: 17, color: colors.ink, textAlign: 'center' },
  linkLine: { width: 70, height: 40, alignItems: 'center', justifyContent: 'center' },
  dash: { position: 'absolute', left: 0, right: 0, top: 19, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.dashed },
  hs: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white },
  hsOff: { backgroundColor: colors.neutralPill },
  divider: { height: 1, backgroundColor: colors.line2 },
  kvsOff: { opacity: 0.55 },
  card: { backgroundColor: colors.white, borderRadius: radius.card },
  progressCard: { paddingTop: 18, paddingHorizontal: 12, paddingBottom: 16 },
  progressTitle: { paddingHorizontal: 8, paddingBottom: 14 },
  ptl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ptlTrack: { position: 'absolute', left: 30, right: 30, top: 15, height: 3, borderRadius: 2, backgroundColor: colors.track },
  ptlFill: { height: 3, borderRadius: 2, backgroundColor: colors.limeDot },
  pn: { width: 60, alignItems: 'center', gap: 8 },
  pnC: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.progressTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pnDone: { backgroundColor: colors.ok, borderColor: colors.ok },
  pnCur: { backgroundColor: colors.ink, borderColor: colors.ink },
  pnX: { backgroundColor: colors.dangerTint, borderColor: colors.dangerBorder },
  pnText: { fontFamily: text.bodySemi.fontFamily, fontSize: 11.5, lineHeight: 14, color: colors.mute, textAlign: 'center' },
  changeNote: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.warnTint },
  changeText: { flex: 1, fontFamily: text.bodySemi.fontFamily, fontSize: 14, lineHeight: 19.6, color: colors.warnDark },
  noteIndent: { paddingHorizontal: 4 },
  qa: { flexDirection: 'row', gap: 10 },
  qaItem: {
    flex: 1,
    minHeight: 96,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qaIc: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  qaText: { fontFamily: text.label.fontFamily, fontSize: 13, lineHeight: 16, color: colors.ink, textAlign: 'center' },
  bottom: { height: 150 },
  dlg: { gap: 10, alignSelf: 'stretch' },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 6, marginBottom: 10 },
});
