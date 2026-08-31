import { View, Pressable, StyleSheet } from 'react-native';
import type { Message } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { BottomSheet } from './ui/BottomSheet';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

export const REACTION_EMOJI = ['❤️', '👍', '😂', '🙏', '✅'] as const;

export function MessageActionsSheet({
  message,
  meId,
  onClose,
  onReact,
  onTogglePin,
}: {
  message: Message | null;
  meId: string;
  onClose: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onTogglePin: (messageId: string, pinned: boolean) => void;
}) {
  const canPin = !!message && (message.kind === 'TEXT' || message.kind === 'IMAGE');

  return (
    <BottomSheet
      visible={message != null}
      onClose={onClose}
      title={nb.chat.messageActions}
      heightRatio={0.34}
    >
      <View style={styles.emojiRow}>
        {REACTION_EMOJI.map((emoji) => {
          const active = !!message?.reactions?.[emoji]?.includes(meId);
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`${nb.chat.react} ${emoji}`}
              onPress={() => {
                if (message) onReact(message.id, emoji);
                onClose();
              }}
              style={[styles.emojiBtn, active && styles.emojiBtnActive]}
            >
              <AppText style={styles.emoji}>{emoji}</AppText>
            </Pressable>
          );
        })}
      </View>

      {canPin && message ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onTogglePin(message.id, !message.pinned);
            onClose();
          }}
          style={styles.action}
        >
          <Icon name={message.pinned ? 'x' : 'bookmark'} size={18} color="navy" />
          <AppText variant="body" weight="bold">
            {message.pinned ? nb.chat.unpinMessage : nb.chat.pinMessage}
          </AppText>
        </Pressable>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
    marginBottom: tokens.space.md,
  },
  emojiBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.tile,
    borderWidth: 1,
    borderColor: tokens.color.line,
    backgroundColor: tokens.color.bg,
  },
  emojiBtnActive: { borderColor: tokens.color.lime, backgroundColor: tokens.color.limeTint },
  emoji: { fontSize: 24 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.card,
    backgroundColor: tokens.color.surface,
  },
});
