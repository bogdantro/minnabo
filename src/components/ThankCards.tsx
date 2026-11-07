import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ThankCard, ThankCardKind } from '@/domain/types';
import { useProfile, useSendThankCard, useThankCards } from '@/api/queries';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import nb from '@/i18n/nb';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Button, FadeUp, Icon, Input, ScaleIn, type IconKey } from '@/components/ui';

const MESSAGE_MAX = 200;
/** On the profile: the newest, the rest is a number. */
const SHOWN = 3;

const CARDS: { id: ThankCardKind; icon: IconKey; bg: string; fg: string }[] = [
  { id: 'KIND', icon: 'heart', bg: colors.savedBg, fg: colors.heart },
  { id: 'SAVED', icon: 'star', bg: colors.warnTint, fg: colors.warn },
  { id: 'STRONG', icon: 'zap', bg: colors.limeTint, fg: colors.limeDeep },
  { id: 'PRECISE', icon: 'clock', bg: colors.cyanTint, fg: colors.cyanDeep },
  { id: 'TIDY', icon: 'sparkle', bg: colors.lavenderTint, fg: colors.lavender },
];
const cardOf = (k: ThankCardKind) => CARDS.find((c) => c.id === k) ?? CARDS[0];

/** After a finished job: pick a card, add a line, send. */
export function ThankCardPicker({ proposalId, toProfileId, first }: { proposalId: string; toProfileId: string; first: string }) {
  const send = useSendThankCard(toProfileId);
  const [pick, setPick] = useState<ThankCardKind | null>(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <ScaleIn>
        <View style={[styles.box, styles.done, shadow.card]}>
          <Icon name="check" size={18} color={colors.okText} />
          <Text style={[text.label, styles.flex, { color: colors.okText }]}>{nb.thanks.sent(first)}</Text>
        </View>
      </ScaleIn>
    );
  }
  const submit = () => {
    if (!pick) return;
    send.mutate(
      { proposalId, card: pick, message: message.trim() || undefined },
      {
        onSuccess: () => {
          haptics.success();
          setSent(true);
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 170 }),
      },
    );
  };
  return (
    <View style={[styles.box, shadow.card]}>
      <Text style={[text.label, styles.title]}>{nb.thanks.title(first)}</Text>
      <Text style={text.meta}>{nb.thanks.sub}</Text>
      <View style={styles.grid}>
        {CARDS.map((c) => {
          const on = pick === c.id;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={nb.thanks.cards[c.id]}
              onPress={() => {
                haptics.select();
                setPick(c.id);
              }}
              style={[styles.card, { backgroundColor: c.bg }, on && styles.cardOn]}
            >
              <Icon name={c.icon} size={20} color={c.fg} />
              <Text style={[styles.cardText, { color: c.fg }]}>{nb.thanks.cards[c.id]}</Text>
            </Pressable>
          );
        })}
      </View>
      {pick ? (
        <FadeUp style={styles.more}>
          <Input
            value={message}
            onChangeText={(v) => setMessage(v.slice(0, MESSAGE_MAX))}
            placeholder={nb.thanks.messagePh}
            multiline
            accessibilityLabel={nb.thanks.messageLabel}
          />
          <Button label={nb.thanks.send} icon="send" variant="ink" size="sm" loading={send.isPending} onPress={submit} />
        </FadeUp>
      ) : null}
    </View>
  );
}

function ThankRow({ card }: { card: ThankCard }) {
  const from = useProfile(card.fromProfileId).data;
  const c = cardOf(card.card);
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: c.bg }]}>
        <Icon name={c.icon} size={18} color={c.fg} />
      </View>
      <View style={styles.flex}>
        <Text style={text.label}>{nb.thanks.cards[card.card]}</Text>
        {card.message ? <Text style={[text.body, styles.msg]}>{`«${card.message}»`}</Text> : null}
        <Text style={text.meta}>{(from?.displayName ?? '').split(' ')[0] || nb.questions.neighbour}</Text>
      </View>
    </View>
  );
}

/** «Takk fra naboer» on a profile. Nothing at all until there is a card. */
export function ProfileThanks({ profileId, style }: { profileId: string; style?: StyleProp<ViewStyle> }) {
  const cards = useThankCards(profileId).data ?? [];
  if (!cards.length) return null;
  const rest = cards.length - SHOWN;
  return (
    <View style={[styles.box, shadow.card, style]}>
      <Text style={[text.label, styles.title]}>{nb.thanks.profileTitle(cards.length)}</Text>
      {cards.slice(0, SHOWN).map((c) => (
        <ThankRow key={c.id} card={c} />
      ))}
      {rest > 0 ? <Text style={text.meta}>{nb.thanks.more(rest)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  box: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 10 },
  done: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.okTint },
  title: { fontSize: 15.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  card: { flexGrow: 1, flexBasis: '46%', minHeight: 72, borderRadius: radius.m, padding: 12, gap: 6, borderWidth: 2, borderColor: 'transparent' },
  cardOn: { borderColor: colors.ink },
  cardText: { fontFamily: text.label.fontFamily, fontSize: 13.5 },
  more: { gap: 10, marginTop: 2 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  msg: { marginVertical: 2 },
});
