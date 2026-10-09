import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { categoryArtId } from '@/domain/categories';
import { serverMessage } from '@/lib/errors';
import nb from '@/i18n/nb';
import { useListing, useMyAgreements, useProfile, useProposal, useSubmitReview } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { shortDate } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import { FallbackScreen } from '@/components/FallbackScreen';
import {
  Avatar,
  Button,
  CategoryArt,
  Chip,
  Confetti,
  FadeUp,
  Field,
  Icon,
  Input,
  Note,
  Pill,
  ScaleIn,
  Screen,
  Segmented,
  StickyFooter,
  SubHeader,
  VerifiedBadge,
} from '@/components/ui';

const WORD_COLOR = [colors.mute, colors.danger, colors.warn, colors.ink2, colors.limeDeep, colors.limeDeep];

/** Gi vurdering (design/screens/Vurdering.dc.html). */
export function ReviewScreen({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const me = useCurrentUser();
  const submit = useSubmitReview();
  const { data: proposal, isLoading, isError, refetch } = useProposal(proposalId);
  const { data: listing } = useListing(proposal?.listingId ?? '');
  const counterpartId = proposal ? (proposal.fromProfileId === me.id ? proposal.toProfileId : proposal.fromProfileId) : '';
  const { data: other } = useProfile(counterpartId);
  const agenda = useMyAgreements();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [rec, setRec] = useState<'ja' | 'nei' | null>(null);
  const [done, setDone] = useState(false);

  if (!proposal) {
    return <FallbackScreen status={isError ? 'error' : isLoading ? 'loading' : 'empty'} onRetry={() => refetch()} title={nb.review.formTitle} />;
  }

  const first = (other?.displayName ?? '').split(' ')[0];
  const iAmClient = proposal.toProfileId === me.id;
  const cat = categoryArtId(listing?.category.slug ?? 'annet');
  const already = !done && agenda.data?.find((a) => a.proposalId === proposalId)?.myRating != null;
  const ctx = [listing?.title, proposal.scheduledText].filter(Boolean).join(' · ');
  const word = nb.review.words[rating];
  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  // "Vil du anbefale …? Ja" is saved as the "Anbefales" tag (no separate field in the API).
  const finalTags = rec === 'ja' && !tags.includes('Anbefales') ? [...tags, 'Anbefales'] : tags;

  const send = () => {
    if (!rating || submit.isPending || !counterpartId) return;
    submit.mutate(
      {
        agreementProposalId: proposalId,
        listingId: proposal.listingId,
        fromProfileId: me.id,
        toProfileId: counterpartId,
        rating,
        comment: comment.trim() || undefined,
        tags: finalTags.length ? finalTags : undefined,
      },
      {
        onSuccess: () => {
          haptics.success();
          setDone(true);
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );
  };

  return (
    <View style={styles.flex}>
      <Screen
        scroll
        header={
          <SubHeader
            title={done ? nb.review.doneTitle : nb.review.formTitle}
            onBack={done ? undefined : () => (router.canGoBack() ? router.back() : router.replace('/avtaler'))}
          />
        }
      >
        {done ? (
          <View>
            <View style={[styles.px, styles.doneHero]}>
              <ScaleIn>
                <View style={[styles.okbadge, shadow.starBadge]}>
                  <Icon name="star" size={52} color={colors.white} filled />
                </View>
              </ScaleIn>
              <FadeUp delay={150}>
                <Text style={[styles.display, styles.center]} accessibilityRole="header">
                  {nb.review.thanks}
                </Text>
              </FadeUp>
              <FadeUp delay={200}>
                <Text style={[text.body, styles.muted, styles.center]}>{nb.review.thanksSub(first)}</Text>
              </FadeUp>
            </View>
            <FadeUp delay={250} style={[styles.px, styles.mt22]}>
              <Text style={[text.eyebrow, styles.mb10]}>{nb.review.howShown}</Text>
              <View style={[styles.review, shadow.medium]}>
                <View style={styles.reviewBar} />
                <View style={styles.row12}>
                  <Avatar initials={me.initials} uri={me.avatarUrl} me size={40} ring={false} />
                  <View style={styles.flex1}>
                    <Text style={[text.label, styles.f15]}>{shortName(me.displayName)}</Text>
                    <Text style={text.meta}>{[me.place || me.municipality, shortDate(new Date().toISOString()).replace(/^\S+ /, '')].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <VerifiedBadge label={nb.review.agreementBadge} />
                </View>
                <View style={[styles.row8, styles.mt12]}>
                  <View style={styles.rs}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Icon key={n} name="star" size={17} color={n <= rating ? colors.star : colors.rangeTrack} filled />
                    ))}
                  </View>
                  <Text style={[text.label, styles.f14]}>{word}</Text>
                </View>
                {comment.trim() ? <Text style={[text.body, styles.ink2, styles.mt10]}>«{comment.trim()}»</Text> : null}
                {finalTags.length ? (
                  <View style={styles.rtags}>
                    {finalTags.map((t) => (
                      <Pill key={t} label={t} tone="need" size="sm" />
                    ))}
                  </View>
                ) : null}
                <View style={styles.reviewFoot}>
                  <View style={styles.row6}>
                    <Icon name={cat} size={14} color={colors.mute} />
                    <Text style={text.meta} numberOfLines={1}>
                      {listing?.title ?? ''}
                    </Text>
                  </View>
                  {rec === 'ja' ? <Pill label={nb.review.recommends} tone="ok" icon="thumb" /> : null}
                </View>
              </View>
            </FadeUp>
            <FadeUp delay={300} style={[styles.px, styles.mt12]}>
              <View style={styles.pubrow}>
                <Icon name="award" size={18} color={colors.okText} />
                <Text style={styles.pubText}>{nb.review.pubRow(first)}</Text>
              </View>
            </FadeUp>
          </View>
        ) : (
          <View>
            <FadeUp style={[styles.px, styles.who]}>
              <Avatar initials={other?.initials ?? '·'} uri={other?.avatarUrl} seed={counterpartId} size={88} />
              {ctx ? (
                <View style={styles.ctx}>
                  <CategoryArt category={cat} width={22} height={22} radius={11} iconSize={12} />
                  <Text style={styles.ctxText} numberOfLines={1}>
                    {ctx}
                  </Text>
                </View>
              ) : null}
              <Text style={[text.h2, styles.center, styles.maxW]} accessibilityRole="header">
                {nb.review.question(first, iAmClient)}
              </Text>
            </FadeUp>

            <FadeUp delay={100} style={[styles.px, styles.mt18]}>
              <View style={styles.starrow} accessibilityRole="radiogroup" accessibilityLabel={nb.review.starsLabel}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const on = n <= rating;
                  return (
                    <Pressable
                      key={n}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: rating === n }}
                      accessibilityLabel={nb.review.starLabel(n, nb.review.words[n])}
                      onPress={() => setRating(n)}
                      style={({ pressed }) => [styles.star, on ? [styles.starOn, shadow.starOn] : shadow.card, pressed && styles.pressed]}
                    >
                      <ScaleIn key={on ? `on-${rating}` : 'off'} delay={on ? (n - 1) * 50 : 0}>
                        <Icon name="star" size={32} color={on ? colors.star : colors.dashed} filled={on} />
                      </ScaleIn>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.rlabel} accessibilityLiveRegion="polite">
                {rating ? (
                  <ScaleIn key={rating}>
                    <Text style={[styles.word, { color: WORD_COLOR[rating] }]}>{word}</Text>
                  </ScaleIn>
                ) : (
                  <Text style={styles.tap}>{nb.review.tapStar}</Text>
                )}
              </View>
            </FadeUp>

            <FadeUp delay={150} style={[styles.px, styles.mt22]}>
              <View style={styles.labelRow}>
                <Text style={text.label}>{nb.review.whatGood}</Text>
                <Text style={text.hint}>{nb.review.pickMany}</Text>
              </View>
              <View style={styles.tagwrap}>
                {nb.review.tags.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    tone="lime"
                    selected={tags.includes(t)}
                    icon={tags.includes(t) ? 'check' : undefined}
                    accessibilityLabel={t}
                    onPress={() => toggleTag(t)}
                  />
                ))}
              </View>
            </FadeUp>

            <FadeUp delay={200} style={[styles.px, styles.mt22]}>
              <Field label={nb.review.comment} hint={nb.review.optional}>
                <Input
                  value={comment}
                  onChangeText={(v) => setComment(v.slice(0, 400))}
                  multiline
                  placeholder={nb.review.commentPh}
                  accessibilityLabel={nb.review.comment}
                  style={styles.textarea}
                />
              </Field>
              <Text style={[styles.counter, comment.length > 360 && { color: colors.warn }]}>{`${comment.length}/400`}</Text>
            </FadeUp>

            <FadeUp delay={250} style={[styles.px, styles.mt18]}>
              <Text style={[text.label, styles.mb10]}>{nb.review.recommend(first)}</Text>
              <Segmented
                accessibilityLabel={nb.review.recommend(first)}
                options={[
                  { value: 'ja', label: nb.review.yes },
                  { value: 'nei', label: nb.review.no },
                ]}
                value={rec ?? ('' as 'ja')}
                onChange={(v) => setRec(v)}
              />
            </FadeUp>

            <FadeUp delay={300} style={[styles.px, styles.mt16]}>
              <Note>{already ? nb.review.already : nb.review.note}</Note>
            </FadeUp>
          </View>
        )}
        <View style={styles.bottom} />
      </Screen>

      <StickyFooter>
        {done ? (
          <FadeUp style={styles.foot}>
            <Button label={nb.review.backToOppdrag} iconRight="arrow" size="lg" onPress={() => router.replace('/')} />
            <Button label={nb.review.seeProfile(first)} variant="text" block={false} onPress={() => router.replace(`/profil/${counterpartId}`)} style={styles.selfCenter} />
          </FadeUp>
        ) : (
          <View style={styles.foot}>
            <Button
              label={nb.review.send}
              icon="send"
              size="lg"
              disabled={!rating || already}
              loading={submit.isPending}
              loadingLabel={nb.review.sending}
              onPress={send}
            />
            {!rating ? <Text style={[text.meta, styles.center]}>{nb.review.pickHint}</Text> : null}
          </View>
        )}
      </StickyFooter>

      {done ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Confetti count={40} />
        </View>
      ) : null}
    </View>
  );
}

/** "Mari Haugen" → "Mari H." (how reviews are signed). */
function shortName(name: string): string {
  const [f, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${f} ${last[0]}.` : f ?? '';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex1: { flex: 1, minWidth: 0, gap: 2 },
  px: { paddingHorizontal: screenPadding },
  center: { textAlign: 'center' },
  muted: { color: colors.mute },
  ink2: { color: colors.ink2 },
  maxW: { maxWidth: 320 },
  selfCenter: { alignSelf: 'center' },
  pressed: { transform: [{ scale: 0.88 }] },
  f14: { fontSize: 14 },
  f15: { fontSize: 15 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  mt22: { marginTop: 22 },
  mb10: { marginBottom: 10 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row12: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  who: { alignItems: 'center', gap: 12, marginTop: 8 },
  ctx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingLeft: 5,
    paddingRight: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    maxWidth: '100%',
  },
  ctxText: { fontFamily: text.bodySemi.fontFamily, fontSize: 12.5, color: colors.ink2, flexShrink: 1 },
  starrow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 4 },
  star: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  starOn: { backgroundColor: colors.starTint },
  rlabel: { height: 30, marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  word: { fontFamily: text.h3.fontFamily, fontSize: 20, letterSpacing: -0.4 },
  tap: { fontFamily: text.bodySemi.fontFamily, fontSize: 14.5, color: colors.mute },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  tagwrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  counter: { fontFamily: text.bodySemi.fontFamily, fontSize: 12, color: colors.mute, textAlign: 'right', marginTop: 6 },
  bottom: { height: 170 },
  foot: { gap: 6 },
  doneHero: { marginTop: 10, alignItems: 'center', gap: 8 },
  okbadge: { width: 104, height: 104, borderRadius: 34, backgroundColor: colors.star, alignItems: 'center', justifyContent: 'center' },
  display: { fontFamily: text.h1.fontFamily, fontSize: 36, lineHeight: 39, letterSpacing: -0.9, color: colors.ink, marginTop: 14 },
  review: { padding: 18, borderRadius: radius.listingCard, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  reviewBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.lime },
  rs: { flexDirection: 'row', gap: 2 },
  rtags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  reviewFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line2,
  },
  pubrow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.okTint },
  pubText: { flex: 1, fontFamily: text.bodySemi.fontFamily, fontSize: 13.5, lineHeight: 18, color: colors.okText },
});
