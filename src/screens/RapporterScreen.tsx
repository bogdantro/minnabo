import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ReportTargetType } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import nb from '@/i18n/nb';
import { useBlockedProfileIds, useListing, useProfile, useSubmitReport, useToggleBlock } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatTime } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { pickAndUpload } from '@/lib/uploads';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { listingPrice } from '@/components/OppdragCard';
import {
  Avatar,
  Button,
  CategoryArt,
  DrawnCheck,
  ErrorText,
  FadeUp,
  Field,
  Icon,
  IconButton,
  ScaleIn,
  Input,
  Note,
  Pill,
  Radio,
  Screen,
  SlideIn,
  StickyFooter,
  SubHeader,
  Toggle,
  type IconName,
} from '@/components/ui';

type Step = 1 | 2 | 3 | 4;
const TYPE_ICON: Record<ReportTargetType, IconName> = { USER: 'user', LISTING: 'clip', PROPOSAL: 'tag', MESSAGE: 'msg', REVIEW: 'star', COMMENT: 'reply' };
const ALL_TYPES: ReportTargetType[] = ['USER', 'LISTING', 'PROPOSAL', 'MESSAGE', 'REVIEW'];
const MAX = 500;

/**
 * Rapporter (design/screens/Rapporter.dc.html). Opened with the thing to report:
 * `?profil=` (a user), `?listing=` (an oppdrag), `?melding=` (+ `profil` = sender),
 * `?kommentar=` (a comment under an oppslag, + `profil` = who wrote it).
 * Without any of them it is a general report and the details are required.
 */
export function RapporterScreen({
  profileId,
  listingId,
  messageId,
  commentId,
}: {
  profileId?: string;
  listingId?: string;
  messageId?: string;
  commentId?: string;
}) {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: listing } = useListing(listingId ?? '');
  const personId = profileId ?? listing?.owner.id ?? '';
  const { data: person } = useProfile(personId);
  const { data: blockedIds = [] } = useBlockedProfileIds();
  const report = useSubmitReport();
  const toggleBlock = useToggleBlock();

  const general = !profileId && !listingId && !messageId && !commentId;
  const types: ReportTargetType[] = general
    ? ALL_TYPES
    : [
        ...(commentId ? (['COMMENT'] as const) : []),
        ...(listingId ? (['LISTING'] as const) : []),
        ...(messageId ? (['MESSAGE'] as const) : []),
        ...(personId ? (['USER'] as const) : []),
      ];

  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState<'forward' | 'back'>('forward');
  const [type, setType] = useState<ReportTargetType>(types[0] ?? 'USER');
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [shot, setShot] = useState<{ path: string; uri?: string; bytes?: number } | null>(null);
  const [shotBusy, setShotBusy] = useState(false);
  const addShot = async () => {
    if (shotBusy || !me.id) return;
    setShotBusy(true);
    try {
      const res = await pickAndUpload({ bucket: 'report-attachments', folder: me.id, source: 'library' });
      if (res) setShot({ path: res.path, uri: res.localUri, bytes: res.bytes });
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : nb.toast.genericError);
    } finally {
      setShotBusy(false);
    }
  };
  const [block, setBlock] = useState(false);
  const [tried, setTried] = useState(false);
  const [caseNo, setCaseNo] = useState('');
  const [sentAt, setSentAt] = useState('');
  const [blockedNow, setBlockedNow] = useState(false);

  const reasonItem = nb.rapporter.reasons.find((r) => r.id === reason);
  const detailsRequired = general || reason === 'annet';
  const detOk = !detailsRequired || details.trim().length >= 10;
  const canBlock = !!personId && personId !== me.id && !blockedIds.includes(personId);
  const targetId =
    type === 'COMMENT' ? commentId ?? '' : type === 'LISTING' ? listingId ?? '' : type === 'MESSAGE' ? messageId ?? '' : type === 'USER' ? personId : '';
  const personName = person?.displayName ?? '';

  const back = () => (router.canGoBack() ? router.back() : router.replace('/sikkerhet'));
  const go = (s: Step) => {
    setDir(s > step ? 'forward' : 'back');
    setStep(s);
  };

  const send = () => {
    if (!detOk) {
      setTried(true);
      haptics.warning();
      return;
    }
    if (!reasonItem) return;
    report.mutate(
      { targetType: type, targetId, reason: reasonItem.label, details: details.trim() || undefined, attachmentPath: shot?.path },
      {
        onSuccess: (r) => {
          setCaseNo(`MN-${r.id.replace(/[^0-9a-z]/gi, '').slice(-6).toUpperCase()}`);
          setSentAt(formatTime(r.createdAt));
          if (block && canBlock) {
            toggleBlock.mutate(personId);
            setBlockedNow(true);
          }
          haptics.success();
          go(4);
        },
        onError: () => toast.error(nb.toast.genericError),
      },
    );
  };

  const inFlow = step <= 3;
  const nextDisabled = step === 2 && !reason;

  return (
    <Screen
      scroll
      spacer="foot"
      header={
        <SubHeader
          title={nb.rapporter.title}
          onBack={step === 2 || step === 3 ? () => go((step - 1) as Step) : back}
          right={inFlow ? <IconButton icon="x" variant="ghost" accessibilityLabel={nb.rapporter.cancel} onPress={back} /> : null}
        />
      }
      footer={
        <StickyFooter>
          {inFlow ? (
            <Button
              label={step === 3 ? (report.isPending ? nb.rapporter.sending : nb.rapporter.send) : nb.rapporter.next}
              variant={step === 3 ? 'danger' : 'ink'}
              size="lg"
              disabled={nextDisabled}
              loading={report.isPending}
              onPress={() => (step === 3 ? send() : go((step + 1) as Step))}
            />
          ) : (
            <Button label={nb.rapporter.done} variant="ink" size="lg" onPress={() => router.replace('/sikkerhet')} />
          )}
        </StickyFooter>
      }
    >
      {inFlow ? (
        <View style={[styles.px, styles.pt6]}>
          <View style={styles.steps} accessible accessibilityLabel={nb.rapporter.step(step)}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={[styles.stepBar, i <= step && styles.stepOn]} />
            ))}
          </View>
          <Text style={[text.eyebrow, styles.mt12]}>{nb.rapporter.step(step)}</Text>
        </View>
      ) : null}

      {step === 1 ? (
        <SlideIn key="s1" direction={dir}>
          <View style={[styles.px, styles.mt10]}>
            <Text style={text.h1} accessibilityRole="header">
              {nb.rapporter.s1Title}
            </Text>
            <Text style={[text.meta, styles.mt8]}>{nb.rapporter.s1Sub}</Text>
          </View>
          {types.length > 1 ? (
            <View style={[styles.px, styles.chips]} accessibilityRole="radiogroup" accessibilityLabel={nb.rapporter.typeLabel}>
              {types.map((t) => {
                const on = type === t;
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setType(t)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <View style={[styles.ci, on && styles.ciOn]}>
                      <Icon name={TYPE_ICON[t]} size={16} color={on ? colors.white : colors.ink} />
                    </View>
                    <Text style={[styles.chipText, on && styles.white]}>{nb.rapporter.types[t]}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View style={[styles.px, styles.mt18]}>
            {general ? (
              <Note icon="info">{nb.rapporter.general}</Note>
            ) : (
              <>
                <Text style={[text.label, styles.mb10]}>{nb.rapporter.youReport}</Text>
                {type === 'LISTING' && listing ? (
                  <FadeUp key="ctx-l" style={[styles.ctx, shadow.card]}>
                    <CategoryArt category={categoryArtId(listing.category.slug)} uri={listing.images[0]?.url} width={64} height={64} radius={16} iconSize={26} />
                    <View style={[styles.flex, styles.gap5]}>
                      <Pill label={nb.rapporter.oppdrag} tone="need" dot size="sm" style={styles.selfStart} />
                      <Text style={styles.ctxTitle}>{`«${listing.title}»`}</Text>
                      <Text style={[text.meta, styles.f125]}>
                        {[listing.owner.displayName, listing.location.place, [listingPrice(listing).label, listingPrice(listing).value].filter(Boolean).join(' ')]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  </FadeUp>
                ) : person ? (
                  <FadeUp key="ctx-u" style={[styles.ctx, shadow.card]}>
                    <Avatar initials={person.initials} uri={person.avatarUrl} seed={person.id} size={56} ring={false} />
                    <View style={styles.flex}>
                      <Text style={styles.ctxName}>{person.displayName}</Text>
                      <Text style={text.meta}>{nb.rapporter.memberSince(person.memberSince, person.location.place)}</Text>
                      <View style={styles.mt6}>
                        {person.verifications.some((v) => v.verified) ? (
                          <Pill label={nb.rapporter.verified} tone="ok" icon="check" size="sm" style={styles.selfStart} />
                        ) : (
                          <Pill label={nb.rapporter.notVerified} tone="warn" icon="alert" size="sm" style={styles.selfStart} />
                        )}
                      </View>
                    </View>
                  </FadeUp>
                ) : null}
              </>
            )}
          </View>
        </SlideIn>
      ) : null}

      {step === 2 ? (
        <SlideIn key="s2" direction={dir} style={[styles.px, styles.mt10]}>
          <Text style={text.h1} accessibilityRole="header">
            {nb.rapporter.s2Title}
          </Text>
          <Text style={[text.meta, styles.mt8]}>{nb.rapporter.s2Sub}</Text>
          <View style={styles.reasons} accessibilityRole="radiogroup" accessibilityLabel={nb.rapporter.reasonLabel}>
            {nb.rapporter.reasons.map((r) => {
              const on = reason === r.id;
              return (
                <Pressable
                  key={r.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={r.label}
                  onPress={() => {
                    setReason(r.id);
                    if (r.id === 'svindel' || r.id === 'trakassering') setBlock(true);
                  }}
                  style={[styles.opt, on && styles.optOn, on && shadow.selected]}
                >
                  <View style={styles.mt1}>
                    <Radio selected={on} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.optTitle}>{r.label}</Text>
                    <Text style={styles.optSub}>{r.sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </SlideIn>
      ) : null}

      {step === 3 ? (
        <SlideIn key="s3" direction={dir} style={[styles.px, styles.mt10]}>
          <Text style={text.h1} accessibilityRole="header">
            {nb.rapporter.s3Title}
          </Text>
          <View style={styles.pills}>
            <Pill label={nb.rapporter.types[type]} tone="line" icon={TYPE_ICON[type]} />
            {reasonItem ? <Pill label={reasonItem.label} tone="danger" icon="flag" /> : null}
          </View>
          <Field
            label={nb.rapporter.details}
            hint={detailsRequired ? (general ? nb.rapporter.requiredGeneral : nb.rapporter.required) : nb.rapporter.optional}
            style={styles.mt18}
          >
            <Input
              value={details}
              onChangeText={(t) => setDetails(t.slice(0, MAX))}
              placeholder={nb.rapporter.detailsPh}
              multiline
              error={tried && !detOk}
              style={styles.details}
              accessibilityLabel={nb.rapporter.details}
            />
            <View style={styles.between}>
              {tried && !detOk ? <ErrorText>{nb.rapporter.detailsErr}</ErrorText> : <View />}
              <Text style={[text.meta, styles.f12]}>{nb.rapporter.count(details.length)}</Text>
            </View>
          </Field>
          <View style={styles.shotLabel}>
            <Text style={text.label}>{nb.rapporter.shot}</Text>
            <Text style={text.hint}>{nb.rapporter.optional}</Text>
          </View>
          {shot ? (
            <ScaleIn style={styles.attach}>
              <View style={styles.shot}>
                {shot.uri ? <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
              </View>
              <View style={styles.flex}>
                <Text style={styles.shotName}>{nb.rapporter.shotName}</Text>
                <Text style={[text.meta, styles.f12]}>{nb.rapporter.shotMeta(shot.bytes ? Math.max(1, Math.round(shot.bytes / 1024)) : null)}</Text>
              </View>
              <IconButton icon="x" iconSize={18} accessibilityLabel={nb.rapporter.shotRemove} onPress={() => setShot(null)} />
            </ScaleIn>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={nb.rapporter.shotAdd}
              accessibilityState={{ busy: shotBusy }}
              onPress={() => void addShot()}
              style={styles.shotAdd}
            >
              <Icon name="image" size={22} color={colors.ink2} />
              <Text style={styles.shotAddText}>{shotBusy ? nb.rapporter.shotBusy : nb.rapporter.shotAdd}</Text>
            </Pressable>
          )}
          {canBlock ? (
            <View style={[styles.card, styles.blockCard, shadow.card]}>
              <View style={styles.blockIcon}>
                <Icon name="ban" size={18} color={colors.ink2} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.blockTitle}>{nb.rapporter.alsoBlock(personName)}</Text>
                <Text style={[text.meta, styles.f125]}>{nb.rapporter.alsoBlockSub}</Text>
              </View>
              <Toggle value={block} onValueChange={setBlock} accessibilityLabel={nb.rapporter.alsoBlockAria} />
            </View>
          ) : null}
          <Note icon="lock" style={styles.mt14}>
            {nb.rapporter.confidential}
          </Note>
        </SlideIn>
      ) : null}

      {step === 4 ? (
        <View style={[styles.px, styles.done]}>
          <DrawnCheck size={104} bg={colors.okTint} tickColor={colors.ok} ring={shadow.okRing} />
          <FadeUp delay={200}>
            <Text style={[text.h1, styles.centerText, styles.mt22]} accessibilityRole="header">
              {nb.rapporter.doneTitle}
            </Text>
          </FadeUp>
          <FadeUp delay={260}>
            <Text style={[text.body, styles.doneBody]}>{nb.rapporter.doneBody}</Text>
          </FadeUp>
          <FadeUp delay={260} style={styles.mt12}>
            <Pill label={nb.rapporter.caseNo(caseNo)} tone="line" icon="file" />
          </FadeUp>
          <FadeUp delay={320} style={[styles.card, styles.pad, styles.timeline, shadow.card]}>
            <TimelineRow done icon="check" title={nb.rapporter.received} sub={nb.rapporter.receivedAt(sentAt)} />
            <TimelineRow active icon="hourglass" title={nb.rapporter.reviewing} sub={nb.rapporter.reviewingSub} />
            <TimelineRow last icon="flag" title={nb.rapporter.decided} sub={nb.rapporter.decidedSub} />
          </FadeUp>
          {blockedNow ? (
            <FadeUp delay={380} style={styles.blockedNote}>
              <View style={styles.blockedIcon}>
                <Icon name="ban" size={16} color={colors.ink} />
              </View>
              <Text style={styles.blockedText}>{nb.rapporter.blockedNote(personName)}</Text>
            </FadeUp>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function TimelineRow({ icon, title, sub, done, active, last }: { icon: IconName; title: string; sub: string; done?: boolean; active?: boolean; last?: boolean }) {
  const bg = done ? colors.ok : active ? colors.cyan : colors.line2;
  const fg = done || active ? colors.white : colors.faint;
  return (
    <View style={[styles.tl, last && styles.tlLast]}>
      {!last ? <View style={[styles.tlLine, done && styles.tlLineDone]} /> : null}
      <View style={[styles.tlDot, { backgroundColor: bg }]}>
        <Icon name={icon} size={16} color={fg} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.tlTitle, !done && !active && { color: colors.mute }]}>{title}</Text>
        <Text style={[text.meta, styles.f125, styles.mt3]}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  pt6: { paddingTop: 6 },
  mt1: { marginTop: 1 },
  mt3: { marginTop: 3 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  mt18: { marginTop: 18 },
  mt22: { marginTop: 22 },
  mb10: { marginBottom: 10 },
  f12: { fontSize: 12 },
  f125: { fontSize: 12.5 },
  gap5: { gap: 5 },
  white: { color: colors.white },
  selfStart: { alignSelf: 'flex-start' },
  centerText: { textAlign: 'center' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  steps: { flexDirection: 'row', gap: 5 },
  stepBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.progressTrack },
  stepOn: { backgroundColor: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  chip: {
    height: 42,
    paddingLeft: 6,
    paddingRight: 15,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  ci: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  ciOn: { backgroundColor: colors.onInk16b },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  ctx: { backgroundColor: colors.surface, borderRadius: 24, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  ctxTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 19.4, color: colors.ink },
  ctxName: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 20, color: colors.ink },
  reasons: { gap: 8, marginTop: 18 },
  opt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    borderRadius: radius.option,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  optOn: { borderColor: colors.ink },
  optTitle: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19.5, color: colors.ink },
  optSub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16.9, color: colors.mute, marginTop: 3 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  details: { minHeight: 132 },
  shotLabel: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 16, marginBottom: 8 },
  shotAdd: {
    height: 84,
    borderRadius: radius.tile,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  shotAddText: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.ink2 },
  attach: {
    height: 84,
    borderRadius: radius.tile,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
  },
  shot: { width: 60, height: 64, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, overflow: 'hidden' },
  shotName: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },
  card: { backgroundColor: colors.surface, borderRadius: radius.card },
  pad: { padding: 18 },
  blockCard: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  blockIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.neutralPill, alignItems: 'center', justifyContent: 'center' },
  blockTitle: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19, color: colors.ink },
  done: { alignItems: 'center', paddingTop: 18 },
  doneBody: { marginTop: 8, color: colors.ink2, maxWidth: 300, textAlign: 'center' },
  timeline: { alignSelf: 'stretch', marginTop: 22 },
  tl: { flexDirection: 'row', gap: 14, paddingBottom: 22 },
  tlLast: { paddingBottom: 0 },
  tlLine: { position: 'absolute', left: 15, top: 32, bottom: 0, width: 2, backgroundColor: colors.line },
  tlLineDone: { backgroundColor: colors.ok },
  tlDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tlTitle: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19.5, color: colors.ink },
  blockedNote: {
    alignSelf: 'stretch',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  blockedIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.neutralPill, alignItems: 'center', justifyContent: 'center' },
  blockedText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 19.6, color: colors.ink },
});
