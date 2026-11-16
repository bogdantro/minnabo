import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LendItem, LendRequest } from '@/domain/types';
import nb from '@/i18n/nb';
import { useProfile, useRespondLend } from '@/api/queries';
import { LEND_ART, dateOf, loanDays } from '@/domain/lend';
import { shortDate } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Avatar, Button, CategoryArt, Field, Icon, Input, Pill, Sheet, type PillTone } from '@/components/ui';

const REPLY_MAX = 300;
const day = (d: string) => shortDate(dateOf(d).toISOString());
const TONE: Record<LendRequest['status'], PillTone> = { PENDING: 'warn', ACCEPTED: 'ok', DECLINED: 'neutral', CANCELLED: 'neutral' };

/**
 * One request on «Forespørsler»: the thing, who, which days and how many, the message, the owner's reply,
 * and what can be done now. `item` is known for my own things (for the photo); others show the category tile.
 */
export function LendRequestCard({ r, meId, item }: { r: LendRequest; meId: string; item?: LendItem }) {
  const t = nb.lend;
  const iOwn = r.ownerId === meId;
  const other = useProfile(iOwn ? r.borrowerId : r.ownerId).data;
  const ownerFirst = iOwn ? '' : (other?.displayName ?? '').split(' ')[0];
  const otherFirst = (other?.displayName ?? '').split(' ')[0];
  const respond = useRespondLend();
  const [answer, setAnswer] = useState<'ACCEPTED' | 'DECLINED' | null>(null);
  const days = loanDays(r.fromDate, r.toDate);
  const open = r.status === 'PENDING' || r.status === 'ACCEPTED';

  const cancel = () =>
    respond.mutate(
      { id: r.id, status: 'CANCELLED' },
      {
        onSuccess: () => {
          haptics.warning();
          toast.info(t.cancelledToast, { icon: 'x' });
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );

  return (
    <View style={[styles.card, shadow.card, !open && styles.closed]}>
      <View style={styles.head}>
        <CategoryArt category={item ? LEND_ART[item.category] : 'annet'} uri={item?.imageUrl} width={52} height={52} radius={16} iconSize={22} />
        <View style={styles.flex}>
          <Text style={text.label} numberOfLines={1}>
            {r.itemTitle}
          </Text>
          <View style={styles.who}>
            <Avatar initials={other?.initials ?? '·'} uri={other?.avatarUrl} seed={other?.id ?? r.id} size={20} ring={false} />
            <Text style={styles.whoText} numberOfLines={1}>
              {iOwn ? t.askFrom(other?.displayName ?? '') : t.askMine(ownerFirst)}
            </Text>
          </View>
        </View>
        <Pill label={t.status[r.status]} tone={TONE[r.status]} size="sm" />
      </View>

      <View style={styles.period}>
        <Icon name="cal" size={15} color={colors.limeDeep} />
        <Text style={styles.periodText}>{t.period(day(r.fromDate), day(r.toDate))}</Text>
        <View style={styles.daysPill}>
          <Text style={styles.daysText}>{t.days(days)}</Text>
        </View>
      </View>

      {r.note ? (
        <View style={styles.bubble}>
          <Text style={styles.bubbleLabel}>{t.theirNote}</Text>
          <Text style={styles.bubbleText}>{r.note}</Text>
        </View>
      ) : null}
      {r.reply ? (
        <View style={[styles.bubble, styles.reply]}>
          <Text style={[styles.bubbleLabel, styles.replyLabel]}>{iOwn ? t.yourReply : t.ownerReply(ownerFirst)}</Text>
          <Text style={[styles.bubbleText, styles.replyText]}>{r.reply}</Text>
        </View>
      ) : null}

      {r.status === 'PENDING' && iOwn ? (
        <View style={styles.btns}>
          <Button label={t.decline} variant="ghost" size="sm" block={false} onPress={() => setAnswer('DECLINED')} style={styles.grow} />
          <Button label={t.accept} icon="check" size="sm" block={false} onPress={() => setAnswer('ACCEPTED')} style={styles.grow} />
        </View>
      ) : open && !iOwn ? (
        <Button label={r.status === 'ACCEPTED' ? t.cancelLoan : t.cancel} icon="x" variant="ghost" size="sm" loading={respond.isPending} onPress={cancel} />
      ) : null}

      {answer ? <AnswerSheet r={r} status={answer} otherFirst={otherFirst} onClose={() => setAnswer(null)} /> : null}
    </View>
  );
}

/** «Godta» / «Avslå» with a short reply – the only place pickup is agreed (there is no chat for utlån). */
function AnswerSheet({ r, status, otherFirst, onClose }: { r: LendRequest; status: 'ACCEPTED' | 'DECLINED'; otherFirst: string; onClose: () => void }) {
  const t = nb.lend;
  const respond = useRespondLend();
  const [reply, setReply] = useState('');
  const yes = status === 'ACCEPTED';
  const send = () =>
    respond.mutate(
      { id: r.id, status, reply },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(yes ? t.acceptedToast : t.declinedToast, { icon: yes ? 'check' : 'x' });
          onClose();
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );
  return (
    <Sheet
      visible
      onClose={() => !respond.isPending && onClose()}
      title={yes ? t.answerAccept(otherFirst) : t.answerDecline(otherFirst)}
      titleSize="h2"
      subtitle={yes ? t.answerSub : t.answerSubDecline}
    >
      <View style={styles.answer}>
        <View style={styles.period}>
          <Icon name="cal" size={15} color={colors.limeDeep} />
          <Text style={styles.periodText}>{`${r.itemTitle} · ${t.period(day(r.fromDate), day(r.toDate))}`}</Text>
        </View>
        <Field label={t.replyLabel} hint={`${reply.length}/${REPLY_MAX}`}>
          <Input value={reply} onChangeText={setReply} placeholder={yes ? t.replyPhAccept : t.replyPhDecline} maxLength={REPLY_MAX} multiline accessibilityLabel={t.replyLabel} />
        </Field>
        <Button label={yes ? t.confirmAccept : t.confirmDecline} icon={yes ? 'check' : 'x'} variant={yes ? 'lime' : 'ink'} size="lg" loading={respond.isPending} onPress={send} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: radius.card, backgroundColor: colors.white, gap: 12 },
  closed: { opacity: 0.72 },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whoText: { ...text.meta, fontSize: 12.5, flex: 1 },
  period: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.limeTint },
  periodText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  daysPill: { height: 24, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.white, justifyContent: 'center' },
  daysText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.limeDeep },
  bubble: { padding: 12, borderRadius: 16, borderBottomLeftRadius: 6, backgroundColor: colors.surface2, gap: 3 },
  bubbleLabel: { ...text.meta, fontSize: 11.5 },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  reply: { backgroundColor: colors.ink, borderBottomLeftRadius: 16, borderBottomRightRadius: 6, alignSelf: 'flex-end', maxWidth: '92%' },
  replyLabel: { color: colors.lime },
  replyText: { color: colors.white },
  btns: { flexDirection: 'row', gap: 8 },
  grow: { flexGrow: 1, flexBasis: 0 },
  answer: { gap: 14 },
});
