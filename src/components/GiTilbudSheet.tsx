import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { Listing } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import nb from '@/i18n/nb';
import { apiClient } from '@/api/client';
import { chatKeys, useProfile, useStartConversation } from '@/api/queries';
import { useSession } from '@/auth/session';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { shortDate } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { colors, radius, shadow, text } from '@/theme/theme';
import {
  AmountInput,
  Avatar,
  Button,
  CategoryArt,
  Chip,
  ChipRow,
  Confetti,
  DrawnCheck,
  ErrorText,
  FadeUp,
  Field,
  Icon,
  IconButton,
  Input,
  Note,
  Pill,
  ScaleIn,
  Sheet,
  SlideIn,
  VerifiedBadge,
  formatAmount,
} from '@/components/ui';

const TIMES = ['kl. 10:00', 'kl. 12:00', 'kl. 14:00', 'kl. 17:00'];
const MSG_MAX = 500;
const kr = (n: number) => `${formatAmount(String(n))} kr`;

export type GiTilbudSheetProps = {
  listing: Listing;
  visible: boolean;
  onClose: () => void;
  /** Called once the offer is sent (conversation id, or null under the mock login). */
  onSent: (conversationId: string | null) => void;
  onOpenChat: (conversationId: string | null) => void;
};

/**
 * Gi tilbud (Oppdragsdetaljer.dc.html sheet): form → preview → sent.
 * Sends through the existing conversation + proposal API.
 */
export function GiTilbudSheet({ listing, visible, onClose, onSent, onOpenChat }: GiTilbudSheetProps) {
  const qc = useQueryClient();
  const me = useCurrentUser();
  const { userId } = useSession();
  const myProfile = useProfile(userId ?? '');
  const startConversation = useStartConversation();

  const owner = listing.owner;
  const first = owner.displayName.split(' ')[0];
  const budget = listing.price && listing.priceMode !== 'BY_AGREEMENT' ? Math.round(listing.price.amountMinor / 100) : null;
  const place = listing.location.place || listing.location.municipality;
  const days = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      out.push(shortDate(d.toISOString()));
    }
    return out;
  }, []);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [amount, setAmount] = useState(budget ? String(budget) : '');
  const [msg, setMsg] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [caveats, setCaveats] = useState('');
  const [errAmt, setErrAmt] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);

  const a = Number(amount) || 0;
  const diff = budget != null ? a - budget : null;
  const when = [day, time].filter(Boolean).join(' · ');
  const quick = budget ? [budget - 50, budget, budget + 50].filter((v) => v > 0) : [];
  const templates = nb.giTilbud.templates(first, day, place);

  const close = () => {
    if (sending) return;
    onClose();
    // Reopening after a sent offer starts fresh at the form.
    if (step === 3) setStep(1);
  };

  const toPreview = () => {
    const m = msg.trim().length;
    const eA = a > 0 ? null : nb.giTilbud.errAmount;
    const eM = m >= 10 ? null : m === 0 ? nb.giTilbud.errMsgEmpty(first) : nb.giTilbud.errMsgShort;
    setErrAmt(eA);
    setErrMsg(eM);
    setTries((t) => t + 1);
    if (!eA && !eM) setStep(2);
  };

  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      let id: string | null = null;
      // Mock Vipps login: no account yet – run the flow without saving.
      if (userId) {
        const conv = await startConversation.mutateAsync(listing.id);
        await apiClient.sendProposal({
          conversationId: conv.id,
          listingId: listing.id,
          priceAmountMinor: a * 100,
          message: msg.trim(),
          scheduledText: when ? when.replace(' · ', ' ') : undefined,
          caveats: caveats.trim() || undefined,
        });
        id = conv.id;
        qc.invalidateQueries({ queryKey: chatKeys.messages(conv.id) });
        qc.invalidateQueries({ queryKey: ['conversations'] });
        qc.invalidateQueries({ queryKey: ['proposals', 'listing', listing.id] });
      }
      haptics.success();
      setConvId(id);
      setStep(3);
      onSent(id);
    } catch {
      toast.error(nb.giTilbud.sendFailed);
    } finally {
      setSending(false);
    }
  };

  const cat = categoryArtId(listing.category.slug);
  const ownerLine = [owner.displayName, listing.task?.scheduledText, place].filter(Boolean).join(' · ');
  const myRating = myProfile.data?.rating;
  const myJobs = myProfile.data?.completedTasks;

  return (
    <Sheet visible={visible} onClose={close} scroll heightRatio={0.94} dismissible={!sending} testID="gi-tilbud">
      {step === 1 ? (
        <FadeUp>
          <View style={styles.head}>
            <View style={styles.headTitles}>
              <Steps n={1} />
              <Text style={text.h2} accessibilityRole="header">
                {nb.giTilbud.title}
              </Text>
            </View>
            <IconButton icon="x" iconSize={18} accessibilityLabel={nb.giTilbud.close} onPress={close} />
          </View>
          <View style={styles.taskBox}>
            <CategoryArt category={cat} uri={listing.images[0]?.url} width={46} height={46} radius={13} iconSize={22} />
            <View style={styles.flex}>
              <Text style={[text.label, styles.f145]} numberOfLines={1}>
                {listing.title}
              </Text>
              <Text style={text.meta} numberOfLines={2}>
                {ownerLine}
              </Text>
            </View>
            <Pill label={nb.giTilbud.task} tone="need" dot />
          </View>

          <Field
            label={nb.giTilbud.amount}
            hint={budget ? nb.giTilbud.budget(kr(budget)) : undefined}
            error={errAmt}
            shakeKey={tries}
          >
            <AmountInput
              value={amount}
              onChangeText={(v) => {
                setAmount(v);
                setErrAmt(null);
              }}
              error={!!errAmt}
              suffix="kr"
              accessibilityLabel={nb.giTilbud.amountLabel}
            />
            {quick.length || (a > 0 && diff != null) ? (
              <View style={styles.quickRow}>
                {quick.map((v) => {
                  const on = a === v;
                  return (
                    <Pressable
                      key={v}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        setAmount(String(v));
                        setErrAmt(null);
                      }}
                      style={[styles.qchip, on && styles.qchipOn]}
                    >
                      <Text style={[styles.qchipText, on && styles.qchipTextOn]}>{kr(v)}</Text>
                    </Pressable>
                  );
                })}
                {a > 0 && diff != null ? (
                  <Text style={[text.help, styles.amtHint]}>
                    {diff === 0 ? nb.giTilbud.same : diff < 0 ? nb.giTilbud.under(kr(-diff)) : nb.giTilbud.over(kr(diff))}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Field>

          <View style={styles.field22}>
            <View style={styles.labelRow}>
              <Text style={text.label}>{nb.giTilbud.message(first)}</Text>
              <Text style={[styles.ctr, msg.length > 480 && styles.ctrWarn]}>{`${msg.length}/${MSG_MAX}`}</Text>
            </View>
            <Input
              value={msg}
              onChangeText={(v) => {
                setMsg(v.slice(0, MSG_MAX));
                setErrMsg(null);
              }}
              multiline
              placeholder={nb.giTilbud.messagePh}
              error={!!errMsg}
              accessibilityLabel={nb.giTilbud.message(first)}
              style={styles.textarea}
            />
            <View style={styles.tplRow}>
              {templates.map((t) => (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  onPress={() => {
                    const cur = msg.trim();
                    setMsg(`${cur ? `${cur} ` : ''}${t}`.slice(0, MSG_MAX));
                    setErrMsg(null);
                  }}
                  style={styles.tchip}
                >
                  <Icon name="plus" size={14} color={colors.limeDeep} />
                  <Text style={styles.tchipText}>{t}</Text>
                </Pressable>
              ))}
            </View>
            {errMsg ? <ErrorText shakeKey={tries}>{errMsg}</ErrorText> : null}
          </View>

          <View style={styles.field22}>
            <View style={styles.labelRow}>
              <Text style={text.label}>{nb.giTilbud.day}</Text>
              {listing.task?.scheduledText ? (
                <Text style={text.hint} numberOfLines={1}>
                  {nb.giTilbud.wishes(first, listing.task.scheduledText)}
                </Text>
              ) : null}
            </View>
            <ChipRow style={styles.bleed}>
              {days.map((d) => (
                <Chip key={d} label={d} size="sm" tone="lime" selected={day === d} onPress={() => setDay(day === d ? null : d)} />
              ))}
            </ChipRow>
            <Text style={[text.label, styles.mt8]}>{nb.giTilbud.time}</Text>
            <ChipRow style={styles.bleed}>
              {TIMES.map((t) => (
                <Chip key={t} label={t} size="sm" tone="lime" selected={time === t} onPress={() => setTime(time === t ? null : t)} />
              ))}
            </ChipRow>
          </View>

          <Field label={nb.giTilbud.caveats} style={styles.field22}>
            <Input
              value={caveats}
              onChangeText={(v) => setCaveats(v.slice(0, 300))}
              multiline
              placeholder={nb.giTilbud.caveatsPh}
              accessibilityLabel={nb.giTilbud.caveats}
              style={styles.textareaSm}
            />
          </Field>

          <Note style={styles.mt16}>{nb.giTilbud.formNote}</Note>
          <Button label={nb.giTilbud.toPreview} iconRight="arrow" size="lg" onPress={toPreview} style={styles.mt16} />
        </FadeUp>
      ) : step === 2 ? (
        <SlideIn direction="forward">
          <View style={styles.head}>
            <View style={styles.row10}>
              <IconButton icon="back" iconSize={18} accessibilityLabel={nb.giTilbud.backToForm} onPress={() => {
                if (!sending) setStep(1);
              }} />
              <View style={styles.headTitles}>
                <Steps n={2} />
                <Text style={text.h3} accessibilityRole="header">
                  {nb.giTilbud.previewTitle}
                </Text>
              </View>
            </View>
            <IconButton icon="x" iconSize={18} accessibilityLabel={nb.giTilbud.close} onPress={close} />
          </View>
          <View style={styles.seenAs}>
            <Icon name="eye" size={14} color={colors.mute} />
            <Text style={text.eyebrow}>{nb.giTilbud.seenAs(first)}</Text>
          </View>
          <View style={styles.pvcard}>
            <View style={styles.row12}>
              <Avatar initials={me.initials} uri={me.avatarUrl} me size={48} />
              <View style={styles.flex}>
                <Text style={[text.label, styles.f16]} numberOfLines={1}>
                  {me.displayName}
                </Text>
                {myRating?.count || myJobs ? (
                  <View style={styles.starsRow}>
                    {myRating?.count ? (
                      <>
                        <Icon name="star" size={14} color={colors.star} filled />
                        <Text style={styles.starsVal}>{myRating.average.toFixed(1).replace('.', ',')}</Text>
                      </>
                    ) : null}
                    <Text style={styles.starsMeta}>
                      {[myRating?.count ? `(${myRating.count})` : null, myJobs ? nb.giTilbud.jobs(myJobs) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Pill label={nb.giTilbud.isNew} tone="ok" />
            </View>
            <View style={[styles.row8, styles.mt10]}>
              <VerifiedBadge label={nb.giTilbud.vipps} />
              {me.place || me.municipality ? <Text style={text.meta}>{`· ${me.place || me.municipality}`}</Text> : null}
            </View>
            <View style={styles.divider} />
            <View style={styles.priceRow}>
              <View style={styles.gap4}>
                <Text style={text.eyebrow}>{nb.giTilbud.price}</Text>
                <Text style={[text.num, styles.bigNum]}>{kr(a)}</Text>
              </View>
              {diff != null ? (
                <Pill
                  label={diff === 0 ? nb.giTilbud.same : diff < 0 ? nb.giTilbud.underBudget(kr(-diff)) : nb.giTilbud.overBudget(kr(diff))}
                  tone={diff > 0 ? 'warn' : 'need'}
                />
              ) : null}
            </View>
            {when ? (
              <View style={[styles.row8, styles.mt14]}>
                <Icon name="cal" size={18} color={colors.limeDeep} />
                <Text style={[text.bodySemi, styles.f145]}>{when}</Text>
              </View>
            ) : null}
            <View style={styles.quote}>
              <Text style={styles.quoteText}>{msg.trim()}</Text>
            </View>
            {caveats.trim() ? (
              <View style={[styles.row8, styles.mt10, styles.top]}>
                <Icon name="info" size={16} color={colors.warn} />
                <Text style={styles.caveat}>
                  <Text style={styles.bold}>{nb.giTilbud.caveatsShort}</Text> {caveats.trim()}
                </Text>
              </View>
            ) : null}
            <View style={[styles.row8, styles.mt14]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.fakeBtn, styles.fakeLime]}>
                <Text style={text.buttonSm}>{nb.giTilbud.accept}</Text>
              </View>
              <View style={[styles.fakeBtn, styles.fakeGhost]}>
                <Text style={text.buttonSm}>{nb.giTilbud.reply}</Text>
              </View>
            </View>
          </View>
          <Note style={styles.mt14}>{nb.giTilbud.payNote}</Note>
          <Button
            label={nb.giTilbud.send}
            icon="send"
            size="lg"
            onPress={send}
            loading={sending}
            loadingLabel={nb.giTilbud.sending}
            style={styles.mt16}
          />
          <Button label={nb.giTilbud.edit} variant="text" onPress={() => {
                if (!sending) setStep(1);
              }} style={styles.mt4} />
        </SlideIn>
      ) : (
        <View style={styles.done}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Confetti count={9} />
          </View>
          <ScaleIn style={styles.mt10}>
            <DrawnCheck size={108} bg={colors.lime} tickColor={colors.ink} ring={shadow.okRing} tickSize={56} />
          </ScaleIn>
          <FadeUp delay={150}>
            <Text style={[text.h2, styles.center, styles.mt20]}>{nb.giTilbud.sentTitle(first)}</Text>
          </FadeUp>
          <FadeUp delay={200}>
            <Text style={[text.meta, styles.center, styles.f15, styles.mt8]}>{nb.giTilbud.sentSub(first)}</Text>
          </FadeUp>
          <FadeUp delay={250} style={styles.stretch}>
            <View style={[styles.taskBox, styles.sentBox]}>
              <CategoryArt category={cat} uri={listing.images[0]?.url} width={44} height={44} radius={13} iconSize={22} />
              <View style={styles.flex}>
                <Text style={[text.label, styles.f145]} numberOfLines={1}>
                  {listing.title}
                </Text>
                <Text style={text.meta} numberOfLines={1}>
                  {[kr(a), when].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Pill label={nb.giTilbud.waiting} tone="warn" />
            </View>
          </FadeUp>
          <FadeUp delay={300} style={[styles.stretch, styles.doneActions]}>
            <Button label={nb.giTilbud.toChat} icon="msg" size="lg" onPress={() => onOpenChat(convId)} />
            <Button label={nb.giTilbud.close} variant="ghost" onPress={close} />
          </FadeUp>
        </View>
      )}
    </Sheet>
  );
}

/** `.steps` – two 5 px bars, filled ink up to the current step. */
function Steps({ n }: { n: 1 | 2 }) {
  return (
    <View style={styles.steps} accessibilityLabel={`Steg ${n} av 2`}>
      <View style={[styles.stepBar, styles.stepOn]} />
      <View style={[styles.stepBar, n === 2 && styles.stepOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 3 },
  center: { textAlign: 'center' },
  stretch: { alignSelf: 'stretch' },
  top: { alignItems: 'flex-start' },
  bold: { fontFamily: text.label.fontFamily },
  f145: { fontSize: 14.5 },
  f15: { fontSize: 15 },
  f16: { fontSize: 16 },
  gap4: { gap: 4 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  mt20: { marginTop: 20 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row10: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row12: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  headTitles: { gap: 8 },
  steps: { flexDirection: 'row', gap: 5, width: 70 },
  stepBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.progressTrack },
  stepOn: { backgroundColor: colors.ink },
  taskBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    backgroundColor: colors.bg,
    marginBottom: 20,
  },
  sentBox: { marginTop: 18, marginBottom: 0, paddingVertical: 14, paddingHorizontal: 16 },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  qchip: {
    height: 40,
    paddingHorizontal: 15,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  qchipOn: { backgroundColor: colors.limeTint, borderColor: colors.chipLimeBorder },
  qchipText: { fontFamily: text.h3.fontFamily, fontSize: 14.5, color: colors.ink },
  qchipTextOn: { color: colors.limeDeep },
  amtHint: { marginLeft: 'auto' },
  field22: { marginTop: 22, gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  ctr: { fontFamily: text.bodySemi.fontFamily, fontSize: 12.5, color: colors.mute },
  ctrWarn: { color: colors.danger },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  textareaSm: { minHeight: 80, textAlignVertical: 'top' },
  tplRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tchip: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    backgroundColor: colors.surface2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  tchipText: { fontFamily: text.bodySemi.fontFamily, fontSize: 13, lineHeight: 17, color: colors.ink2, flexShrink: 1 },
  bleed: { marginHorizontal: -20, paddingTop: 2 },
  seenAs: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 4 },
  pvcard: {
    borderRadius: radius.listingCard,
    borderWidth: 1.5,
    borderColor: colors.previewBorder,
    backgroundColor: colors.previewBg,
    padding: 18,
  },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsVal: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink },
  starsMeta: { fontFamily: text.meta.fontFamily, fontSize: 13, color: colors.mute },
  divider: { height: 1, backgroundColor: colors.line2, marginVertical: 14 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 },
  bigNum: { fontSize: 36, lineHeight: 38 },
  quote: { marginTop: 12, backgroundColor: colors.bg, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  quoteText: { ...text.body, fontSize: 14.5, lineHeight: 22 },
  caveat: { ...text.body, fontSize: 13.5, color: colors.ink2, flex: 1 },
  fakeBtn: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  fakeLime: { backgroundColor: colors.lime },
  fakeGhost: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  done: { alignItems: 'center', paddingTop: 14, paddingBottom: 4, overflow: 'hidden' },
  doneActions: { gap: 10, marginTop: 18 },
});

