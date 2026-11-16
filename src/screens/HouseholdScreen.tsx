import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { useHousehold, useHouseholdActions } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { codeDaysLeft, filterWho, HOUSEHOLD_CODE_LEN, type WhoFilter } from '@/domain/household';
import type { Household } from '@/domain/types';
import { dayMonth } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, screenPadding, shadow, text, type CategoryId } from '@/theme/theme';
import {
  Button,
  CategoryArt,
  Chip,
  Dialog,
  ErrorState,
  FadeUp,
  Icon,
  Note,
  Pill,
  RowSkeleton,
  Screen,
  SubHeader,
  TextLink,
} from '@/components/ui';
import { HeroStat, HouseholdHero } from '@/components/household/HouseholdHero';
import { CodeInput, CodeTiles } from '@/components/household/CodeCells';
import { WhenTimeline } from '@/components/household/WhenTimeline';

/**
 * Husstand (0101, redesigned 2026-11-13 with 0105): two adults in one home see each other's oppdrag and avtaler.
 * Not in one: the art hero, three steps, «Inviter» (a code on ink) and «Jeg har en kode» (six cells).
 * Together: «Du og Emma», «Hvem kommer når» for both, the partner's oppdrag, and leaving. Youth: locked.
 */
export function HouseholdScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const { data, isLoading, isError, refetch } = useHousehold(!me.isYouth);
  const t = nb.household;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen scroll header={<SubHeader title={t.title} onBack={back} />}>
      <View style={styles.body}>
        {me.isYouth ? (
          <YouthLocked />
        ) : isLoading ? (
          <>
            <RowSkeleton />
            <RowSkeleton />
          </>
        ) : isError || !data ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : data.partner ? (
          <Together data={data as Household & { partner: { id: string; name: string } }} />
        ) : (
          <NotYet data={data} refetch={() => refetch().then((r) => r.data)} />
        )}
      </View>
    </Screen>
  );
}

// ------------------------------------------------------------
// Not in a household yet: invite, or type the code you got
// ------------------------------------------------------------
function NotYet({ data, refetch }: { data: Household; refetch: () => Promise<Household | undefined> }) {
  const t = nb.household;
  const { invite, join, leave } = useHouseholdActions();
  const [code, setCode] = useState('');

  const makeCode = () =>
    invite.mutate(undefined, {
      onSuccess: () => haptics.success(),
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
    });
  const takeBack = (then?: () => void) =>
    leave.mutate(undefined, {
      onSuccess: () => {
        haptics.select();
        if (then) then();
        else toast.info(t.takenBack, { icon: 'undo' });
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
    });
  const doJoin = () => {
    if (code.length < HOUSEHOLD_CODE_LEN || join.isPending) return;
    join.mutate(code, {
      onSuccess: () => {
        haptics.success();
        setCode('');
        void refetch().then((d) => toast.success(t.joined(d?.partner?.name ?? ''), { icon: 'home' }));
      },
      onError: (e) => {
        haptics.warning();
        toast.error(serverMessage(e, nb.toast.genericError));
      },
    });
  };

  return (
    <>
      <FadeUp>
        <HouseholdHero eyebrow={t.eyebrow} title={t.introTitle} lead={t.intro}>
          <View style={styles.points}>
            {t.points.map((p) => (
              <View key={p} style={styles.point}>
                <View style={styles.tick}>
                  <Icon name="check" size={12} color={colors.ink} />
                </View>
                <Text style={styles.pointText}>{p}</Text>
              </View>
            ))}
          </View>
        </HouseholdHero>
      </FadeUp>

      {data.code ? (
        <FadeUp delay={60}>
          <CodeCard
            code={data.code.code}
            expiresAt={data.code.expiresAt}
            busy={invite.isPending || leave.isPending}
            onNew={makeCode}
            onTakeBack={() => takeBack()}
          />
          <TextLink label={t.gotCodeInstead} onPress={() => takeBack(() => undefined)} style={styles.instead} />
        </FadeUp>
      ) : (
        <>
          <FadeUp delay={60}>
            <Steps />
          </FadeUp>
          <FadeUp delay={100} style={[styles.inviteCard, shadow.medium]}>
            <View style={styles.inviteHead}>
              <View style={styles.inviteDisc}>
                <Icon name="send" size={20} color={colors.ink} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.inviteTitle}>{t.inviteTitle}</Text>
                <Text style={styles.inviteSub}>{t.inviteSub}</Text>
              </View>
            </View>
            <Button label={t.invite} icon="key" variant="lime" loading={invite.isPending} onPress={makeCode} />
          </FadeUp>
        </>
      )}

      {!data.code ? (
        <FadeUp delay={140} style={[styles.joinCard, shadow.card]}>
          <View style={styles.joinHead}>
            <View style={styles.joinDisc}>
              <Icon name="key" size={18} color={colors.cyanDeep} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.joinTitle}>{t.haveCode}</Text>
              <Text style={text.meta}>{t.haveCodeSub}</Text>
            </View>
          </View>
          <CodeInput value={code} onChange={setCode} />
          <Button label={t.join} icon="arrow" variant="ink" disabled={code.length < HOUSEHOLD_CODE_LEN} loading={join.isPending} onPress={doJoin} />
        </FadeUp>
      ) : null}
    </>
  );
}

function Steps() {
  const t = nb.household;
  return (
    <View style={styles.steps}>
      <Text style={styles.h}>{t.stepsTitle}</Text>
      {t.steps.map((s, i) => (
        <View key={s.title} style={styles.step}>
          <View style={styles.stepRail}>
            <View style={[styles.stepNum, i === 0 ? styles.stepNumFirst : null]}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            {i < t.steps.length - 1 ? <View style={styles.stepLine} /> : null}
          </View>
          <View style={[styles.flex, styles.stepBody]}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={text.meta}>{s.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** The open invitation: the code on ink, how long it lasts, share and copy, and a calm «venter» pulse. */
function CodeCard({ code, expiresAt, busy, onNew, onTakeBack }: { code: string; expiresAt: string; busy: boolean; onNew: () => void; onTakeBack: () => void }) {
  const t = nb.household;
  const share = () => void Share.share({ message: t.shareText(code) }).catch(() => undefined);
  const copy = async () => {
    await Clipboard.setStringAsync(code);
    haptics.select();
    toast.success(t.copied, { icon: 'copy' });
  };
  return (
    <View style={[styles.codeCard, shadow.medium]}>
      <View style={styles.codeTop}>
        <Text style={styles.codeEyebrow}>{t.codeTitle}</Text>
        <View style={styles.daysLeft}>
          <Icon name="hourglass" size={12} color={colors.ink} />
          <Text style={styles.daysLeftText}>{t.codeDaysLeft(codeDaysLeft(expiresAt))}</Text>
        </View>
      </View>
      <CodeTiles code={code} />
      <Text style={styles.codeExpires}>{t.codeExpires(dayMonth(expiresAt))}</Text>
      <View style={styles.codeBtns}>
        <Button label={t.shareCode} icon="share" variant="lime" size="md" onPress={share} style={styles.flex} />
        <Button label={t.copyCode} icon="copy" variant="soft" size="md" block={false} onPress={copy} />
      </View>
      <View style={styles.waiting}>
        <WaitingDot />
        <Text style={styles.waitingText}>{t.waiting}</Text>
      </View>
      <View style={styles.codeLinks}>
        <Pressable accessibilityRole="button" onPress={onNew} disabled={busy} style={styles.codeLink} hitSlop={6}>
          <Icon name="refresh" size={14} color={colors.onInk72} />
          <Text style={styles.codeLinkText}>{t.newCode}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onTakeBack} disabled={busy} style={styles.codeLink} hitSlop={6}>
          <Icon name="x" size={14} color={colors.onInk72} />
          <Text style={styles.codeLinkText}>{t.takeBack}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WaitingDot() {
  const still = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (still) return;
    s.set(withRepeat(withTiming(2.2, { duration: 1400, easing: Easing.out(Easing.ease) }), -1));
    return () => cancelAnimation(s);
  }, [s, still]);
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }], opacity: 1.6 - s.get() * 0.7 }));
  return (
    <View style={styles.dotWrap}>
      {still ? null : <Animated.View style={[styles.dotHalo, halo]} />}
      <View style={styles.dotCore} />
    </View>
  );
}

// ------------------------------------------------------------
// Together
// ------------------------------------------------------------
function Together({ data }: { data: Household & { partner: { id: string; name: string } } }) {
  const t = nb.household;
  const { leave } = useHouseholdActions();
  const [leaving, setLeaving] = useState(false);
  const [who, setWho] = useState<WhoFilter>('all');
  const first = data.partner.name.split(' ')[0];
  const shown = filterWho(data.agreements, who);

  const doLeave = () =>
    leave.mutate(undefined, {
      onSuccess: () => {
        haptics.warning();
        setLeaving(false);
        toast.info(t.left, { icon: 'home' });
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
    });

  return (
    <>
      <FadeUp>
        <HouseholdHero
          partnerId={data.partner.id}
          eyebrow={data.since ? t.sinceEyebrow(dayMonth(data.since)) : t.partner}
          title={t.together(first)}
          lead={t.togetherLead}
        >
          <View style={styles.stats}>
            <HeroStat icon="cal" value={t.statComing(data.agreements.length)} />
            <HeroStat icon="clip" value={t.statListings(data.listings.length)} />
          </View>
        </HouseholdHero>
      </FadeUp>

      {/* «Hvem kommer når» */}
      <View style={styles.section}>
        <View>
          <Text style={styles.h} accessibilityRole="header">
            {t.whenTitle}
          </Text>
          <Text style={text.meta}>{t.whenSub}</Text>
        </View>
        {data.agreements.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <Chip label={t.filterAll} selected={who === 'all'} onPress={() => setWho('all')} size="sm" />
            <Chip label={t.filterMine} selected={who === 'me'} onPress={() => setWho('me')} size="sm" />
            <Chip label={t.filterTheirs(first)} selected={who === 'partner'} onPress={() => setWho('partner')} size="sm" />
          </ScrollView>
        ) : null}
        {shown.length ? (
          <WhenTimeline list={shown} partnerId={data.partner.id} partnerFirst={first} />
        ) : (
          <View style={[styles.empty, shadow.card]}>
            <View style={styles.emptyDisc}>
              <Icon name="cal" size={22} color={colors.cyanDeep} />
            </View>
            <Text style={styles.emptyTitle}>{data.agreements.length ? t.noAgreementsFiltered : t.noAgreementsTitle}</Text>
            {data.agreements.length ? null : <Text style={[text.meta, styles.center]}>{t.noAgreements}</Text>}
          </View>
        )}
      </View>

      {/* the partner's oppdrag */}
      <View style={styles.section}>
        <Text style={styles.h} accessibilityRole="header">
          {t.theirListings(first)}
        </Text>
        {data.listings.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listingRow}>
            {data.listings.map((l, i) => (
              <FadeUp key={l.id} delay={Math.min(i, 5) * 40}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${l.title}, ${t.listingStatus[l.status] ?? ''}`}
                  onPress={() => safePush(`/oppdrag/${l.id}`)}
                  style={({ pressed }) => [styles.listing, shadow.card, pressed && styles.pressed]}
                >
                  <CategoryArt category={(l.categorySlug ?? 'annet') as CategoryId} uri={l.imageUrl} width="100%" height={96} iconSize={30} />
                  <View style={styles.listingStatus}>
                    <Pill label={t.listingStatus[l.status] ?? l.status} tone={l.status === 'RECEIVING_OFFERS' ? 'need' : 'neutral'} size="sm" dot />
                  </View>
                  <View style={styles.listingBody}>
                    <Text style={styles.listingTitle} numberOfLines={2}>
                      {l.title}
                    </Text>
                    <Text style={text.meta}>{dayMonth(l.createdAt)}</Text>
                  </View>
                </Pressable>
              </FadeUp>
            ))}
          </ScrollView>
        ) : (
          <Text style={text.meta}>{t.noListings}</Text>
        )}
      </View>

      <Note icon="eye">{t.readOnly}</Note>

      <View style={[styles.settings, shadow.card]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setLeaving(true)}
          style={({ pressed }) => [styles.leaveRow, pressed && styles.pressed]}
        >
          <View style={styles.leaveDisc}>
            <Icon name="logout" size={18} color={colors.danger} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.leaveTitle}>{t.leave}</Text>
            <Text style={text.meta}>{t.leaveSub}</Text>
          </View>
          <Icon name="right" size={16} color={colors.faint} />
        </Pressable>
      </View>

      <Dialog
        visible={leaving}
        onClose={() => !leave.isPending && setLeaving(false)}
        icon="home"
        tone="danger"
        title={t.leaveTitle}
        body={t.leaveBody(first)}
        actions={
          <View style={styles.dlg}>
            <Button label={t.leaveConfirm} variant="danger" loading={leave.isPending} onPress={doLeave} />
            <Button label={t.keep} variant="ghost" onPress={() => setLeaving(false)} />
          </View>
        }
      />
    </>
  );
}

function YouthLocked() {
  const t = nb.household;
  return (
    <FadeUp style={[styles.youth, shadow.card]}>
      <View style={styles.youthRing} />
      <View style={styles.youthDisc}>
        <Icon name="lock" size={24} color={colors.ink} />
      </View>
      <Text style={[text.h2, styles.center]}>{t.youthTitle}</Text>
      <Text style={[text.body, styles.center, styles.ink2]}>{t.youthBody}</Text>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  body: { paddingHorizontal: screenPadding, paddingTop: 8, paddingBottom: 60, gap: 16 },
  center: { textAlign: 'center' },
  ink2: { color: colors.ink2 },
  pressed: { opacity: 0.85 },
  h: { fontFamily: fonts.display, fontSize: 19, letterSpacing: -0.2, color: colors.ink },
  section: { gap: 10 },

  points: { gap: 8, marginTop: 8 },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tick: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  pointText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20, color: colors.ink },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },

  steps: { gap: 2, padding: 16, borderRadius: radius.card, backgroundColor: colors.surface2 },
  step: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 30 },
  stepNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  stepNumFirst: { backgroundColor: colors.lime, borderColor: colors.lime },
  stepNumText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  stepLine: { flex: 1, width: 0, borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: colors.faint, marginTop: 4 },
  stepBody: { paddingTop: 10, paddingBottom: 8, gap: 2 },
  stepTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },

  inviteCard: { gap: 14, padding: 18, borderRadius: radius.card, backgroundColor: colors.ink },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inviteDisc: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  inviteTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.white },
  inviteSub: { ...text.meta, color: colors.onInk72 },

  joinCard: { gap: 14, padding: 18, borderRadius: radius.card, backgroundColor: colors.white },
  joinHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  joinDisc: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  joinTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },

  codeCard: { gap: 14, padding: 18, borderRadius: radius.listingCard, backgroundColor: colors.ink },
  codeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  codeEyebrow: { ...text.eyebrow, fontSize: 11, color: colors.lime },
  daysLeft: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.lime },
  daysLeftText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  codeExpires: { ...text.meta, color: colors.onInk72, textAlign: 'center' },
  codeBtns: { flexDirection: 'row', gap: 10 },
  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 2 },
  waitingText: { ...text.meta, color: colors.white },
  dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: colors.lime },
  dotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  codeLinks: { flexDirection: 'row', justifyContent: 'center', gap: 18, borderTopWidth: 1, borderTopColor: colors.onInk10, paddingTop: 12 },
  codeLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  codeLinkText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.onInk72 },
  instead: { alignSelf: 'center', marginTop: 12 },

  filters: { gap: 8, paddingRight: 8 },
  empty: { alignItems: 'center', gap: 8, padding: 20, borderRadius: radius.card, backgroundColor: colors.white },
  emptyDisc: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },

  listingRow: { gap: 12, paddingRight: 8, paddingBottom: 6 },
  listing: { width: 168, borderRadius: 20, backgroundColor: colors.white, overflow: 'hidden' },
  listingStatus: { position: 'absolute', top: 8, left: 8 },
  listingBody: { padding: 12, gap: 4 },
  listingTitle: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18.5, color: colors.ink, minHeight: 37 },

  settings: { borderRadius: radius.card, backgroundColor: colors.white, overflow: 'hidden' },
  leaveRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 64 },
  leaveDisc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.dangerTint, alignItems: 'center', justifyContent: 'center' },
  leaveTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.danger },
  dlg: { gap: 10, alignSelf: 'stretch' },

  youth: { alignItems: 'center', gap: 10, padding: 24, paddingTop: 34, borderRadius: radius.card, backgroundColor: colors.white, overflow: 'hidden' },
  youthRing: { position: 'absolute', top: 14, width: 96, height: 96, borderRadius: 48, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.cyan },
  youthDisc: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white, marginBottom: 12 },
});
