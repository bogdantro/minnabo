import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FileBubble, ListingLinkCard, VideoBubble, sharedListingId } from './ChatPlus';
import { Image } from '@/components/ui/Image';
import type { Message } from '@/domain/types';
import nb from '@/i18n/nb';
import { formatTime } from '@/lib/datetime';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Avatar, Button, FadeUp, Icon, ScaleIn, type IconKey } from '@/components/ui';
import { REACTIONS, reactionChips } from '@/domain/reactions';
import { haptics } from '@/lib/haptics';
import { VoiceBubble } from './Voice';
import { LinkPreviewCard, QuotedMessage, RichText, ScamWarning, SwipeToReply, TranscriptLine, TranslateLine } from './MessageExtras';

/* ---------- time proposals (sent as text with a marker) ---------- */

const TIME_PREFIXES = [nb.chat.timePrefix, `📅 ${nb.chat.timeSuggestion}: `];
export function parseTimeProposal(m: Message): string | null {
  if (m.kind !== 'TEXT') return null;
  const p = TIME_PREFIXES.find((x) => m.text.startsWith(x));
  return p ? m.text.slice(p.length).trim() : null;
}
export type TimeAnswer = 'ok' | 'other' | null;
/** The answer to a time proposal = the first later reply from the other party. */
export function timeAnswer(list: Message[], index: number): TimeAnswer {
  const author = list[index].authorProfileId;
  for (let i = index + 1; i < list.length; i++) {
    const m = list[i];
    if (m.authorProfileId === author || m.kind !== 'TEXT') continue;
    if (m.text.startsWith('✓ Tidspunktet passer')) return 'ok';
    if (m.text.startsWith('↻')) return 'other';
  }
  return null;
}

export function DateChip({ label }: { label: string }) {
  return (
    <View style={styles.dwrap}>
      <Text style={styles.dchip}>{label}</Text>
    </View>
  );
}

export function SysPill({ textValue }: { textValue: string }) {
  return (
    <ScaleIn style={styles.swrap}>
      <View style={styles.sys} accessibilityRole="text">
        <View style={styles.sysIc}>
          <Icon name={textValue.startsWith('Avtalen er avlyst') ? 'ban' : 'check'} size={14} color={colors.white} />
        </View>
        <Text style={text.system}>{textValue}</Text>
      </View>
    </ScaleIn>
  );
}

type RowProps = {
  m: Message;
  mine: boolean;
  meId: string;
  showAvatar: boolean;
  firstOfGroup: boolean;
  avatar: { initials: string; uri?: string; seed: string };
  pinned: boolean;
  selected: boolean;
  /** "Sendt" / "Levert" / "Lest" under the last own message. */
  statusText?: string;
  onSelect: () => void;
  onReact: (emoji: string) => void;
  /** the × in the reaction bar */
  onCloseReactions: () => void;
  onLongPress: () => void;
  onRetry: () => void;
  /** the message this one answers */
  quoted?: { name: string; preview: string };
  /** the warnings about money and links only apply before an avtale */
  hasAgreement: boolean;
  onReply: () => void;
  transcriptsEnabled: boolean;
  transcribing: boolean;
  onTranscribe: () => void;
  /** «Vis på norsk» (0101) */
  translateEnabled: boolean;
  translating: boolean;
  onTranslate: () => void;
};

/** `.mrow` – bubble with tap → reaction popover, reaction chips, ticks, status line. */
export function MessageRow({
  m,
  mine,
  meId,
  showAvatar,
  firstOfGroup,
  avatar,
  pinned,
  selected,
  statusText,
  onSelect,
  onReact,
  onCloseReactions,
  onLongPress,
  onRetry,
  quoted,
  hasAgreement,
  onReply,
  transcriptsEnabled,
  transcribing,
  onTranscribe,
  translateEnabled,
  translating,
  onTranslate,
}: RowProps) {
  const gone = !!m.deletedAt;
  const isImg = m.kind === 'IMAGE' && !!m.attachmentUrl;
  const isVoice = m.kind === 'AUDIO' && !!m.attachmentUrl;
  // a short video or a PDF rides on a TEXT message (0109)
  const isVideo = m.attachmentKind === 'VIDEO' && !!m.attachmentUrl;
  const isFile = m.attachmentKind === 'FILE' && !!m.attachmentUrl;
  const shared = m.kind === 'TEXT' && !m.attachmentKind ? sharedListingId(m.text) : null;
  const chips = reactionChips(m.reactions, meId);
  const tick: IconKey | null = !mine || m.failed ? null : m.pending ? 'clock' : m.delivery === 'SENT' ? 'check' : 'checks';
  return (
    <SwipeToReply enabled={!gone && !m.pending && !m.failed} onReply={onReply}>
    <View style={[styles.mrow, mine ? styles.me : styles.them, firstOfGroup && styles.gap]}>
      {!mine ? (
        showAvatar ? (
          <Avatar initials={avatar.initials} uri={avatar.uri} seed={avatar.seed} size={28} ring={false} />
        ) : (
          <View style={styles.avsp} />
        )
      ) : null}
      <View style={[styles.mcol, mine && styles.mcolMe]}>
        {selected ? (
          <ScaleIn style={[styles.rpop, mine ? styles.rpopMe : styles.rpopThem, shadow.large]}>
            <View style={styles.rpopRow} accessibilityRole="toolbar" accessibilityLabel={nb.chat.reactGroup}>
              {REACTIONS.map((emoji) => {
                const ids = m.reactions?.[emoji] ?? [];
                const on = ids.includes(meId);
                return (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={nb.reactions.a11y(emoji, ids.length, on)}
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      haptics.light();
                      onReact(emoji);
                    }}
                    style={({ pressed }) => [styles.rbtn, on && styles.rbtnOn, pressed && styles.rbtnPressed]}
                  >
                    <Text style={styles.rbtnEmoji}>{emoji}</Text>
                    {ids.length ? <Text style={[styles.rbtnN, on && styles.rbtnNOn]}>{ids.length}</Text> : null}
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={nb.chat.reactClose}
                onPress={onCloseReactions}
                hitSlop={4}
                style={({ pressed }) => [styles.rbtn, styles.rclose, pressed && styles.pressed]}
              >
                <Icon name="x" size={17} color={colors.ink2} />
              </Pressable>
            </View>
          </ScaleIn>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isImg ? nb.chat.imageA11y : isVoice ? nb.chat.voiceMessage : undefined}
          accessibilityState={{ expanded: selected }}
          onPress={onSelect}
          onLongPress={onLongPress}
          delayLongPress={350}
          style={({ pressed }) => [
            styles.bub,
            mine ? styles.bubOut : styles.bubIn,
            // a run of messages reads as one block (Messenger): only the last one has the tail
            !firstOfGroup && (mine ? styles.joinTopMe : styles.joinTopThem),
            !showAvatar && (mine ? styles.joinBottomMe : styles.joinBottomThem),
            isImg && styles.imgBub,
            selected && shadow.reactSel,
            pressed && styles.pressed,
          ]}
        >
          {pinned ? (
            <View style={styles.pintag}>
              <Icon name="pinned" size={14} color={mine ? colors.lime : colors.limeDeep} />
              <Text style={[styles.pintagText, { color: mine ? colors.lime : colors.limeDeep }]}>{nb.chat.pinnedTag}</Text>
            </View>
          ) : null}
          {quoted && !gone ? <QuotedMessage name={quoted.name} preview={quoted.preview} mine={mine} /> : null}
          {gone ? (
            <View style={styles.goneRow}>
              <Icon name="ban" size={14} color={mine ? colors.onInk72 : colors.faint} />
              <Text style={[styles.goneText, { color: mine ? colors.onInk72 : colors.mute }]}>{nb.chat.deleted}</Text>
            </View>
          ) : isImg ? (
            <Image source={{ uri: m.attachmentUrl }} style={styles.photo} accessibilityIgnoresInvertColors />
          ) : isVoice ? (
            <>
              <VoiceBubble uri={m.attachmentUrl!} ms={m.audioMs ?? 0} mine={mine} />
              <TranscriptLine m={m} mine={mine} enabled={transcriptsEnabled} loading={transcribing} onAsk={onTranscribe} />
            </>
          ) : isVideo ? (
            <VideoBubble uri={m.attachmentUrl!} mine={mine} />
          ) : isFile ? (
            <FileBubble name={m.fileName ?? 'dokument.pdf'} uri={m.attachmentUrl!} mine={mine} />
          ) : (
            <>
              <RichText value={m.text} mine={mine} />
              {shared ? <ListingLinkCard id={shared} mine={mine} /> : m.kind === 'TEXT' ? <LinkPreviewCard textValue={m.text} mine={mine} /> : null}
              {!mine ? <TranslateLine m={m} enabled={translateEnabled} loading={translating} onAsk={onTranslate} /> : null}
            </>
          )}
          <View style={[styles.btime, isImg && styles.btimeImg]}>
            {m.editedAt && !gone ? <Text style={[text.time, mine && !isImg && styles.timeOnDark]}>{`${nb.innboks.chat.edited} ·`}</Text> : null}
            <Text style={[text.time, mine && !isImg && styles.timeOnDark]}>{formatTime(m.createdAt)}</Text>
            {tick ? (
              <Icon name={tick} size={14} color={m.delivery === 'READ' ? (isImg ? colors.cyan : colors.readTick) : mine && !isImg ? colors.onInk72 : colors.faint} />
            ) : null}
          </View>
        </Pressable>
        {!mine && !gone && m.kind === 'TEXT' ? <ScamWarning m={m} hasAgreement={hasAgreement} /> : null}
        {chips.length ? (
          <View style={[styles.rchips, mine ? styles.rchipsMe : styles.rchipsThem]}>
            {chips.map((c) => (
              <ScaleIn key={c.emoji}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={nb.reactions.a11y(c.emoji, c.n, c.on)}
                  accessibilityState={{ selected: c.on }}
                  onPress={() => onReact(c.emoji)}
                  hitSlop={{ top: 9, bottom: 9 }}
                  style={[styles.rchip, shadow.card, c.on && styles.rchipMine]}
                >
                  <Text style={styles.emoji}>{c.emoji}</Text>
                  <Text style={[styles.rchipN, c.on && styles.rchipNMine]}>{c.n}</Text>
                </Pressable>
              </ScaleIn>
            ))}
          </View>
        ) : null}
        {m.failed ? (
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.failed}>
            <Icon name="alert" size={13} color={colors.danger} />
            <Text style={[styles.mstat, { color: colors.danger }]}>{nb.chat.retrySend}</Text>
          </Pressable>
        ) : statusText ? (
          <FadeUp>
            <Text style={[styles.mstat, m.delivery === 'READ' && !m.pending && { color: colors.cyanDeep }]}>{statusText}</Text>
          </FadeUp>
        ) : null}
      </View>
    </View>
    </SwipeToReply>
  );
}

/** `.tcard` – a time proposal; the other party answers with Passer / Foreslå annen. */
export function TimeCard({
  when,
  mine,
  first,
  answer,
  time,
  onYes,
  onNo,
}: {
  when: string;
  mine: boolean;
  first: string;
  answer: TimeAnswer;
  time: string;
  onYes: () => void;
  onNo: () => void;
}) {
  const [day, clock] = when.split(/ (?=kl\. )/);
  return (
    <View style={[styles.mrow, mine ? styles.me : styles.them, styles.gap]}>
      <View style={[styles.tcol, mine && styles.mcolMe]}>
        <View style={[styles.tcard, shadow.card, answer === 'ok' && styles.tcardOk, answer === 'other' && styles.tcardOther, mine ? styles.tailMe : styles.tailThem]}>
          <View style={styles.th}>
            <View style={styles.thIc}>
              <Icon name="cal" size={16} color={colors.cyanDeep} />
            </View>
            <Text style={[text.label, styles.flex]}>{nb.chat.timeCardTitle}</Text>
            <Text style={text.meta}>{mine ? nb.chat.fromYou : nb.chat.fromName(first)}</Text>
          </View>
          <View style={styles.tbig}>
            <Text style={[text.num, styles.f24]}>{day}</Text>
            {clock ? <Text style={styles.tbigSub}>{clock}</Text> : null}
          </View>
          {answer === 'ok' ? (
            <ScaleIn style={[styles.tstate, styles.tstateOk]}>
              <View style={styles.tOkIc}>
                <Icon name="check" size={14} color={colors.white} />
              </View>
              <Text style={[styles.tstateText, { color: colors.okText }]}>{nb.chat.timeOk}</Text>
            </ScaleIn>
          ) : answer === 'other' ? (
            <ScaleIn style={[styles.tstate, styles.tstateOther]}>
              <Icon name="repeat" size={16} color={colors.ink2} />
              <Text style={styles.tstateText}>{nb.chat.timeWantsOther}</Text>
            </ScaleIn>
          ) : !mine ? (
            <View style={styles.tacts}>
              <Button label={nb.chat.timeOther} variant="ghost" size="sm" block={false} onPress={onNo} style={styles.grow} />
              <Button label={nb.chat.timeFits} icon="check" size="sm" block={false} onPress={onYes} style={styles.grow} />
            </View>
          ) : null}
        </View>
        <Text style={styles.mtime}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  pressed: { transform: [{ scale: 0.97 }] },
  f24: { fontSize: 24, lineHeight: 27 },
  dwrap: { alignItems: 'center', marginTop: 14, marginBottom: 8 },
  dchip: {
    height: 26,
    lineHeight: 26,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.dateChipBg,
    fontFamily: text.label.fontFamily,
    fontSize: 12,
    letterSpacing: 0.24,
    color: colors.ink2,
    overflow: 'hidden',
  },
  swrap: { alignItems: 'center', marginTop: 12, marginBottom: 6 },
  sys: {
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
  sysIc: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' },
  mrow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 2 },
  gap: { marginTop: 14 },
  me: { justifyContent: 'flex-end' },
  them: { justifyContent: 'flex-start' },
  avsp: { width: 28 },
  mcol: { maxWidth: '78%', minWidth: 0, alignItems: 'flex-start' },
  mcolMe: { alignItems: 'flex-end' },
  bub: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 20, maxWidth: '100%' },
  bubIn: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line2, borderBottomLeftRadius: 6 },
  bubOut: { backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  joinTopThem: { borderTopLeftRadius: 6 },
  joinTopMe: { borderTopRightRadius: 6 },
  joinBottomThem: { borderBottomLeftRadius: 20 },
  joinBottomMe: { borderBottomRightRadius: 20 },
  imgBub: { padding: 5 },
  goneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goneText: { fontFamily: text.body.fontFamily, fontSize: 14, fontStyle: 'italic' },
  photo: { width: 228, height: 164, borderRadius: 17 },
  btime: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 1 },
  btimeImg: { paddingHorizontal: 8, paddingBottom: 4 },
  timeOnDark: { color: colors.onInk72 },
  pintag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 },
  pintagText: { fontFamily: text.label.fontFamily, fontSize: 11, letterSpacing: 0.22 },
  rpop: { position: 'absolute', bottom: '100%', marginBottom: 6, zIndex: 9, borderRadius: radius.pill },
  rpopMe: { right: 0 },
  rpopThem: { left: 0 },
  rpopRow: {
    flexDirection: 'row',
    gap: 4,
    padding: 5,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  // the Oppslagstavle bar: soft grey pills, mine in lime with the count
  rbtn: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 9,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.bg,
  },
  rbtnOn: { backgroundColor: colors.limeTint, borderColor: colors.limeDeep },
  rbtnEmoji: { fontSize: 20, lineHeight: 24 },
  rbtnN: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink2 },
  rbtnNOn: { color: colors.limeDeep },
  rclose: { backgroundColor: colors.white, borderColor: colors.line },
  rbtnPressed: { transform: [{ scale: 1.25 }] },
  rchips: { flexDirection: 'row', gap: 4, marginTop: -7, zIndex: 2 },
  rchipsMe: { marginRight: 10 },
  rchipsThem: { marginLeft: 10 },
  rchip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rchipMine: { backgroundColor: colors.limeTint, borderColor: colors.limeDeep },
  rchipNMine: { color: colors.limeDeep },
  rchipN: { fontFamily: text.label.fontFamily, fontSize: 12, color: colors.ink2 },
  emoji: { fontSize: 14, lineHeight: 18 },
  mstat: { fontFamily: text.bodySemi.fontFamily, fontSize: 11.5, color: colors.faint, marginTop: 5 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mtime: { fontFamily: text.body.fontFamily, fontSize: 11.5, color: colors.faint, marginTop: 5, paddingHorizontal: 6 },
  tcol: { width: '80%', alignItems: 'flex-start' },
  tcard: { width: '100%', backgroundColor: colors.white, borderRadius: 22, borderWidth: 1.5, borderColor: colors.offerCardBorder, padding: 14 },
  tailMe: { borderBottomRightRadius: 8 },
  tailThem: { borderBottomLeftRadius: 8 },
  tcardOk: { borderColor: colors.okBorder },
  tcardOther: { borderColor: colors.line, opacity: 0.8 },
  th: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thIc: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  tbig: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginVertical: 12 },
  tbigSub: { fontFamily: text.bodySemi.fontFamily, fontSize: 15, color: colors.ink2 },
  tacts: { flexDirection: 'row', gap: 8 },
  tstate: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 13 },
  tstateOk: { backgroundColor: colors.okTint },
  tstateOther: { backgroundColor: colors.neutralPill },
  tstateText: { fontFamily: text.label.fontFamily, fontSize: 13.5, color: colors.ink2 },
  tOkIc: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' },
});
