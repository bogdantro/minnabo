import { View, StyleSheet } from 'react-native';
import type { Conversation } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { formatRelative } from '@/lib/datetime';
import { Card } from './ui/Card';
import { AppText } from './ui/Text';
import { Avatar } from './ui/Avatar';
import { StatusPill } from './ui/StatusPill';

export function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  const tag =
    conversation.statusTag === 'NEW_OFFER'
      ? { label: nb.inbox.tagNewOffer, tone: 'lime' as const }
      : conversation.statusTag === 'OFFER_ACCEPTED'
        ? { label: nb.inbox.tagOfferAccepted, tone: 'cyan' as const }
        : null;

  return (
    <Card onPress={onPress} padded={false} accessibilityLabel={`${conversation.counterpart.displayName}, ${conversation.listing.title}`}>
      <View style={styles.row}>
        <Avatar
          uri={conversation.counterpart.avatarUrl}
          initials={conversation.counterpart.initials}
          size={52}
          online={conversation.counterpart.online}
        />
        <View style={styles.body}>
          <View style={styles.topLine}>
            <AppText variant="cardTitle" weight="bold" numberOfLines={1} style={styles.name}>
              {conversation.counterpart.displayName}
            </AppText>
            <AppText variant="meta" color="navyMuted">
              {formatRelative(conversation.lastMessageAt)}
            </AppText>
          </View>

          <View style={styles.midLine}>
            <AppText variant="meta" color="navyMuted" numberOfLines={1} style={styles.listing}>
              {conversation.listing.title}
            </AppText>
            {tag ? <StatusPill label={tag.label} tone={tag.tone} /> : null}
          </View>

          <View style={styles.bottomLine}>
            <AppText
              variant="body"
              color={conversation.unread ? 'navy' : 'navyMuted'}
              weight={conversation.unread ? 'bold' : 'regular'}
              numberOfLines={1}
              style={styles.preview}
            >
              {conversation.lastMessagePreview}
            </AppText>
            {conversation.unread ? <View style={styles.unreadDot} /> : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: tokens.space.md, padding: tokens.space.md },
  body: { flex: 1, gap: 4, justifyContent: 'center' },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.sm },
  name: { flex: 1 },
  midLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.sm },
  listing: { flex: 1 },
  bottomLine: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  preview: { flex: 1 },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: tokens.color.lime,
  },
});
