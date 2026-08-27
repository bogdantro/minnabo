import { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

export function ChatComposer({
  onSend,
  onAttach,
  onSendOffer,
  canSendOffer,
  sending,
}: {
  onSend: (text: string) => void;
  onAttach: () => void;
  onSendOffer: () => void;
  canSendOffer: boolean;
  sending?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + tokens.space.sm }]}>
      {canSendOffer ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSendOffer}
          style={styles.offerLink}
        >
          <AppText variant="meta" weight="bold" color="cyan">
            {nb.chat.sendOffer}
          </AppText>
        </Pressable>
      ) : null}

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.chat.attach}
          onPress={onAttach}
          style={styles.attach}
        >
          <Icon name="plus" size={22} color="lime" />
        </Pressable>

        <TextInput
          style={styles.input}
          placeholder={nb.chat.inputPlaceholder}
          placeholderTextColor={tokens.color.navyMuted}
          value={text}
          onChangeText={setText}
          multiline
          accessibilityLabel={nb.chat.inputPlaceholder}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.chat.send}
          accessibilityState={{ disabled: !text.trim() }}
          onPress={submit}
          style={[styles.send, !text.trim() && styles.sendDisabled]}
        >
          <Icon name="send" size={18} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.sm,
    gap: tokens.space.sm,
  },
  offerLink: { alignSelf: 'flex-end', paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.space.sm },
  attach: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: tokens.radius.tile,
    borderWidth: 1,
    borderColor: tokens.color.line,
    paddingHorizontal: tokens.space.md,
    paddingTop: tokens.space.sm,
    paddingBottom: tokens.space.sm,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    color: tokens.color.navy,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.color.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
});
