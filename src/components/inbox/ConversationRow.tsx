import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Conversation } from '@/domain/types';
import nb from '@/i18n/nb';
import { daysAgo, formatTime, shortDate } from '@/lib/datetime';
import { colors, fonts, text } from '@/theme/theme';
import { Avatar, Icon, Pill, ScaleIn } from '@/components/ui';
import type { SwipeAction } from '@/components/SwipeRow';

const timeOf = (iso: string) => {
  const d = daysAgo(iso);
  return d <= 0 ? formatTime(iso) : d === 1 ? nb.inbox.groups.yday : shortDate(iso).replace(/^\S+ /, '');
};

/**
 * One conversation in Innboks, like a row in WhatsApp (2026-11-10): the face, the name and time, the job with
 * its status, and the last message with an unread badge. Used by Innboks and by the youth app's Innboks.
 */
export function ConversationRow({
  c,
  unread,
  actions,
  onPress,
  onLongPress,
  extraTag,
  status,
  draft,
  typing,
  muted,
  selecting,
  selected,
}: {
  c: Conversation;
  unread: boolean;
  actions?: SwipeAction[];
  onPress: () => void;
  /** opens the row menu (0109) */
  onLongPress?: () => void;
  /** a tag of the caller's own, e.g. «Spør deg om hjelp» in the youth app */
  extraTag?: { label: string; tone: 'ok' | 'need' | 'warn' | 'dark' };
  /** the avtale's status from Innboks (0109): «Avtale lør 14:00», «Fullført – gi vurdering» */
  status?: { label: string; tone: 'ok' | 'need' | 'warn' | 'dark' };
  /** unsent text from the chat field: «Utkast: …» */
  draft?: string;
  /** the other person is typing right now */
  typing?: boolean;
  muted?: boolean;
  /** «Velg» in Innboks: the row shows a tick circle */
  selecting?: boolean;
  selected?: boolean;
}) {
  const statusTag =
    c.statusTag === 'NEW_OFFER'
      ? { label: nb.inbox.tagNewOffer, tone: 'need' as const, icon: 'sparkle' as const }
      : c.statusTag === 'OFFER_ACCEPTED'
        ? { label: nb.inbox.tagOfferAccepted, tone: 'ok' as const, icon: 'check' as const }
        : c.statusTag === 'REVISION_PENDING'
          ? { label: nb.inbox.tagRevision, tone: 'warn' as const, icon: 'edit' as const }
          : null;
  const tag: { label: string; tone: 'ok' | 'need' | 'warn' | 'dark'; icon?: 'sparkle' | 'check' | 'edit' } | null = extraTag ?? status ?? statusTag;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${c.counterpart.displayName}, ${c.listing.title}${unread ? `, ${nb.inbox.unreadA11y}` : ''}${c.pinnedAt ? `, ${nb.innboks.filters.pinned}` : ''}`}
      accessibilityState={selecting ? { selected: !!selected } : undefined}
      onLongPress={onLongPress}
      // the same choices as the swipe, for people who can't swipe
      accessibilityActions={(actions ?? []).map((a) => ({ name: a.key, label: a.label }))}
      onAccessibilityAction={(e) => actions?.find((a) => a.key === e.nativeEvent.actionName)?.onPress()}
      onPress={onPress}
      style={({ pressed }) => [styles.conv, pressed && styles.convPressed]}
    >
      {selecting ? (
        <View style={[styles.sel, selected && styles.selOn]}>{selected ? <Icon name="check" size={14} color={colors.white} strokeWidth={3} /> : null}</View>
      ) : null}
      <Avatar initials={c.counterpart.initials} uri={c.counterpart.avatarUrl} seed={c.counterpart.id} size={54} online={c.counterpart.online} ring={false} />
      <View style={styles.cb}>
        <View style={styles.top}>
          <Text style={styles.nm} numberOfLines={1}>
            {c.counterpart.displayName}
          </Text>
          {c.pinnedAt ? <Icon name="pinned" size={13} color={colors.limeDeep} /> : null}
          {muted ? <Icon name="bell" size={13} color={colors.faint} /> : null}
          <Text style={[styles.tm, unread && styles.tmUnread]}>{timeOf(c.lastMessageAt)}</Text>
        </View>
        <View style={styles.lst}>
          <View style={styles.td} />
          <Text style={styles.lstText} numberOfLines={1}>
            {c.listing.title}
          </Text>
          {tag ? <Pill label={tag.label} tone={tag.tone} icon={tag.icon} size="sm" style={styles.tag} /> : null}
        </View>
        <View style={styles.msgRow}>
          {/* my last message: one tick = sendt, two = levert, two in colour = lest */}
          {c.lastMessageDelivery ? (
            <View accessible accessibilityLabel={nb.inbox.receipt[c.lastMessageDelivery]} style={styles.tick}>
              <Icon
                name={c.lastMessageDelivery === 'SENT' ? 'check' : 'checks'}
                size={15}
                color={c.lastMessageDelivery === 'READ' ? colors.cyanDeep : colors.faint}
              />
            </View>
          ) : null}
          {typing ? (
            <Text style={[styles.msg, styles.typing]} numberOfLines={1}>
              {nb.innboks.typing}
            </Text>
          ) : draft ? (
            <Text style={styles.msg} numberOfLines={1}>
              <Text style={styles.draft}>{nb.innboks.draft}</Text>
              {draft}
            </Text>
          ) : (
            <Text style={[styles.msg, unread && styles.msgUnread]} numberOfLines={1}>
              {c.lastMessageMine ? nb.inbox.you : ''}
              {c.lastMessagePreview}
            </Text>
          )}
          {unread ? (
            <ScaleIn>
              <View style={styles.bubN}>
                {c.unreadCount ? (
                  <Text style={styles.bubText}>{c.unreadCount > 99 ? '99+' : c.unreadCount}</Text>
                ) : (
                  <View style={styles.bubDot} />
                )}
              </View>
            </ScaleIn>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}


/** The same row for something that isn't a full conversation yet (a youth's sent tilbud): face, name, job, last line. */
export function ThreadRow({
  name,
  initials,
  seed,
  uri,
  title,
  preview,
  tag,
  onPress,
}: {
  name: string;
  initials: string;
  seed: string;
  uri?: string;
  title: string;
  preview: string;
  tag?: { label: string; tone: 'ok' | 'need' | 'warn' | 'dark' };
  onPress?: () => void;
}) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${name}, ${title}`} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.conv, pressed && styles.convPressed]}>
      <Avatar initials={initials} uri={uri} seed={seed} size={54} ring={false} />
      <View style={styles.cb}>
        <Text style={styles.nm} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.lst}>
          <View style={styles.td} />
          <Text style={styles.lstText} numberOfLines={1}>
            {title}
          </Text>
          {tag ? <Pill label={tag.label} tone={tag.tone} size="sm" style={styles.tag} /> : null}
        </View>
        <Text style={styles.msg} numberOfLines={1}>
          {preview}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  conv: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.white },
  convPressed: { backgroundColor: colors.bg },
  cb: { flex: 1, minWidth: 0, gap: 3 },
  top: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  nm: { flex: 1, minWidth: 0, fontFamily: text.label.fontFamily, fontSize: 16, lineHeight: 20, color: colors.ink },
  tm: { fontFamily: text.body.fontFamily, fontSize: 12.5, color: colors.faint },
  tmUnread: { fontFamily: text.label.fontFamily, color: colors.limeDeep },
  lst: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  td: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.limeDot },
  lstText: { flexShrink: 1, fontFamily: text.bodySemi.fontFamily, fontSize: 12.5, lineHeight: 15, color: colors.ink2 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tick: { marginRight: -5 },
  msg: { flex: 1, minWidth: 0, fontFamily: text.body.fontFamily, fontSize: 14, lineHeight: 19, color: colors.mute },
  msgUnread: { fontFamily: text.label.fontFamily, color: colors.ink },
  bubN: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  bubText: { fontFamily: fonts.bodyHeavy, fontSize: 12, lineHeight: 22, color: colors.ink },
  bubDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink },
  tag: { height: 20, marginLeft: 2 },
  typing: { fontFamily: text.label.fontFamily, color: colors.limeDeep },
  draft: { fontFamily: text.label.fontFamily, color: colors.danger },
  sel: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  selOn: { backgroundColor: colors.ink, borderColor: colors.ink },
});
