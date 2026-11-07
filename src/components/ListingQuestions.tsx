import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Listing, ListingQuestion } from '@/domain/types';
import { useAnswerQuestion, useAskQuestion, useDeleteQuestion, useListingQuestions, useProfile } from '@/api/queries';
import { isOpenListing } from '@/domain/editing';
import { postedAgo } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { confirm } from '@/lib/confirm';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import nb from '@/i18n/nb';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Avatar, Button, ErrorText, FadeUp, Icon, ScaleIn, Sheet, TextLink } from '@/components/ui';
import { ConfirmCheckbox } from '@/components/ui/ConfirmCheckbox';

const MAX_QUESTION = 300;
const MAX_ANSWER = 500;
const BOTTOM = 170;

/**
 * «Spørsmål fra naboer» (0088, «Tilbyr hjelp» only since 0094). Read by everyone who sees the post.
 * People kept using it as a message to the helper, so asking goes through two steps: first the
 * choice between a private chat and a public question, then a tick that says it is public.
 * Youth accounts read but don't ask (rule 5): the server refuses it, so the box isn't shown either.
 */
export function ListingQuestions({
  listing,
  meId,
  isOwner,
  youth,
  onContact,
}: {
  listing: Listing;
  meId: string;
  isOwner: boolean;
  youth: boolean;
  /** opens the private chat with the helper */
  onContact: () => void;
}) {
  const { data } = useListingQuestions(listing.id);
  const ask = useAskQuestion(listing.id);
  const [step, setStep] = useState<'gate' | 'write' | null>(null);
  const [body, setBody] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [tried, setTried] = useState(false);
  const [answering, setAnswering] = useState<ListingQuestion | null>(null);
  const questions = data ?? [];
  const canAsk = !isOwner && !youth && isOpenListing(listing.status);
  if (!questions.length && !canAsk) return null;

  const first = listing.owner.displayName.split(' ')[0];
  const openGate = () => {
    setUnderstood(false);
    setTried(false);
    setStep('gate');
  };
  const send = () => {
    if (!understood) {
      setTried(true);
      return;
    }
    ask.mutate(body.trim(), {
      onSuccess: () => {
        setBody('');
        setStep(null);
        toast.success(nb.questions.sent, { icon: 'check', bottom: BOTTOM });
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: BOTTOM }),
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={styles.sec}>{nb.questions.title}</Text>
        {canAsk ? <TextLink label={nb.questions.ask} icon="plus" onPress={openGate} /> : null}
      </View>
      {questions.length ? (
        <View style={styles.list}>
          {questions.map((q, i) => (
            <FadeUp key={q.id} delay={Math.min(i, 5) * 40}>
              <QuestionRow listing={listing} q={q} meId={meId} isOwner={isOwner} onAnswer={() => setAnswering(q)} />
            </FadeUp>
          ))}
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={openGate} style={styles.empty}>
          <Icon name="msg" size={18} color={colors.cyanDeep} />
          <Text style={[text.meta, styles.flex]}>{nb.questions.empty}</Text>
        </Pressable>
      )}

      <Sheet visible={!!step} onClose={() => setStep(null)} scroll>
        {step === 'gate' ? (
          <View style={styles.gate}>
            <ScaleIn style={styles.gateIcon}>
              <Icon name="eye" size={30} color={colors.ink} />
            </ScaleIn>
            <Text style={[text.h2, styles.center]}>{nb.questions.gateTitle}</Text>
            <Text style={[text.body, styles.gateLead]}>{nb.questions.gateLead(first)}</Text>
            <View style={styles.points}>
              {nb.questions.gatePoints.map((p) => (
                <View key={p} style={styles.point}>
                  <Icon name="globe" size={16} color={colors.cyanDeep} />
                  <Text style={styles.pointText}>{p}</Text>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setStep(null);
                onContact();
              }}
              style={({ pressed }) => [styles.contact, shadow.btnLime, pressed && styles.pressed]}
            >
              <View style={styles.contactIcon}>
                <Icon name="msg" size={20} color={colors.lime} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.contactTitle}>{nb.questions.gateContact(first)}</Text>
                <Text style={styles.contactSub}>{nb.questions.gateContactSub}</Text>
              </View>
              <Icon name="arrow" size={18} color={colors.ink} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setStep('write')} style={({ pressed }) => [styles.public, pressed && styles.pressed]}>
              <View style={styles.flex}>
                <Text style={styles.publicTitle}>{nb.questions.gatePublic}</Text>
                <Text style={text.meta}>{nb.questions.gatePublicSub}</Text>
              </View>
              <Icon name="right" size={18} color={colors.faint} />
            </Pressable>
          </View>
        ) : (
          <View>
            <View style={styles.writeHead}>
              <Text style={[text.h3, styles.flex]}>{nb.questions.askTitle}</Text>
              <View style={styles.tag}>
                <Icon name="globe" size={13} color={colors.cyanDeep} />
                <Text style={styles.tagText}>{nb.questions.composeTag}</Text>
              </View>
            </View>
            <Text style={[text.meta, styles.mb12]}>{nb.questions.askHint}</Text>
            <Box value={body} onChange={setBody} max={MAX_QUESTION} placeholder={nb.questions.askPh} label={nb.questions.askTitle} />
            <View style={styles.mt12}>
              <ConfirmCheckbox
                value={understood}
                onChange={(v) => {
                  setUnderstood(v);
                  setTried(false);
                }}
              >
                {nb.questions.understand}
              </ConfirmCheckbox>
            </View>
            {tried && !understood ? <ErrorText>{nb.questions.understandMissing}</ErrorText> : null}
            <Button label={nb.questions.send} icon="send" loading={ask.isPending} disabled={body.trim().length < 3} onPress={send} style={styles.mt12} />
          </View>
        )}
      </Sheet>

      <AnswerSheet listingId={listing.id} question={answering} onClose={() => setAnswering(null)} />
    </View>
  );
}

function Box({ value, onChange, max, placeholder, label }: { value: string; onChange: (v: string) => void; max: number; placeholder: string; label: string }) {
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={max}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={label}
        style={styles.box}
      />
      <Text style={[text.small, styles.counter]}>{`${value.length} / ${max}`}</Text>
    </View>
  );
}

function AnswerSheet({ listingId, question, onClose }: { listingId: string; question: ListingQuestion | null; onClose: () => void }) {
  const answer = useAnswerQuestion(listingId);
  const [value, setValue] = useState('');
  const send = () => {
    if (!question) return;
    answer.mutate(
      { id: question.id, answer: value.trim() },
      {
        onSuccess: () => {
          setValue('');
          onClose();
          toast.success(nb.questions.answered, { icon: 'check', bottom: BOTTOM });
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: BOTTOM }),
      },
    );
  };
  return (
    <Sheet visible={!!question} onClose={onClose} title={nb.questions.answerTitle}>
      <View style={styles.quote}>
        <Text style={text.body}>{question?.body}</Text>
      </View>
      <Text style={[text.meta, styles.mb12]}>{nb.questions.answerHint}</Text>
      <Box value={value} onChange={setValue} max={MAX_ANSWER} placeholder={nb.questions.answerPh} label={nb.questions.answerTitle} />
      <Button label={nb.questions.publish} icon="check" loading={answer.isPending} disabled={!value.trim()} onPress={send} style={styles.mt12} />
    </Sheet>
  );
}

function QuestionRow({ listing, q, meId, isOwner, onAnswer }: { listing: Listing; q: ListingQuestion; meId: string; isOwner: boolean; onAnswer: () => void }) {
  const author = useProfile(q.authorId).data;
  const remove = useDeleteQuestion(listing.id);
  const mine = q.authorId === meId;
  const askRemove = async () => {
    const ok = await confirm({ title: nb.questions.deleteTitle, confirmLabel: nb.questions.deleteConfirm, destructive: true });
    if (ok) remove.mutate(q.id, { onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: BOTTOM }) });
  };
  const first = author?.displayName.split(' ')[0] ?? nb.questions.neighbour;
  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.qRow}>
        <Avatar initials={author?.initials ?? 'N'} uri={author?.avatarUrl} seed={q.authorId} size={32} ring={false} />
        <View style={styles.flex}>
          <Text style={styles.who}>{`${first} · ${postedAgo(q.createdAt, new Date(), true)}`}</Text>
          <Text style={text.body}>{q.body}</Text>
        </View>
      </View>
      {q.answer ? (
        <ScaleIn style={styles.answer}>
          <Text style={styles.answerBy}>{nb.questions.answerBy(listing.owner.displayName.split(' ')[0])}</Text>
          <Text style={text.body}>{q.answer}</Text>
        </ScaleIn>
      ) : isOwner ? (
        <Button label={nb.questions.answer} icon="reply" variant="ink" size="sm" block={false} onPress={onAnswer} />
      ) : (
        <Text style={text.meta}>{nb.questions.waiting}</Text>
      )}
      <View style={styles.acts}>
        {isOwner || mine ? <TextLink label={nb.questions.delete} icon={null} onPress={() => void askRemove()} /> : null}
        {!mine && !isOwner ? <TextLink label={nb.questions.report} icon={null} onPress={() => safePush(`/rapporter?listing=${listing.id}`)} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.86 },
  gate: { gap: 12, alignItems: 'stretch', paddingTop: 4 },
  gateIcon: { alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  gateLead: { color: colors.ink2, textAlign: 'center' },
  points: { gap: 8, padding: 14, borderRadius: radius.card, backgroundColor: colors.surface2 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointText: { ...text.body, flex: 1, fontSize: 14, lineHeight: 19 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, padding: 14, borderRadius: radius.card, backgroundColor: colors.lime },
  contactIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  contactTitle: { fontFamily: text.h3.fontFamily, fontSize: 17, color: colors.ink },
  contactSub: { ...text.meta, color: colors.ink2 },
  public: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.line },
  publicTitle: { ...text.label, fontSize: 14.5 },
  writeHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.cyanTint },
  tagText: { fontFamily: text.label.fontFamily, fontSize: 12.5, color: colors.cyanDeep },
  wrap: { gap: 12 },
  mb12: { marginBottom: 12 },
  mt12: { marginTop: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sec: { ...text.sectionTitle, fontSize: 18 },
  list: { gap: 10 },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.cyanTint,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, gap: 10 },
  qRow: { flexDirection: 'row', gap: 10 },
  who: { ...text.meta, marginBottom: 2 },
  answer: { backgroundColor: colors.limeTint, borderRadius: radius.m, padding: 12, gap: 3 },
  answerBy: { fontFamily: text.label.fontFamily, fontSize: 12.5, color: colors.limeDeep },
  acts: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14 },
  quote: { backgroundColor: colors.surface2, borderRadius: radius.m, padding: 12, marginBottom: 12 },
  box: {
    ...text.input,
    minHeight: 112,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  counter: { textAlign: 'right', marginTop: 6 },
});
