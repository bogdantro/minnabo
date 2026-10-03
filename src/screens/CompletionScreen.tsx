import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { categoryArtId } from '@/domain/categories';
import { formatPrice } from '@/domain/price';
import nb from '@/i18n/nb';
import {
  useAgreementByProposal,
  useCompletion,
  useConfirmCompletion,
  useJobWorkspace,
  useListing,
  useMyAgreements,
  useProfile,
  useProposal,
} from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatTime } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import { FallbackScreen } from '@/components/FallbackScreen';
import {
  Avatar,
  Button,
  CategoryArt,
  Confetti,
  DrawnCheck,
  FadeUp,
  Icon,
  Note,
  ScaleIn,
  Screen,
  Sheet,
  StickyFooter,
  SubHeader,
  TextLink,
  type IconKey,
} from '@/components/ui';

const duration = (ms: number) => {
  const min = Math.round(ms / 60_000);
  if (min <= 0) return '–';
  const h = Math.floor(min / 60);
  return h ? `${h} t ${min % 60} min` : `${min} min`;
};

/** Bekreft fullført jobb (design/screens/Fullforing.dc.html). */
export function CompletionScreen({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: proposal, isLoading, isError, refetch } = useProposal(proposalId);
  const { data: agreement } = useAgreementByProposal(proposalId);
  const { data: listing } = useListing(proposal?.listingId ?? '');
  const otherId = proposal ? (proposal.fromProfileId === me.id ? proposal.toProfileId : proposal.fromProfileId) : '';
  const { data: other } = useProfile(otherId);
  const { data: confirmations } = useCompletion(proposalId);
  const { data: ws } = useJobWorkspace(proposalId);
  const agenda = useMyAgreements();
  const confirm = useConfirmCompletion(proposalId);
  const [issue, setIssue] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [openedAt] = useState(() => Date.now());

  if (!proposal) {
    return <FallbackScreen status={isError ? 'error' : isLoading ? 'loading' : 'empty'} onRetry={() => refetch()} title={nb.completion.screenTitle} />;
  }

  const list = confirmations ?? [];
  const mine = list.find((c) => c.byProfileId === me.id);
  const theirs = list.find((c) => c.byProfileId === otherId);
  const done = !!mine && !!theirs;
  const first = (other?.displayName ?? '').split(' ')[0];
  const price = formatPrice(agreement?.price ?? proposal.price);
  const myRating = agenda.data?.find((a) => a.proposalId === proposalId)?.myRating;
  const cat = categoryArtId(listing?.category.slug ?? 'annet');

  const tracked = ws ? ws.timerAccumMs + (ws.timerStartedAt ? Math.max(0, openedAt - ws.timerStartedAt) : 0) : 0;
  const tasksDone = ws?.checklist.filter((c) => c.done).length ?? 0;
  const tasksTotal = ws?.checklist.length ?? 0;

  const doConfirm = () => {
    if (!me.id || confirm.isPending) return;
    confirm.mutate(me.id, {
      onSuccess: (next) => {
        haptics.success();
        if (next.length >= 2) {
          setCelebrate(true);
          toast.success(nb.completion.doneToast, { icon: 'checks', bottom: 190 });
        }
      },
      onError: () => toast.error(nb.toast.genericError),
    });
  };

  const sub = mine ? nb.completion.subMine(first) : theirs ? nb.completion.subOther(first) : nb.completion.subNone(first);
  const note = done ? nb.completion.noteDone : mine ? nb.completion.noteMine(first) : theirs ? nb.completion.noteOther(first) : nb.completion.noteNone;
  const meta = [other?.displayName, agreement?.scheduledText ?? proposal.scheduledText, listing?.location.place || listing?.location.municipality]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.flex}>
      <Screen
        scroll
        header={<SubHeader title={nb.completion.screenTitle} onBack={() => (router.canGoBack() ? router.back() : router.replace(`/avtale/${proposalId}`))} />}
      >
        {done ? (
          <View style={[styles.px, styles.doneHero]}>
            <ScaleIn>
              <View style={styles.bigWrap}>
                <View style={styles.bigRing} />
                <DrawnCheck size={108} bg={colors.lime} tickColor={colors.ink} ring={shadow.bigOk} tickSize={58} radius={36} />
              </View>
            </ScaleIn>
            <FadeUp delay={150}>
              <Text style={[styles.display, styles.center]} accessibilityRole="header">
                {nb.completion.doneTitle}
              </Text>
            </FadeUp>
            <FadeUp delay={200}>
              <Text style={[text.body, styles.muted, styles.center, styles.maxW]}>{nb.completion.doneSub}</Text>
            </FadeUp>
          </View>
        ) : (
          <FadeUp style={[styles.px, styles.hero]}>
            <Text style={text.eyebrow}>{nb.completion.eyebrow}</Text>
            <Text style={text.h1} accessibilityRole="header">
              {nb.completion.question}
            </Text>
            <Text style={[text.body, styles.muted]}>{sub}</Text>
          </FadeUp>
        )}

        {/* two-party confirmation */}
        <FadeUp delay={100} style={[styles.px, styles.mt22]}>
          <View style={[styles.card, styles.duo, shadow.card]}>
            <View style={styles.duoRow}>
              <View style={styles.track}>
                <ProgressFill to={(theirs ? 0.5 : 0) + (mine ? 0.5 : 0)} />
              </View>
              <View style={[styles.mid, done && styles.midOk]}>
                <Icon name="hand" size={18} color={done ? colors.white : colors.mute} />
              </View>
              <Party
                name={other?.displayName ?? ''}
                initials={other?.initials ?? '·'}
                uri={other?.avatarUrl}
                seed={otherId}
                at={theirs?.confirmedAt}
                waitingLabel={nb.completion.waiting}
              />
              <Party
                name={nb.completion.you}
                initials={me.initials}
                uri={me.avatarUrl}
                me
                at={mine?.confirmedAt}
                waitingLabel={nb.completion.waitingYou}
                pulse={!mine}
              />
            </View>
            <View style={styles.divider} />
            <Note icon="shield">{note}</Note>
          </View>
        </FadeUp>

        {/* summary */}
        <FadeUp delay={150} style={[styles.px, styles.mt14]}>
          <View style={[styles.card, styles.pad, shadow.card]}>
            <View style={styles.sumHead}>
              <CategoryArt category={cat} uri={listing?.images[0]?.url} width={52} height={52} radius={16} iconSize={24} />
              <View style={styles.flex1}>
                <Text style={[text.label, styles.f165]} numberOfLines={2}>
                  {listing?.title ?? ''}
                </Text>
                <Text style={text.meta} numberOfLines={1}>
                  {meta}
                </Text>
              </View>
            </View>
            <View style={styles.stats}>
              <Stat icon="clock" label={nb.completion.timeUsed} value={duration(tracked)} />
              <Stat icon="list" label={nb.completion.tasks} value={tasksTotal ? `${tasksDone}/${tasksTotal}` : '–'} />
              <Stat icon="image" label={nb.completion.photos} value={String(ws?.photos.length ?? 0)} />
              <Stat icon="tag" label={nb.completion.price} value={price} suffix={nb.completion.agreed} />
            </View>
            <TextLink label={nb.completion.seeAgreement} icon="right" onPress={() => safePush(`/avtale/${proposalId}`)} style={styles.mt6} />
          </View>
        </FadeUp>

        <FadeUp delay={200} style={[styles.px, styles.mt14]}>
          <View style={styles.pay}>
            <View style={styles.payIc}>
              <Icon name="info" size={18} color={colors.cyanDeep} />
            </View>
            <View style={styles.flex1}>
              <Text style={[text.label, styles.f145]}>{nb.completion.payTitle}</Text>
              <Text style={[text.meta, styles.mt3]}>{nb.completion.paySub(price)}</Text>
            </View>
          </View>
        </FadeUp>
        <View style={styles.bottom} />
      </Screen>

      <StickyFooter>
        {done ? (
          <FadeUp style={styles.footCol}>
            {myRating == null ? (
              <Button label={nb.completion.giveReview} icon="star" size="lg" onPress={() => router.replace(`/vurder/${proposalId}`)} />
            ) : (
              <Button label={nb.completion.reviewed} icon="check" variant="ghost" size="lg" disabled onPress={() => undefined} />
            )}
            <Button label={nb.completion.toAgreements} variant="text" block={false} onPress={() => router.replace('/avtaler')} style={styles.selfCenter} />
          </FadeUp>
        ) : (
          <View style={styles.footCol}>
            {!mine ? (
              <Button
                label={nb.completion.confirmCta}
                icon="check"
                size="lg"
                loading={confirm.isPending}
                loadingLabel={nb.completion.confirming}
                onPress={doConfirm}
              />
            ) : null}
            <Button label={nb.completion.issue} variant="text" block={false} onPress={() => setIssue(true)} style={styles.selfCenter} />
          </View>
        )}
      </StickyFooter>

      {celebrate || done ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Confetti count={40} />
        </View>
      ) : null}

      <Sheet visible={issue} onClose={() => setIssue(false)} title={nb.completion.issue} titleSize="h2">
        <Text style={[text.body, styles.ink2, styles.mb18]}>{nb.completion.issueBody}</Text>
        <View style={styles.gap10}>
          <IssueOption
            icon="msg"
            bg={colors.cyanTint}
            fg={colors.cyanDeep}
            title={nb.completion.issueChat}
            sub={nb.completion.issueChatSub(first)}
            onPress={() => {
              setIssue(false);
              safePush(`/chat/${proposal.conversationId}`);
            }}
          />
          <IssueOption
            icon="flag"
            bg={colors.dangerTint}
            fg={colors.danger}
            title={nb.completion.issueReport}
            sub={nb.completion.issueReportSub}
            onPress={() => {
              setIssue(false);
              safePush(`/rapporter?profil=${otherId}`);
            }}
          />
        </View>
        <Note style={styles.mt16}>{nb.completion.issueNote}</Note>
      </Sheet>
    </View>
  );
}

function ProgressFill({ to }: { to: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? to : 0);
  useEffect(() => {
    p.set(reduced ? to : withTiming(to, { duration: 1000, easing: Easing.bezier(0.6, 0, 0.2, 1) }));
  }, [to, reduced, p]);
  const style = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return <Animated.View style={[styles.trackFill, style]} />;
}

function Party({
  name,
  initials,
  uri,
  seed,
  me,
  at,
  waitingLabel,
  pulse,
}: {
  name: string;
  initials: string;
  uri?: string;
  seed?: string;
  me?: boolean;
  at?: string;
  waitingLabel: string;
  pulse?: boolean;
}) {
  return (
    <View style={styles.node}>
      <View>
        {pulse ? <PulseRing /> : null}
        <Avatar initials={initials} uri={uri} seed={seed} me={me} size={56} />
        <ScaleIn key={at ? 'ok' : 'wait'} style={[styles.badge, at ? styles.badgeOk : styles.badgeWait]}>
          <Icon name={at ? 'check' : 'hourglass'} size={14} color={colors.white} />
        </ScaleIn>
      </View>
      <View style={styles.nodeText}>
        <Text style={[text.label, styles.f145, styles.center]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.nodeSub, at ? { color: colors.okText } : { color: colors.warn }]}>
          {at ? nb.completion.confirmedAt(formatTime(at)) : waitingLabel}
        </Text>
      </View>
    </View>
  );
}

/** `.avw.pulse` – lime ring radiating out while it's your turn. */
function PulseRing() {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!reduced) p.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false));
  }, [reduced, p]);
  const style = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - p.value), transform: [{ scale: 1 + p.value * 0.4 }] }));
  if (reduced) return null;
  return <Animated.View style={[styles.pulse, style]} pointerEvents="none" />;
}

function Stat({ icon, label, value, suffix }: { icon: IconKey; label: string; value: string; suffix?: string }) {
  return (
    <View style={styles.st}>
      <View style={styles.sl}>
        <Icon name={icon} size={14} color={colors.faint} />
        <Text style={styles.slText}>{label}</Text>
      </View>
      <Text style={styles.stB} numberOfLines={1}>
        {value}
        {suffix ? <Text style={styles.stSuffix}>{` ${suffix}`}</Text> : null}
      </Text>
    </View>
  );
}

function IssueOption({ icon, bg, fg, title, sub, onPress }: { icon: IconKey; bg: string; fg: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.opt, pressed && styles.pressed]}>
      <View style={[styles.optIc, { backgroundColor: bg }]}>
        <Icon name={icon} size={22} color={fg} />
      </View>
      <View style={styles.flex1}>
        <Text style={[text.label, styles.f16]}>{title}</Text>
        <Text style={text.meta}>{sub}</Text>
      </View>
      <Icon name="right" size={18} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex1: { flex: 1, minWidth: 0, gap: 2 },
  px: { paddingHorizontal: screenPadding },
  center: { textAlign: 'center' },
  muted: { color: colors.mute },
  ink2: { color: colors.ink2 },
  maxW: { maxWidth: 300 },
  selfCenter: { alignSelf: 'center' },
  pressed: { transform: [{ scale: 0.98 }] },
  f145: { fontSize: 14.5 },
  f16: { fontSize: 16 },
  f165: { fontSize: 16.5, lineHeight: 21 },
  gap10: { gap: 10 },
  mt3: { marginTop: 3 },
  mt6: { marginTop: 6 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  mt22: { marginTop: 22 },
  mb18: { marginBottom: 18 },
  hero: { paddingTop: 10, gap: 8 },
  doneHero: { paddingTop: 14, alignItems: 'center', gap: 10 },
  bigWrap: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' },
  bigRing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 44, borderWidth: 2, borderColor: colors.bigOkRing },
  display: { fontFamily: text.h1.fontFamily, fontSize: 38, lineHeight: 41, letterSpacing: -1, color: colors.ink, marginTop: 10 },
  card: { backgroundColor: colors.white, borderRadius: radius.card },
  pad: { padding: 18 },
  duo: { paddingTop: 22, paddingHorizontal: 18, paddingBottom: 18 },
  duoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  track: { position: 'absolute', left: 84, right: 84, top: 25, height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 3, backgroundColor: colors.ok },
  mid: {
    position: 'absolute',
    left: '50%',
    top: 11,
    marginLeft: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  midOk: { backgroundColor: colors.ok, borderColor: colors.ok },
  node: { width: 112, alignItems: 'center', gap: 10, zIndex: 2 },
  nodeText: { alignItems: 'center', alignSelf: 'stretch' },
  nodeSub: { fontFamily: text.bodySemi.fontFamily, fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: 'center' },
  badge: { position: 'absolute', right: -4, bottom: -4, width: 26, height: 26, borderRadius: 13, borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  badgeOk: { backgroundColor: colors.ok },
  badgeWait: { backgroundColor: colors.star },
  pulse: { position: 'absolute', top: 0, left: 0, width: 56, height: 56, borderRadius: 28, borderWidth: 6, borderColor: colors.limeDot },
  divider: { height: 1, backgroundColor: colors.line2, marginTop: 18, marginBottom: 14 },
  sumHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  st: { flexBasis: '46%', flexGrow: 1, padding: 14, borderRadius: 18, backgroundColor: colors.surface2, gap: 6 },
  sl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slText: { fontFamily: text.bodySemi.fontFamily, fontSize: 12.5, color: colors.mute },
  stB: { fontFamily: text.h3.fontFamily, fontSize: 21, lineHeight: 24, letterSpacing: -0.42, color: colors.ink },
  stSuffix: { fontFamily: text.bodySemi.fontFamily, fontSize: 12, letterSpacing: 0, color: colors.okText },
  pay: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  payIc: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  bottom: { height: 170 },
  footCol: { gap: 6 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.option, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  optIc: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
