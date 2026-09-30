import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Pill } from './Pill';

export const PAYMENT_NOTE = 'Pris og betaling avtales direkte mellom dere. MinNabo håndterer ikke betaling.';

/** `.note` + info icon. Must appear near every price / offer (product rule 4). */
export function PaymentNote({ text: body = PAYMENT_NOTE, style }: { text?: string; style?: StyleProp<ViewStyle> }) {
  return <Note icon="info" style={style}>{body}</Note>;
}

/** `.note` – small grey line with a faint 15 px icon. */
export function Note({ icon = 'info', children, style }: { icon?: IconName; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.note, style]}>
      <View style={styles.noteIcon}>
        <Icon name={icon} size={15} color={colors.faint} />
      </View>
      <Text style={[text.note, styles.flex]}>{children}</Text>
    </View>
  );
}

export type BubbleStatus = 'sent' | 'delivered' | 'read';

export type BubbleProps = {
  outgoing: boolean;
  children: ReactNode;
  /** "18:02" or "Jonas · 18:02" */
  time?: string;
  status?: BubbleStatus;
  /** Show time row (only on the last bubble of a group). */
  showMeta?: boolean;
  /** Animate in (new message). */
  animate?: boolean;
};

/** `.bub` – chat bubble; 7 px tail corner, outgoing = ink. Time + ticks underneath. */
export function Bubble({ outgoing, children, time, status, showMeta = true, animate = false }: BubbleProps) {
  const statusIcon: IconName | null = !outgoing || !status ? null : status === 'sent' ? 'check' : 'checks';
  return (
    <Animated.View
      entering={animate ? FadeInDown.duration(350).withInitialValues({ transform: [{ translateY: 10 }] }) : undefined}
      style={[styles.bubCol, outgoing ? styles.alignEnd : styles.alignStart]}
    >
      <View style={[styles.bub, outgoing ? styles.bubOut : styles.bubIn]}>
        {typeof children === 'string' ? (
          <Text style={[text.bubble, { color: outgoing ? colors.white : colors.ink }]}>{children}</Text>
        ) : (
          children
        )}
      </View>
      {showMeta && time ? (
        <View style={styles.btime}>
          <Text style={text.time}>{time}</Text>
          {statusIcon ? (
            <Icon
              name={statusIcon}
              size={14}
              color={status === 'read' ? colors.cyan : colors.faint}
              strokeWidth={2.2}
            />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

/** `.sys` – centred pill for system events ("Tilbud godtatt · 30. sep kl. 19:42"). */
export function SystemMessage({ icon, children }: { icon?: IconName; children: string }) {
  return (
    <View style={styles.sys} accessibilityRole="text">
      {icon ? <Icon name={icon} size={14} color={colors.ink2} /> : null}
      <Text style={text.system}>{children}</Text>
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 360 }),
          withTiming(0, { duration: 360 }),
          withTiming(0, { duration: 480 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(y);
  }, [delay, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.dot, anim]} />;
}

/** `.typing` – three bouncing dots, 1.2 s, staggered 150 ms. */
export function TypingIndicator({ name }: { name?: string }) {
  return (
    <View style={styles.typing} accessible accessibilityLabel={name ? `${name} skriver` : 'Skriver'}>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </View>
  );
}

export type OfferCardState = 'pending' | 'accepted' | 'declined';

export type OfferCardProps = {
  state: OfferCardState;
  /** "fra Jonas Lie · 19:26" */
  fromLine: string;
  /** "1 400 kr" */
  price: string;
  /** Date/time fact, e.g. "Lør 10. okt kl. 10:00". */
  when?: string;
  /** Duration fact, e.g. "ca. 5 t". */
  duration?: string;
  message?: string;
  caveat?: string;
  /** "30. sep kl. 19:42" – shown when accepted. */
  acceptedAt?: string;
  /** Only the recipient (poster) can accept / decline. */
  canRespond: boolean;
  /** Label of the pending pill; recipient sees "Venter på deg", sender "Venter på svar". */
  pendingLabel?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onUndoDecline?: () => void;
  onOpenAgreement?: () => void;
};

/** Inline offer card in chat (Chat.dc.html `.offer`): pending → accepted (locked) / declined. */
export function OfferCard({
  state,
  fromLine,
  price,
  when,
  duration,
  message,
  caveat,
  acceptedAt,
  canRespond,
  pendingLabel,
  onAccept,
  onDecline,
  onUndoDecline,
  onOpenAgreement,
}: OfferCardProps) {
  const acc = state === 'accepted';
  const dec = state === 'declined';
  return (
    <View
      style={[
        styles.offer,
        acc ? [styles.offerAcc, shadow.offerAccepted] : dec ? styles.offerDec : shadow.medium,
      ]}
    >
      <View style={[styles.topBar, { backgroundColor: acc ? colors.ok : dec ? colors.dashed : colors.lime }]} />
      <View style={[styles.oh, acc && { backgroundColor: colors.okTint }, dec && styles.faded]}>
        <View style={[styles.oi, acc && { backgroundColor: colors.ok }, dec && { backgroundColor: colors.offerDeclinedIcon }]}>
          <Icon name={acc ? 'check' : dec ? 'x' : 'tag'} size={18} color={acc || dec ? colors.white : colors.lime} />
        </View>
        <View style={styles.ohl}>
          <Text style={[text.offerTitle, acc && { color: colors.okText }]}>
            {acc ? 'Tilbud godtatt' : dec ? 'Avslått' : 'Tilbud'}
          </Text>
          <Text style={text.small}>{acc ? acceptedAt : dec ? 'Du avslo dette tilbudet' : fromLine}</Text>
        </View>
        {acc ? (
          <Pill label="Låst" tone="ok" icon="lock" />
        ) : !dec ? (
          <Pill label={pendingLabel ?? (canRespond ? 'Venter på deg' : 'Venter på svar')} tone="line" icon="hourglass" />
        ) : null}
      </View>
      <View style={[styles.ob, dec && styles.faded]}>
        <Text style={text.eyebrow}>Pris for jobben</Text>
        <Text style={[text.offerPrice, styles.price]}>{price}</Text>
        {when || duration ? (
          <View style={styles.facts}>
            {when ? (
              <View style={styles.fact}>
                <Icon name="cal" size={16} color={colors.cyanDeep} />
                <Text style={[text.fact, { color: colors.cyanDeep }]}>{when}</Text>
              </View>
            ) : null}
            {duration ? (
              <View style={[styles.fact, { backgroundColor: colors.limeTint }]}>
                <Icon name="clock" size={16} color={colors.limeDeep} />
                <Text style={[text.fact, { color: colors.limeDeep }]}>{duration}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {message ? <Text style={[text.offerDesc, styles.desc]}>«{message}»</Text> : null}
        {caveat ? (
          <View style={styles.forb}>
            <Icon name="alert" size={16} color={colors.caveatText} />
            <Text style={[text.note, styles.flex, { color: colors.caveatText, fontSize: 13 }]}>
              <Text style={{ fontFamily: text.label.fontFamily }}>Forbehold: </Text>
              {caveat}
            </Text>
          </View>
        ) : null}
        <PaymentNote style={styles.noteTop} />
      </View>
      {state === 'pending' && canRespond ? (
        <View style={styles.oa}>
          <Button label="Avslå" variant="ghost" size="sm" onPress={() => onDecline?.()} style={styles.flex} />
          <Button label="Godta tilbud" icon="check" size="sm" onPress={() => onAccept?.()} style={styles.flex15} />
        </View>
      ) : null}
      {acc ? (
        <>
          <View style={styles.lockrow}>
            <View style={styles.lockIcon}>
              <Icon name="lock" size={16} color={colors.white} />
            </View>
            <View style={styles.flex}>
              <Text style={[text.metaBold, { color: colors.okText }]}>Avtalegrunnlaget er låst</Text>
              <Text style={[text.small, { color: colors.okText }]}>Pris, tid og forbehold er lagret i avtalen.</Text>
            </View>
          </View>
          {onOpenAgreement ? (
            <View style={styles.oa}>
              <Button label="Se avtale" variant="ink" size="sm" iconRight="arrow" onPress={onOpenAgreement} />
            </View>
          ) : null}
        </>
      ) : null}
      {dec && canRespond && onUndoDecline ? (
        <View style={styles.oa}>
          <Button label="Angre" variant="ghost" size="sm" icon="undo" onPress={onUndoDecline} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex15: { flex: 1.5 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteIcon: { marginTop: 1 },
  noteTop: { marginTop: 10 },
  bubCol: { maxWidth: '78%' },
  alignStart: { alignSelf: 'flex-start' },
  alignEnd: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bub: { paddingVertical: 11, paddingHorizontal: 15, borderRadius: radius.bubble },
  bubIn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderBottomLeftRadius: radius.bubbleTail,
  },
  bubOut: { backgroundColor: colors.ink, borderBottomRightRadius: radius.bubbleTail },
  btime: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  sys: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  typing: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.bubble,
    borderBottomLeftRadius: radius.bubbleTail,
    alignSelf: 'flex-start',
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.typingDot },
  offer: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.offerCardBorder,
    overflow: 'hidden',
  },
  offerAcc: { borderColor: colors.offerAcceptedBorder },
  offerDec: { borderColor: colors.line },
  topBar: { height: 4 },
  faded: { opacity: 0.55 },
  oh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: colors.offerHeadBg,
  },
  oi: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ohl: { flex: 1, minWidth: 0, gap: 2 },
  ob: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12 },
  price: { marginTop: 6 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 11,
    backgroundColor: colors.cyanTint,
  },
  desc: { marginTop: 12 },
  forb: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.warnTint,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  oa: { flexDirection: 'row', gap: 8, paddingTop: 2, paddingHorizontal: 16, paddingBottom: 16 },
  lockrow: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.okTint,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  lockIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ok,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
