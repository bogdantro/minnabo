import { View, Image, StyleSheet } from 'react-native';
import type { Message } from '@/domain/types';
import { tokens } from '@/theme';
import { formatTime } from '@/lib/datetime';
import { AppText } from './ui/Text';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';

type Props = {
  message: Message;
  mine: boolean;
  avatarUri?: string;
  avatarInitials: string;
  showAvatar: boolean;
};

export function ChatBubble({ message, mine, avatarUri, avatarInitials, showAvatar }: Props) {
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

      <View
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
          {mine ? (
            <Icon
              name={message.delivery === 'READ' ? 'check-circle' : 'check'}
              size={13}
              color={message.delivery === 'READ' ? 'cyan' : 'navyMuted'}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.space.sm, marginVertical: 4 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
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
  systemRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md, marginVertical: tokens.space.md },
  systemLine: { flex: 1, height: 1, backgroundColor: tokens.color.line },
  systemPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
