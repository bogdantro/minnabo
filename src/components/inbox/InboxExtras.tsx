/**
 * The newer parts of Innboks (0109): «Trenger deg nå», «I morgen», the reply-time tip, the row menu (pin,
 * snooze, mute for a while, quick reply, block, report), quick reply, bulk actions, message search hits,
 * chat settings and the stacked row for several tilbud on one oppdrag.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { AgendaItem, Conversation } from '@/domain/types';
import type { MessageHit } from '@/domain/inbox';
import { useChatSettings, useSetChatSettings } from '@/api/inboxQueries';
import { useSendMessage } from '@/api/queries';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { formatTime, shortDate } from '@/lib/datetime';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { Avatar, Button, Field, Icon, Input, ListGroup, ListRow, Sheet, Toggle, type IconName } from '@/components/ui';
import { DateField } from '@/components/ui/DateField';

const HOUR = 3_600_000;
const tomorrowAt = (h: number) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

// ------------------------------------------------------------
// «Trenger deg nå»: tilbud to answer, endringer, vurderinger
// ------------------------------------------------------------
export function ActionTray({
  offers,
  changes,
  reviews,
  onOffers,
  onChanges,
  onReviews,
}: {
  offers: number;
  changes: number;
  reviews: number;
  onOffers: () => void;
  onChanges: () => void;
  onReviews: () => void;
}) {
  type Item = { key: string; n: number; label: string; icon: IconName; bg: string; fg: string; onPress: () => void };
  const all: Item[] = [
    { key: 'offers', n: offers, label: nb.innboks.tray.offers(offers), icon: 'sparkle', bg: colors.limeTint, fg: colors.limeDeep, onPress: onOffers },
    { key: 'changes', n: changes, label: nb.innboks.tray.changes(changes), icon: 'edit', bg: colors.warnTint, fg: colors.warn, onPress: onChanges },
    { key: 'reviews', n: reviews, label: nb.innboks.tray.reviews(reviews), icon: 'star', bg: colors.cyanTint, fg: colors.cyanDeep, onPress: onReviews },
  ];
  const items = all.filter((i) => i.n > 0);
  if (!items.length) return null;
  return (
    <View style={[styles.px, styles.mt14]} testID="action-tray">
      <Text style={styles.eyebrow}>{nb.innboks.tray.title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayRow}>
        {items.map((i) => (
          <Pressable key={i.key} accessibilityRole="button" accessibilityLabel={i.label} onPress={i.onPress} style={[styles.tray, shadow.card]}>
            <View style={[styles.trayIc, { backgroundColor: i.bg }]}>
              <Icon name={i.icon} size={16} color={i.fg} />
            </View>
            <Text style={styles.trayText}>{i.label}</Text>
            <Icon name="right" size={14} color={colors.faint} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ------------------------------------------------------------
// «I morgen»: the avtaler today and tomorrow
// ------------------------------------------------------------
export function TomorrowStrip({ agenda, names, onOpen }: { agenda: AgendaItem[]; names: Record<string, string>; onOpen: (a: AgendaItem) => void }) {
  const now = new Date();
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const tomorrow = new Date(now.getTime() + 24 * HOUR);
  const soon = agenda
    .filter((a) => !a.cancelled && !a.fullyCompleted && a.scheduledAt && Date.parse(a.scheduledAt) > now.getTime() - 2 * HOUR)
    .filter((a) => [dayKey(now), dayKey(tomorrow)].includes(dayKey(new Date(a.scheduledAt!))))
    .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
  if (!soon.length) return null;
  return (
    <View style={[styles.px, styles.mt14]} testID="tomorrow-strip">
      {soon.map((a) => {
        const today = dayKey(new Date(a.scheduledAt!)) === dayKey(now);
        const name = (names[a.counterpartId] ?? '').split(' ')[0] || 'naboen';
        const line = (a.role === 'CLIENT' ? nb.innboks.tomorrow.itemHelper : nb.innboks.tomorrow.item)(a.listingTitle, name, formatTime(a.scheduledAt!));
        return (
          <Pressable key={a.proposalId} accessibilityRole="link" accessibilityLabel={`${today ? nb.innboks.tomorrow.today : nb.innboks.tomorrow.title}: ${line}`} onPress={() => onOpen(a)} style={styles.tomorrow}>
            <View style={styles.tomorrowTag}>
              <Text style={styles.tomorrowTagText}>{today ? nb.innboks.tomorrow.today : nb.innboks.tomorrow.title}</Text>
            </View>
            <Text style={styles.tomorrowText} numberOfLines={1}>
              {line}
            </Text>
            <Icon name="right" size={14} color={colors.onInk75} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** «Du svarer vanligvis innen 1 time» (getReplyMinutes). */
export function replyTimeText(minutes: number): string {
  if (minutes <= 15) return 'innen et kvarter';
  if (minutes <= 60) return 'innen en time';
  if (minutes <= 180) return 'innen noen timer';
  if (minutes <= 24 * 60) return 'innen et døgn';
  return 'etter mer enn et døgn';
}

// ------------------------------------------------------------
// The row menu
// ------------------------------------------------------------
export function RowMenuSheet({
  c,
  muted,
  onClose,
  onPin,
  onSnooze,
  onMute,
  onReply,
  onBlock,
  onReport,
}: {
  c: Conversation | null;
  muted: boolean;
  onClose: () => void;
  onPin: (c: Conversation, on: boolean) => void;
  onSnooze: (c: Conversation, until: string | null) => void;
  onMute: (c: Conversation, until: string | null | 'always' | 'off') => void;
  onReply: (c: Conversation) => void;
  onBlock: (c: Conversation) => void;
  onReport: (c: Conversation) => void;
}) {
  const t = nb.innboks.menu;
  const [now] = useState(() => Date.now());
  const snoozed = !!c?.snoozedUntil && Date.parse(c.snoozedUntil) > now;
  const mutedNow = muted || (!!c?.mutedUntil && Date.parse(c.mutedUntil) > now);
  return (
    <Sheet visible={!!c} onClose={onClose} title={c?.counterpart.displayName} subtitle={c?.listing.title} scroll>
      {c ? (
        <View style={styles.gap14}>
          <ListGroup>
            <ListRow icon="reply" title={t.reply} onPress={() => onReply(c)} />
            <ListRow icon="pinned" title={c.pinnedAt ? t.unpin : t.pin} onPress={() => onPin(c, !c.pinnedAt)} />
          </ListGroup>
          <Text style={styles.eyebrow}>{t.snooze}</Text>
          <View style={styles.chips}>
            {snoozed ? (
              <Chip label={t.unsnooze} onPress={() => onSnooze(c, null)} />
            ) : (
              <>
                <Chip label={t.snoozeOptions.hour} onPress={() => onSnooze(c, new Date(Date.now() + HOUR).toISOString())} />
                <Chip label={t.snoozeOptions.tomorrow} onPress={() => onSnooze(c, tomorrowAt(8))} />
                <Chip label={t.snoozeOptions.week} onPress={() => onSnooze(c, new Date(Date.now() + 7 * 24 * HOUR).toISOString())} />
              </>
            )}
          </View>
          <Text style={styles.eyebrow}>{t.mute}</Text>
          <View style={styles.chips}>
            {mutedNow ? (
              <Chip label={t.unmute} onPress={() => onMute(c, 'off')} />
            ) : (
              <>
                <Chip label={t.muteOptions.hour} onPress={() => onMute(c, new Date(Date.now() + HOUR).toISOString())} />
                <Chip label={t.muteOptions.tomorrow} onPress={() => onMute(c, tomorrowAt(8))} />
                <Chip label={t.muteOptions.always} onPress={() => onMute(c, 'always')} />
              </>
            )}
          </View>
          <ListGroup>
            <ListRow icon="flag" title={t.report} onPress={() => onReport(c)} />
            <ListRow icon="ban" iconBg={colors.dangerTint} iconColor={colors.danger} title={t.block} onPress={() => onBlock(c)} />
          </ListGroup>
        </View>
      ) : null}
    </Sheet>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

// ------------------------------------------------------------
// Quick reply from the row
// ------------------------------------------------------------
export function QuickReplySheet({ c, meId, onClose }: { c: Conversation | null; meId: string; onClose: () => void }) {
  const [value, setValue] = useState('');
  const send = useSendMessage(c?.id ?? '', meId);
  const first = c?.counterpart.displayName.split(' ')[0] ?? '';
  const submit = () => {
    const t = value.trim();
    if (!t || !c) return;
    send.mutate(t, {
      onSuccess: () => {
        haptics.success();
        toast.success(nb.innboks.quick.sent);
        setValue('');
        onClose();
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
    });
  };
  return (
    <Sheet
      visible={!!c}
      onClose={onClose}
      title={nb.innboks.quick.title(first)}
      subtitle={c?.lastMessagePreview}
      footer={<Button label={nb.innboks.quick.send} variant="lime" icon="send" disabled={!value.trim()} loading={send.isPending} onPress={submit} />}
    >
      <Input value={value} onChangeText={setValue} multiline autoFocus placeholder={nb.innboks.quick.ph} accessibilityLabel={nb.innboks.quick.ph} />
    </Sheet>
  );
}

// ------------------------------------------------------------
// Bulk actions
// ------------------------------------------------------------
export function BulkBar({ count, onRead, onArchive, onMute, onDone }: { count: number; onRead: () => void; onArchive: () => void; onMute: () => void; onDone: () => void }) {
  return (
    <View style={[styles.bulk, shadow.medium]} testID="bulk-bar">
      <Text style={styles.bulkCount}>{nb.innboks.bulk.count(count)}</Text>
      <BulkBtn icon="checks" label={nb.innboks.bulk.read} disabled={!count} onPress={onRead} />
      <BulkBtn icon="bell" label={nb.innboks.bulk.mute} disabled={!count} onPress={onMute} />
      <BulkBtn icon="archive" label={nb.innboks.bulk.archive} disabled={!count} onPress={onArchive} />
      <Pressable accessibilityRole="button" onPress={onDone} style={styles.bulkDone}>
        <Text style={styles.bulkDoneText}>{nb.innboks.bulk.done}</Text>
      </Pressable>
    </View>
  );
}

function BulkBtn({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.bulkBtn, disabled && styles.dim]}>
      <Icon name={icon} size={18} color={colors.white} />
    </Pressable>
  );
}

// ------------------------------------------------------------
// Message search hits, the word marked
// ------------------------------------------------------------
export function Highlighted({ value, needle, style }: { value: string; needle: string; style?: object }) {
  const i = needle ? value.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (i < 0) return <Text style={style} numberOfLines={2}>{value}</Text>;
  // start a little before the hit, so the word is visible in a long message
  const from = Math.max(0, i - 30);
  const pre = (from > 0 ? '…' : '') + value.slice(from, i);
  return (
    <Text style={style} numberOfLines={2}>
      {pre}
      <Text style={styles.mark}>{value.slice(i, i + needle.length)}</Text>
      {value.slice(i + needle.length)}
    </Text>
  );
}

export function MessageHits({ hits, needle, convs, onOpen }: { hits: MessageHit[]; needle: string; convs: Conversation[]; onOpen: (h: MessageHit) => void }) {
  const known = hits.filter((h) => convs.some((c) => c.id === h.conversationId));
  if (!known.length) return null;
  return (
    <View style={[styles.px, styles.mt14]} testID="message-hits">
      <Text style={styles.eyebrow}>{`${nb.innboks.search.messages} · ${known.length}`}</Text>
      <View style={[styles.hits, shadow.card]}>
        {known.slice(0, 12).map((h, i) => {
          const c = convs.find((x) => x.id === h.conversationId)!;
          const who = h.authorId === c.counterpart.id ? c.counterpart.displayName.split(' ')[0] : 'Du';
          return (
            <Pressable
              key={h.messageId}
              accessibilityRole="link"
              accessibilityLabel={nb.innboks.search.hitA11y(who, h.text)}
              onPress={() => onOpen(h)}
              style={[styles.hit, i > 0 && styles.hitLine]}
            >
              <Avatar initials={c.counterpart.initials} uri={c.counterpart.avatarUrl} seed={c.counterpart.id} size={36} ring={false} />
              <View style={styles.flex}>
                <View style={styles.hitTop}>
                  <Text style={styles.hitName} numberOfLines={1}>
                    {c.counterpart.displayName}
                  </Text>
                  <Text style={styles.hitWhen}>{shortDate(h.createdAt)}</Text>
                </View>
                <Highlighted value={`${h.kind === 'AUDIO' ? nb.innboks.search.voice : ''}${who}: ${h.text}`} needle={needle} style={styles.hitText} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ------------------------------------------------------------
// Several tilbud on one oppdrag: one stacked row
// ------------------------------------------------------------
export function GroupRow({ title, convs, open, onToggle, onCompare }: { title: string; convs: Conversation[]; open: boolean; onToggle: () => void; onCompare: () => void }) {
  const unread = convs.filter((c) => c.unread).length;
  return (
    <View style={styles.group}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={nb.innboks.group.a11y(title, convs.length)} onPress={onToggle} style={styles.groupHead}>
        <View style={styles.stack}>
          {convs.slice(0, 3).map((c, i) => (
            <View key={c.id} style={[styles.stackFace, { left: i * 14, zIndex: 3 - i }]}>
              <Avatar initials={c.counterpart.initials} uri={c.counterpart.avatarUrl} seed={c.counterpart.id} size={38} ring={false} />
            </View>
          ))}
        </View>
        <View style={styles.flex}>
          <Text style={styles.groupTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={text.meta}>{nb.innboks.group.count(convs.length)}</Text>
        </View>
        {unread ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread}</Text>
          </View>
        ) : null}
        <Icon name={open ? 'up' : 'down'} size={18} color={colors.ink2} />
      </Pressable>
      {open ? (
        <Pressable accessibilityRole="link" onPress={onCompare} style={styles.compare}>
          <Icon name="list" size={15} color={colors.ink} />
          <Text style={styles.compareText}>{nb.innboks.group.compare}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------
// Chat settings: away, receipts, online, auto-archive
// ------------------------------------------------------------
export function ChatSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const settings = useChatSettings(visible).data;
  const set = useSetChatSettings();
  const [day, setDay] = useState<Date | null>(null);
  const [message, setMessage] = useState('');
  const t = nb.innboks.settings;
  const save = (patch: Parameters<typeof set.mutate>[0], toastText = t.saved) =>
    set.mutate(patch, { onSuccess: () => toast.success(toastText), onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)) });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const awayOn = !!settings?.awayUntil && settings.awayUntil >= iso(new Date());
  return (
    <Sheet visible={visible} onClose={onClose} title={t.title} titleSize="h2" scroll heightRatio={0.9}>
      {settings ? (
        <View style={styles.gap14}>
          <View style={[styles.setCard, awayOn && styles.setCardOn]}>
            <View style={styles.setHead}>
              <Icon name="sun" size={18} color={colors.warn} />
              <View style={styles.flex}>
                <Text style={styles.setTitle}>{t.away}</Text>
                <Text style={text.meta}>{awayOn ? t.awayOn(new Date(settings.awayUntil!).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })) : t.awaySub}</Text>
              </View>
            </View>
            {awayOn ? (
              <Button label={t.awayOff} variant="ghost" size="sm" block={false} onPress={() => save({ clearAway: true })} />
            ) : (
              <>
                <DateField label={t.awayUntil} value={day} onChange={setDay} minToday />
                <Field label={t.awayMessage}>
                  <Input value={message} onChangeText={setMessage} maxLength={300} multiline placeholder={t.awayMessagePh} accessibilityLabel={t.awayMessage} />
                </Field>
                <Button label={t.awaySave} variant="lime" size="sm" block={false} disabled={!day} onPress={() => {
                    if (day) save({ awayUntil: iso(day), awayMessage: message });
                  }} />
              </>
            )}
          </View>
          <SettingRow title={t.receipts} sub={t.receiptsSub} value={settings.readReceipts} onChange={(v) => save({ readReceipts: v })} />
          <SettingRow title={t.online} sub={t.onlineSub} value={!settings.hideOnline} onChange={(v) => save({ hideOnline: !v })} />
          <SettingRow title={t.archive} sub={t.archiveSub} value={settings.autoArchive} onChange={(v) => save({ autoArchive: v })} />
        </View>
      ) : null}
    </Sheet>
  );
}

function SettingRow({ title, sub, value, onChange }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.setRow}>
      <View style={styles.flex}>
        <Text style={styles.setTitle}>{title}</Text>
        <Text style={text.meta}>{sub}</Text>
      </View>
      <Toggle value={value} onValueChange={onChange} accessibilityLabel={title} />
    </View>
  );
}

/** Opens the place that needs me: tilbud → Mottatte tilbud, a review → Vurder. */
export const openTray = {
  offers: () => safePush('/tilbud'),
  review: (proposalId: string) => safePush(`/vurder/${proposalId}`),
};

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  mt14: { marginTop: 14 },
  flex: { flex: 1, minWidth: 0 },
  gap14: { gap: 14 },
  dim: { opacity: 0.4 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 12.5, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.mute, marginBottom: 8 },
  trayRow: { gap: 10, paddingRight: screenPadding },
  tray: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingLeft: 8, paddingRight: 14, borderRadius: radius.pill, backgroundColor: colors.surface },
  trayIc: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  trayText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  tomorrow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, marginBottom: 8, borderRadius: radius.tile, backgroundColor: colors.ink },
  tomorrowTag: { paddingHorizontal: 8, height: 24, borderRadius: radius.pill, backgroundColor: colors.lime, justifyContent: 'center' },
  tomorrowTagText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  tomorrowText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.surface2, justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  bulk: { position: 'absolute', left: screenPadding, right: screenPadding, bottom: 110, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, paddingLeft: 16, borderRadius: radius.pill, backgroundColor: colors.ink },
  bulkCount: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  bulkBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.onInk08, alignItems: 'center', justifyContent: 'center' },
  bulkDone: { height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.lime, justifyContent: 'center' },
  bulkDoneText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  mark: { backgroundColor: colors.limeTint, fontFamily: fonts.bodyBold, color: colors.ink },
  hits: { borderRadius: radius.listingCard, backgroundColor: colors.white, overflow: 'hidden' },
  hit: { flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center' },
  hitLine: { borderTopWidth: 1, borderTopColor: colors.line2 },
  hitTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  hitName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },
  hitWhen: { fontFamily: fonts.body, fontSize: 12, color: colors.faint },
  hitText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18, color: colors.ink2 },
  group: { backgroundColor: colors.white },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 72 },
  stack: { width: 66, height: 40 },
  stackFace: { position: 'absolute', top: 0, borderRadius: 21, borderWidth: 2, borderColor: colors.white },
  groupTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.ink },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.ink },
  compare: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginBottom: 10, height: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.limeTint, alignSelf: 'flex-start' },
  compareText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  setCard: { padding: 14, borderRadius: radius.card, backgroundColor: colors.surface2, gap: 10 },
  setCardOn: { backgroundColor: colors.warnTint },
  setHead: { flexDirection: 'row', gap: 10 },
  setTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.surface2 },
});
