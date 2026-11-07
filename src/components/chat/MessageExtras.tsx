import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import type { Message } from '@/domain/types';
import { isOwnLink, scamSignals, shareWarning, splitMessage, type ScamSignal, type ShareWarning } from '@/domain/chatSafety';
import nb from '@/i18n/nb';
import { confirm } from '@/lib/confirm';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, radius, text } from '@/theme/theme';
import { Button, Icon, ListGroup, ListRow, ScaleIn, Sheet } from '@/components/ui';
import { Image } from '@/components/ui/Image';

/** Your own message can be deleted this long (0089 checks it again on the server). */
export const DELETE_WINDOW_MS = 10 * 60 * 1000;
/** How far a bubble must be dragged before it counts as «Svar». */
const SWIPE_REPLY_AT = 56;
const SWIPE_MAX = 76;

/** One line about a message: for the quote, the reply bar and the pin. */
export function messagePreview(m: Message): string {
  if (m.deletedAt) return nb.chat.deleted;
  if (m.kind === 'IMAGE') return `📷 ${nb.chat.image}`;
  if (m.kind === 'AUDIO') return `🎤 ${nb.chat.voiceMessage}`;
  return m.text;
}

async function openLink(url: string) {
  if (!isOwnLink(url)) {
    const ok = await confirm({ title: nb.chat.linkTitle, message: nb.chat.linkBody(url), confirmLabel: nb.chat.linkOpen, cancelLabel: nb.common.cancel });
    if (!ok) return;
  }
  Linking.openURL(url).catch(() => toast.error(nb.chat.linkFailed));
}

/** Message text with tappable links and phone numbers. A plain message stays one plain Text. */
export function RichText({ value, mine }: { value: string; mine: boolean }) {
  const parts = useMemo(() => splitMessage(value), [value]);
  const base: TextStyle = { color: mine ? colors.white : colors.ink };
  if (parts.length <= 1 && parts[0]?.kind !== 'link' && parts[0]?.kind !== 'phone') return <Text style={[text.bubble, base]}>{value}</Text>;
  const linkStyle = [styles.link, { color: mine ? colors.lime : colors.cyanDeep }];
  return (
    <Text style={[text.bubble, base]}>
      {parts.map((p, i) =>
        p.kind === 'text' ? (
          p.text
        ) : p.kind === 'link' ? (
          <Text key={i} accessibilityRole="link" style={linkStyle} onPress={() => void openLink(p.url)}>
            {p.text}
          </Text>
        ) : (
          <Text key={i} accessibilityRole="link" accessibilityLabel={nb.chat.callNumber(p.text)} style={linkStyle} onPress={() => void Linking.openURL(`tel:${p.tel}`)}>
            {p.text}
          </Text>
        ),
      )}
    </Text>
  );
}

/** The message a reply answers, at the top of the bubble. */
export function QuotedMessage({ name, preview, mine }: { name: string; preview: string; mine: boolean }) {
  return (
    <View style={[styles.quote, mine ? styles.quoteMine : styles.quoteTheirs]}>
      <Text style={[styles.quoteName, { color: mine ? colors.lime : colors.cyanDeep }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.quoteText, { color: mine ? colors.onInk78 : colors.ink2 }]} numberOfLines={2}>
        {preview}
      </Text>
    </View>
  );
}

const SCAM_TEXT: Record<ScamSignal, string> = {
  MONEY: nb.chat.warnMoney,
  ACCOUNT: nb.chat.warnAccount,
  CODES: nb.chat.warnCodes,
  LINK: nb.chat.warnLink,
};

/** Under a message from the other person that looks like a known trick. Never hides the message. */
export function ScamWarning({ m, hasAgreement }: { m: Message; hasAgreement: boolean }) {
  const signal = scamSignals(m.text, hasAgreement)[0];
  if (!signal) return null;
  return (
    <ScaleIn>
      <Pressable accessibilityRole="link" onPress={() => safePush('/sikkerhet')} style={styles.warn}>
        <Icon name="shield" size={15} color={colors.warn} />
        <Text style={styles.warnText}>{SCAM_TEXT[signal]}</Text>
      </Pressable>
    </ScaleIn>
  );
}

const SHARE_TEXT: Record<ShareWarning, string> = { ADDRESS: nb.chat.warnAddress, PHONE: nb.chat.warnPhone };

/** Above the text field while typing an address or a number before there is an avtale. */
export function ShareHint({ draft, hasAgreement }: { draft: string; hasAgreement: boolean }) {
  const w = shareWarning(draft, hasAgreement);
  if (!w) return null;
  return (
    <ScaleIn>
      <View style={styles.shareHint} accessibilityRole="alert">
        <Icon name="shield" size={15} color={colors.warn} />
        <Text style={styles.warnText}>{SHARE_TEXT[w]}</Text>
      </View>
    </ScaleIn>
  );
}

/** «Svarer Kari» above the text field. */
export function ReplyBar({ name, preview, onCancel }: { name: string; preview: string; onCancel: () => void }) {
  return (
    <ScaleIn style={styles.replyBar}>
      <Icon name="reply" size={16} color={colors.cyanDeep} />
      <View style={styles.flex}>
        <Text style={[styles.quoteName, { color: colors.cyanDeep }]} numberOfLines={1}>
          {nb.chat.replyingTo(name)}
        </Text>
        <Text style={[text.meta, styles.replyText]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={nb.chat.replyCancel} onPress={onCancel} hitSlop={10} style={styles.replyX}>
        <Icon name="x" size={16} color={colors.ink2} />
      </Pressable>
    </ScaleIn>
  );
}

/**
 * Drag a bubble sideways to answer it. The gesture only starts on a clear sideways drag, so
 * scrolling the chat and tapping a bubble work as before.
 */
export function SwipeToReply({ enabled, onReply, children }: { enabled: boolean; onReply: () => void; children: React.ReactNode }) {
  const x = useSharedValue(0);
  const fire = () => {
    haptics.light();
    onReply();
  };
  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-1000, 16])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      x.set(Math.max(0, Math.min(SWIPE_MAX, e.translationX * 0.7)));
    })
    .onEnd(() => {
      if (x.get() >= SWIPE_REPLY_AT) runOnJS(fire)();
      x.set(withSpring(0, { damping: 18, stiffness: 220 }));
    });
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [12, SWIPE_REPLY_AT], [0, 1]),
    transform: [{ scale: interpolate(x.get(), [12, SWIPE_REPLY_AT], [0.6, 1]) }],
  }));
  return (
    <View>
      <Animated.View style={[styles.swipeIcon, iconStyle]} pointerEvents="none">
        <Icon name="reply" size={16} color={colors.cyanDeep} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

/** A voice message written out. Only shown when MinNabo has switched the service on. */
export function TranscriptLine({
  m,
  mine,
  enabled,
  loading,
  onAsk,
}: {
  m: Message;
  mine: boolean;
  enabled: boolean;
  loading: boolean;
  onAsk: () => void;
}) {
  if (m.transcript) {
    return <Text style={[styles.transcript, { color: mine ? colors.onInk78 : colors.ink2 }]}>{m.transcript}</Text>;
  }
  if (!enabled || m.pending) return null;
  return (
    <Pressable accessibilityRole="button" disabled={loading} onPress={onAsk} hitSlop={8} style={styles.askText}>
      <Icon name="file" size={13} color={mine ? colors.lime : colors.cyanDeep} />
      <Text style={[styles.askLabel, { color: mine ? colors.lime : colors.cyanDeep }]}>{loading ? nb.chat.transcribing : nb.chat.showAsText}</Text>
    </Pressable>
  );
}

type ActionProps = {
  message: Message | null;
  mine: boolean;
  onClose: () => void;
  onReply: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
};

/** Hold a message: Svar, Kopier, Fest, Slett. */
export function MessageActionsSheet({ message, mine, onClose, onReply, onTogglePin, onDelete }: ActionProps) {
  const m = message;
  const canCopy = !!m && m.kind === 'TEXT' && !m.deletedAt;
  // the sheet opens fresh for every message, so one check of the clock per message is enough
  const canDelete = useMemo(
    () => !!m && mine && !m.deletedAt && !m.pending && new Date().getTime() - Date.parse(m.createdAt) < DELETE_WINDOW_MS,
    [m, mine],
  );
  const copy = async () => {
    if (!m) return;
    await Clipboard.setStringAsync(m.text);
    haptics.light();
    onClose();
    toast.success(nb.chat.copied, { icon: 'copy', bottom: 150 });
  };
  return (
    <Sheet visible={!!m} onClose={onClose} title={nb.chat.messageActions}>
      <ListGroup>
        <ListRow icon="reply" title={nb.chat.reply} onPress={onReply} />
        {canCopy ? <ListRow icon="copy" title={nb.chat.copy} onPress={() => void copy()} /> : null}
        <ListRow icon="pinned" title={m?.pinned ? nb.chat.unpinMessage : nb.chat.pinMessage} onPress={onTogglePin} />
        {canDelete ? <ListRow icon="trash" title={nb.chat.deleteMessage} subtitle={nb.chat.deleteMessageSub} onPress={onDelete} /> : null}
      </ListGroup>
    </Sheet>
  );
}

/** Every photo in the conversation, newest first. */
export function PhotosSheet({ visible, photos, onClose, onOpen }: { visible: boolean; photos: Message[]; onClose: () => void; onOpen: (uri: string) => void }) {
  const newest = useMemo(() => [...photos].reverse(), [photos]);
  return (
    <Sheet visible={visible} onClose={onClose} title={nb.chat.photosTitle} scroll>
      {newest.length ? (
        <ScrollView scrollEnabled={false} contentContainerStyle={styles.grid}>
          {newest.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={nb.chat.imageA11y}
              onPress={() => onOpen(m.attachmentUrl!)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              <Image source={{ uri: m.attachmentUrl }} style={styles.tileImg} accessibilityIgnoresInvertColors />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.none}>
          <View style={styles.noneIcon}>
            <Icon name="image" size={24} color={colors.cyanDeep} />
          </View>
          <Text style={[text.label, styles.center]}>{nb.chat.photosEmpty}</Text>
          <Text style={[text.meta, styles.center]}>{nb.chat.photosEmptySub}</Text>
          <Button label={nb.common.close} variant="ghost" size="sm" block={false} align="center" onPress={onClose} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.8 },
  link: { textDecorationLine: 'underline' },
  quote: { borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 2, marginBottom: 7, gap: 1 },
  quoteMine: { borderLeftColor: colors.lime },
  quoteTheirs: { borderLeftColor: colors.cyan },
  quoteName: { fontFamily: text.label.fontFamily, fontSize: 12 },
  quoteText: { fontFamily: text.body.fontFamily, fontSize: 13, lineHeight: 17 },
  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: radius.m,
    backgroundColor: colors.warnTint,
  },
  warnText: { flex: 1, fontFamily: text.bodySemi.fontFamily, fontSize: 12.5, lineHeight: 17, color: colors.warn },
  shareHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: radius.m,
    backgroundColor: colors.warnTint,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: radius.m,
    backgroundColor: colors.cyanTint,
  },
  replyText: { color: colors.ink2 },
  replyX: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  swipeIcon: {
    position: 'absolute',
    left: 2,
    top: 0,
    bottom: 0,
    width: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transcript: { fontFamily: text.body.fontFamily, fontSize: 13.5, lineHeight: 19, marginTop: 8 },
  askText: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  askLabel: { fontFamily: text.label.fontFamily, fontSize: 12.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { width: '32%', aspectRatio: 1, borderRadius: radius.m, overflow: 'hidden', backgroundColor: colors.line2 },
  tileImg: { width: '100%', height: '100%' },
  none: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  noneIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
