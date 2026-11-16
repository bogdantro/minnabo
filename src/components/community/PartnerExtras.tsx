import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { Partner } from '@/domain/types';
import { useAskPartner, useFollowedPartners, usePartnerQuestions, useToggleFollowPartner } from '@/api/communityQueries';
import { useNoticeboard } from '@/api/queries';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Button, Icon, Input, ListGroup, ListRow } from '@/components/ui';

const ASK_MAX = 400;

/** «Følg» on a partner page (0108): a push when they post an offer or an arrangement. */
export function FollowPartnerButton({ partner }: { partner: Partner }) {
  const followed = useFollowedPartners().data ?? [];
  const toggle = useToggleFollowPartner();
  const on = followed.includes(partner.id);
  return (
    <Button
      label={on ? nb.felles.partner.following : nb.felles.partner.follow}
      variant={on ? 'soft' : 'lime'}
      icon={on ? 'check' : 'bell'}
      accessibilityLabel={nb.felles.partner.followA11y(partner.name)}
      loading={toggle.isPending}
      onPress={() =>
        toggle.mutate(partner.id, {
          onSuccess: () => {
            haptics.success();
            toast.success(on ? nb.felles.partner.unfollowedToast(partner.name) : nb.felles.partner.followedToast(partner.name));
          },
          onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
        })
      }
    />
  );
}

/** The partner's arrangementer on Oppslagstavla, soonest first. */
export function PartnerEvents({ partner }: { partner: Partner }) {
  const [now] = useState(() => Date.now());
  const events = (useNoticeboard().data ?? [])
    .filter((p) => p.partnerId === partner.id && p.eventAt && Date.parse(p.eventAt) > now && !p.doneAt)
    .sort((a, b) => Date.parse(a.eventAt!) - Date.parse(b.eventAt!));
  if (!events.length) return null;
  return (
    <View style={[styles.card, shadow.card]}>
      <Text style={text.eyebrow}>{nb.felles.partner.events}</Text>
      <ListGroup>
        {events.map((e) => (
          <ListRow
            key={e.id}
            icon="cal"
            title={e.title}
            subtitle={new Date(e.eventAt!).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}
            onPress={() => safePush(`/oppslagstavle?oppslag=${e.id}`)}
          />
        ))}
      </ListGroup>
    </View>
  );
}

/** «Spør fagfolk»: answered questions for everyone, mine while I wait, and a field to ask (3 a day). */
export function AskPartner({ partner }: { partner: Partner }) {
  const questions = usePartnerQuestions(partner.id).data ?? [];
  const ask = useAskPartner(partner.id);
  const [body, setBody] = useState('');
  const send = () =>
    ask.mutate(body.trim(), {
      onSuccess: () => {
        haptics.success();
        toast.success(nb.felles.partner.askSent);
        setBody('');
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
    });
  return (
    <View style={[styles.card, shadow.card]} testID="ask-partner">
      <Text style={text.eyebrow}>{nb.felles.partner.askTitle}</Text>
      <Text style={text.meta}>{nb.felles.partner.askSub(partner.name)}</Text>
      {questions.length === 0 ? <Text style={text.hint}>{nb.felles.partner.askNone}</Text> : null}
      {questions.map((q) => (
        <View key={q.id} style={styles.q}>
          <View style={styles.qHead}>
            <Icon name="msg" size={14} color={colors.cyanDeep} />
            <Text style={styles.qText}>{q.body}</Text>
          </View>
          {q.answer ? (
            <View style={styles.answer}>
              <Text style={styles.answerBy}>{nb.felles.partner.askAnswer(partner.name)}</Text>
              <Text style={text.body}>{q.answer}</Text>
            </View>
          ) : (
            <Text style={text.hint}>{nb.felles.partner.askWaiting}</Text>
          )}
        </View>
      ))}
      <Input value={body} onChangeText={setBody} maxLength={ASK_MAX} multiline placeholder={nb.felles.partner.askPh} accessibilityLabel={nb.felles.partner.askTitle} />
      <Button label={nb.felles.partner.askSend} variant="ink" size="sm" block={false} icon="send" disabled={body.trim().length < 5} loading={ask.isPending} onPress={send} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, padding: 18, borderRadius: radius.card, backgroundColor: colors.surface, gap: 10 },
  q: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line2 },
  qHead: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  qText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  answer: { padding: 12, borderRadius: radius.tile, backgroundColor: colors.limeTint, gap: 4 },
  answerBy: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.limeDeep },
});
