import { View, Image, Pressable, StyleSheet } from 'react-native';
import type { Message } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { formatTime } from '@/lib/datetime';
import { AppText } from './ui/Text';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';

type Props = {
  message: Message;
  mine: boolean;
  meId: string;
  avatarUri?: string;
  avatarInitials: string;
  showAvatar: boolean;
  onRetry?: () => void;
  onLongPress?: () => void;
  onToggleReaction?: (emoji: string) => void;
};

export function ChatBubble({
  message,
  mine,
  meId,
  avatarUri,
  avatarInitials,
  showAvatar,
  onRetry,
  onLongPress,
  onToggleReaction,
}: Props) {
  if (message.kind === 'SYSTEM') {
    return (
      <View style={styles.systemRow}>
        <View style={styles.systemLine} />
        <View style={styles.systemPill}>
          <Icon name="check-circle" size={16} color="lime" />
          <AppText variant="meta" weight="bold" color="navy">
            {message.text}
          </AppText>
        </View>
        <View style={styles.systemLine} />
      </View>
    );
  }

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      {!mine ? (
        <View style={styles.avatarSlot}>
          {showAvatar ? <Avatar uri={avatarUri} initials={avatarInitials} size={28} ring={false} /> : null}
        </View>
      ) : null}

      <Pressable
        onLongPress={onLongPress}
        delayLongPress={300}
        accessibilityRole={onLongPress ? 'button' : undefined}
        accessibilityLabel={onLongPress ? nb.chat.messageActions : undefined}
        style={[
          styles.bubble,
          mine ? styles.mine : styles.theirs,
          message.kind === 'IMAGE' && styles.imageBubble,
        ]}
      >
        {message.kind === 'IMAGE' && message.attachmentUrl ? (
          <Image source={{ uri: message.attachmentUrl }} style={styles.image} />
        ) : (
          <AppText variant="body" color="navy">
            {message.text}
          </AppText>
        )}
        <View style={[styles.meta, message.kind === 'IMAGE' && styles.imageMeta]}>
          <AppText variant="meta" color="navyMuted">
            {formatTime(message.createdAt)}
          </AppText>
          {mine && !message.failed ? (
            <Icon
              name={
                message.pending
                  ? 'clock'
                  : message.delivery === 'READ'
                    ? 'check-circle'
                    : 'check'
              }
              size={13}
              color={message.delivery === 'READ' ? 'cyan' : 'navyMuted'}
            />
          ) : null}
        </View>
      </Pressable>

      {message.reactions && Object.keys(message.reactions).length > 0 ? (
        <View style={[styles.reactions, mine ? styles.reactionsMine : styles.reactionsTheirs]}>
          {Object.entries(message.reactions).map(([emoji, ids]) => {
            const reacted = ids.includes(meId);
            return (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`${emoji} ${ids.length}`}
                onPress={() => onToggleReaction?.(emoji)}
                style={[styles.reactionChip, reacted && styles.reactionChipMine]}
              >
                <AppText variant="meta">{emoji}</AppText>
                {ids.length > 1 ? (
                  <AppText variant="meta" weight="bold" color="navyMuted">
                    {ids.length}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {message.failed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.chat.retrySend}
          onPress={onRetry}
          style={styles.failedRow}
        >
          <Icon name="alert-circle" size={12} color="dangerText" />
          <AppText variant="meta" weight="bold" color="dangerText">
            {nb.chat.retrySend}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.space.sm, marginVertical: 4, flexWrap: 'wrap' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    justifyContent: 'flex-end',
    paddingTop: 2,
  },
  avatarSlot: { width: 28 },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    gap: 2,
  },
  mine: { backgroundColor: tokens.color.bubbleOut, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: tokens.color.bubbleIn, borderBottomLeftRadius: 6 },
  imageBubble: { padding: 4, gap: 0 },
  image: { width: 200, height: 150, borderRadius: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  imageMeta: { position: 'absolute', right: 10, bottom: 10 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: '100%', marginTop: 2 },
  reactionsMine: { justifyContent: 'flex-end' },
  reactionsTheirs: { justifyContent: 'flex-start', paddingLeft: 28 + tokens.space.sm },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  reactionChipMine: { borderColor: tokens.color.lime, backgroundColor: tokens.color.limeTint },
  systemRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md, marginVertical: tokens.space.md },
  systemLine: { flex: 1, height: 1, backgroundColor: tokens.color.line },
  systemPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
