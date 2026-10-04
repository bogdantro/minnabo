import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { AgendaItem } from '@/domain/types';
import nb from '@/i18n/nb';
import { useDeleteMyAccount, useListing, useMyAgreements, useMyListings, useProfile, useReviews } from '@/api/queries';
import { signOut } from '@/auth/session';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { categoryArtId } from '@/domain/categories';
import { formatPrice } from '@/domain/price';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import {
  Avatar,
  Button,
  CategoryArt,
  DrawnCheck,
  ErrorText,
  FadeUp,
  Icon,
  IconButton,
  Input,
  Note,
  PAYMENT_NOTE,
  Pill,
  Radio,
  ScaleIn,
  Screen,
  Shake,
  SlideIn,
  StickyFooter,
  SubHeader,
  type IconName,
} from '@/components/ui';

const WORD = 'SLETT';
const ACTIVE = (a: AgendaItem) => !a.fullyCompleted && !a.cancelled;

/** Slett konto (design/screens/SlettKonto.dc.html). */
export function DeleteAccountScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: profile } = useProfile(me.id);
  const { data: reviews } = useReviews(me.id);
  const { data: listings } = useMyListings('TASK_REQUEST');
  const { data: agreements } = useMyAgreements();
  const del = useDeleteMyAccount();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [dir, setDir] = useState<'forward' | 'back'>('forward');
  const [reason, setReason] = useState<number | null>(null);
  const [other, setOther] = useState('');
  const [typed, setTyped] = useState('');
  const [shake, setShake] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [firstName] = useState(() => me.displayName.split(' ')[0] ?? '');

  const active = (agreements ?? []).filter(ACTIVE);
  const match = typed === WORD;
  const titles = (listings ?? []).filter((l) => l.status !== 'REMOVED').map((l) => l.title);

  const exit = () => (router.canGoBack() ? router.back() : router.replace('/innstillinger'));
  const go = (s: 1 | 2 | 3 | 4) => {
    setDir(s > step ? 'forward' : 'back');
    setStep(s);
  };
  // Step 2 only exists when there are active agreements.
  const next = () => go(step === 1 ? (active.length ? 2 : 3) : 3);
  const prev = () => {
    setTyped('');
    setWrong(false);
    go(step === 3 && active.length ? 2 : 1);
  };

  const onType = (v: string) => {
    setTyped(v);
    setWrong(false);
    if (v.length >= WORD.length && v !== WORD) {
      setWrong(true);
      setShake((n) => n + 1);
    }
  };

  const doDelete = () => {
    if (del.isPending) return;
    if (!match) {
      setWrong(true);
      setShake((n) => n + 1);
      haptics.warning();
      return;
    }
    const why = reason === null ? undefined : reason === nb.slettKonto.reasons.length - 1 && other.trim() ? `Annet: ${other.trim()}` : nb.slettKonto.reasons[reason];
    del.mutate(why, {
      onSuccess: async () => {
        haptics.success();
        setStep(4);
        await signOut();
      },
      onError: () => toast.error(nb.slettKonto.failed, { bottom: 170 }),
    });
  };

  if (step === 4) {
    return (
      <Screen white>
        <View style={styles.bye}>
          <View style={styles.byeCenter}>
            <DrawnCheck size={112} bg={colors.white} tickColor={colors.limeDeep} />
            <FadeUp delay={240}>
              <Text style={[text.h1, styles.centerText, styles.mt12]} accessibilityRole="header">
                {nb.slettKonto.doneTitle}
              </Text>
            </FadeUp>
            <FadeUp delay={300}>
              <Text style={[text.body, styles.byeBody]}>{nb.slettKonto.doneBody(firstName)}</Text>
            </FadeUp>
          </View>
          <FadeUp delay={360}>
            <Button label={nb.slettKonto.home} variant="ink" size="lg" onPress={() => router.replace('/velkommen')} />
          </FadeUp>
        </View>
      </Screen>
    );
  }

  const rows: { icon: IconName; title: string; sub: string }[] = [
    { icon: 'user', ...nb.slettKonto.rows.profile },
    { icon: 'clip', title: nb.slettKonto.rows.listings.title, sub: titles.length ? titles.join(', ') : nb.slettKonto.rows.listings.none },
    { icon: 'msg', ...nb.slettKonto.rows.messages },
    { icon: 'star', title: nb.slettKonto.rows.reviews.title, sub: nb.slettKonto.rows.reviews.sub(reviews?.length ?? 0, profile?.completedTasks ?? 0) },
    { icon: 'heart', ...nb.slettKonto.rows.saved },
  ];

  return (
    <Screen
      scroll
      spacer="none"
      header={
        <SubHeader
          title={nb.slettKonto.title}
          onBack={step === 1 ? exit : prev}
          right={<IconButton icon="x" variant="ghost" accessibilityLabel={nb.slettKonto.cancel} onPress={exit} />}
        />
      }
      footer={
        <StickyFooter>
          {step === 1 ? (
            <>
              <Button label={nb.slettKonto.next} variant="ink" size="lg" iconRight="arrow" onPress={next} />
              <Button label={nb.slettKonto.cancel} variant="text" onPress={exit} />
            </>
          ) : step === 2 ? (
            <>
              <Button label={nb.slettKonto.continueAnyway} variant="dangerGhost" size="lg" onPress={next} />
              <Button label={nb.slettKonto.keep} variant="text" onPress={exit} />
            </>
          ) : (
            <>
              <Button
                label={del.isPending ? nb.slettKonto.deleting : nb.slettKonto.delete}
                variant="danger"
                size="lg"
                icon="trash"
                loading={del.isPending}
                onPress={doDelete}
                style={!match && !del.isPending ? styles.off : undefined}
                accessibilityLabel={nb.slettKonto.delete}
              />
              <Button label={nb.slettKonto.keep} variant="text" onPress={exit} />
            </>
          )}
        </StickyFooter>
      }
    >
      <View style={[styles.px, styles.mt6]}>
        <View style={styles.steps} accessible accessibilityLabel={nb.slettKonto.step(step)}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.stepBar, i <= step && styles.stepOn]} />
          ))}
        </View>
        <Text style={[text.meta, styles.mt8]}>{nb.slettKonto.step(step)}</Text>
      </View>

      {step === 1 ? (
        <SlideIn key="s1" direction={dir} style={[styles.px, styles.mt18]}>
          <ScaleIn>
            <View style={[styles.bigIcon, { backgroundColor: colors.dangerTint }]}>
              <Icon name="trash" size={28} color={colors.danger} />
            </View>
          </ScaleIn>
          <Text style={[text.h1, styles.mt16]} accessibilityRole="header">
            {nb.slettKonto.s1Title}
          </Text>
          <Text style={[text.body, styles.ink2, styles.mt8]}>{nb.slettKonto.s1Body}</Text>
          <View style={[styles.card, styles.mt18, shadow.card]}>
            {rows.map((r, i) => (
              <View key={r.title} style={styles.drow}>
                {i > 0 ? <View style={styles.drowDivider} /> : null}
                <View style={styles.drowIcon}>
                  <Icon name={r.icon} size={16} color={colors.danger} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.drowTitle}>{r.title}</Text>
                  <Text style={styles.drowSub}>{r.sub}</Text>
                </View>
              </View>
            ))}
          </View>
          <Note icon="info" style={styles.mt10}>
            {nb.slettKonto.legal}
          </Note>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={nb.slettKonto.exportTitle}
            onPress={() => safePush('/personvern')}
            style={[styles.card, styles.exportCard, styles.mt16]}
          >
            <View style={styles.exportIcon}>
              <Icon name="download" size={18} color={colors.cyanDeep} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.exportTitle}>{nb.slettKonto.exportTitle}</Text>
              <Text style={text.meta}>{nb.slettKonto.exportSub}</Text>
            </View>
            <Icon name="right" size={20} color={colors.faint} />
          </Pressable>

          <View style={[styles.labelRow, styles.mt26]}>
            <Text style={text.label}>{nb.slettKonto.whyLabel}</Text>
            <Text style={text.hint}>{nb.slettKonto.optional}</Text>
          </View>
          <View style={styles.gap8} accessibilityRole="radiogroup" accessibilityLabel={nb.slettKonto.whyLabel}>
            {nb.slettKonto.reasons.map((label, i) => {
              const on = reason === i;
              return (
                <Pressable
                  key={label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setReason(on ? null : i)}
                  style={[styles.opt, on && styles.optOn]}
                >
                  <Radio selected={on} />
                  <Text style={styles.optText}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {reason === nb.slettKonto.reasons.length - 1 ? (
            <FadeUp style={styles.mt10}>
              <Input value={other} onChangeText={setOther} multiline placeholder={nb.slettKonto.otherPh} accessibilityLabel={nb.slettKonto.otherAria} style={styles.otherInput} />
            </FadeUp>
          ) : null}
        </SlideIn>
      ) : null}

      {step === 2 ? (
        <SlideIn key="s2" direction={dir} style={[styles.px, styles.mt18]}>
          <ScaleIn>
            <View style={[styles.bigIcon, { backgroundColor: colors.warnTint }]}>
              <Icon name="alert" size={28} color={colors.warn} />
            </View>
          </ScaleIn>
          <Text style={[text.h1, styles.mt16]} accessibilityRole="header">
            {nb.slettKonto.s2Title(active.length)}
          </Text>
          {active.map((a, i) => (
            <AgreementCard key={a.proposalId} item={a} first={i === 0} single={active.length === 1} />
          ))}
          <Note icon="info" style={styles.mt10}>
            {PAYMENT_NOTE}
          </Note>
        </SlideIn>
      ) : null}

      {step === 3 ? (
        <SlideIn key="s3" direction={dir} style={[styles.px, styles.mt18]}>
          <ScaleIn>
            <View style={[styles.bigIcon, { backgroundColor: colors.dangerTint }]}>
              <Icon name="lock" size={28} color={colors.danger} />
            </View>
          </ScaleIn>
          <Text style={[text.h1, styles.mt16]} accessibilityRole="header">
            {nb.slettKonto.s3Title}
          </Text>
          <Text style={[text.body, styles.ink2, styles.mt8]}>
            {nb.slettKonto.s3Pre}
            <Text style={styles.word}>{nb.slettKonto.s3Word}</Text>
            {nb.slettKonto.s3Post}
          </Text>
          <View style={styles.letters} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {WORD.split('').map((c, i) => {
              const on = typed[i] === c;
              return (
                <View key={i} style={[styles.letter, on && styles.letterOn]}>
                  <Text style={[styles.letterText, on && styles.white]}>{c}</Text>
                </View>
              );
            })}
          </View>
          <Shake shakeKey={shake} style={styles.mt16}>
            <Input
              value={typed}
              onChangeText={onType}
              placeholder={WORD}
              maxLength={10}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              error={wrong && !match}
              accessibilityLabel={nb.slettKonto.confirmAria}
              style={[styles.confirm, match && styles.confirmOk]}
            />
          </Shake>
          {wrong && !match ? <ErrorText shakeKey={shake}>{nb.slettKonto.wrong}</ErrorText> : null}
          {match ? (
            <FadeUp style={styles.readyRow}>
              <Icon name="check" size={16} color={colors.danger} />
              <Text style={styles.readyText}>{nb.slettKonto.ready}</Text>
            </FadeUp>
          ) : null}
        </SlideIn>
      ) : null}
      <View style={styles.bottom} />
    </Screen>
  );
}

function AgreementCard({ item: a, first, single }: { item: AgendaItem; first: boolean; single: boolean }) {
  const { data: other } = useProfile(a.counterpartId);
  const { data: listing } = useListing(a.listingId);
  const name = other?.displayName?.split(' ')[0] ?? '';
  return (
    <>
      {first ? (
        <Text style={[text.body, styles.ink2, styles.mt8]}>{single ? nb.slettKonto.s2Body(name) : nb.slettKonto.s2BodyMany}</Text>
      ) : null}
      <FadeUp delay={80} style={[styles.card, styles.agCard, styles.mt18, shadow.card]}>
        <CategoryArt category={categoryArtId(listing?.category.slug ?? 'annet')} uri={listing?.images[0]?.url} width={76} height={86} radius={16} iconSize={28} />
        <View style={[styles.flex, styles.gap6]}>
          <Pill label={nb.slettKonto.agreed} tone="ok" icon="checks" size="sm" style={styles.selfStart} />
          <Text style={styles.agTitle}>{a.listingTitle}</Text>
          {a.scheduledText ? (
            <View style={styles.lmeta}>
              <Icon name="cal" size={14} color={colors.faint} />
              <Text style={text.meta}>{a.scheduledText}</Text>
            </View>
          ) : null}
          <View style={styles.lmeta}>
            <Avatar initials={other?.initials ?? '·'} uri={other?.avatarUrl} seed={a.counterpartId} size={20} ring={false} />
            <Text style={text.meta}>{[other?.displayName, formatPrice(a.price)].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
      </FadeUp>
      {single ? (
        <>
          <Button label={nb.slettKonto.seeAgreement} variant="ghost" icon="cal" onPress={() => safePush(`/avtale/${a.proposalId}`)} style={styles.mt14} />
          {name ? <Button label={nb.slettKonto.writeTo(name)} variant="text" onPress={() => safePush(`/avtale/${a.proposalId}`)} /> : null}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  mt26: { marginTop: 26 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  ink2: { color: colors.ink2 },
  white: { color: colors.white },
  selfStart: { alignSelf: 'flex-start' },
  centerText: { textAlign: 'center' },
  bottom: { height: 170 },
  off: { opacity: 0.38 },
  steps: { flexDirection: 'row', gap: 5 },
  stepBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.progressTrack },
  stepOn: { backgroundColor: colors.ink },
  bigIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' },
  drow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 13, paddingHorizontal: 16 },
  drowDivider: { position: 'absolute', top: 0, left: 62, right: 0, height: 1, backgroundColor: colors.line2 },
  drowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dangerTint, alignItems: 'center', justifyContent: 'center' },
  drowTitle: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 19.5, color: colors.ink },
  drowSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17.5, color: colors.mute, marginTop: 2 },
  exportCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: colors.limeTint },
  exportIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  exportTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.ink, marginBottom: 3 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 14, borderRadius: radius.option, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  optOn: { borderColor: colors.ink, ...shadow.selected },
  optText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  otherInput: { minHeight: 90 },
  agCard: { flexDirection: 'row', gap: 14, padding: 14 },
  agTitle: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 20, color: colors.ink },
  lmeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  word: { fontFamily: fonts.bodyBold, color: colors.danger },
  letters: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 20 },
  letter: { width: 34, height: 40, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  letterOn: { backgroundColor: colors.danger, borderColor: colors.danger },
  letterText: { fontFamily: fonts.display, fontSize: 17, color: colors.faint },
  confirm: { height: 72, textAlign: 'center', fontFamily: fonts.displayHeavy, fontSize: 30, letterSpacing: 6 },
  confirmOk: { borderColor: colors.danger },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  readyText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.danger },
  bye: { flex: 1, paddingHorizontal: 28, paddingBottom: 40 },
  byeCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  byeBody: { color: colors.ink2, maxWidth: 300, textAlign: 'center' },
});
