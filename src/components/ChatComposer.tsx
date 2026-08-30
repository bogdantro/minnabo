import { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

export function ChatComposer({
  onSend,
  onAttach,
  onSendOffer,
  canSendOffer,
}: {
  onSend: (text: string) => void;
  onAttach: () => void;
  onSendOffer: () => void;
  canSendOffer: boolean;
}) {
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardVisible();
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  // When the keyboard is up the KeyboardAvoidingView already lifts us — don't
  // also add the home-indicator inset or the composer floats above the keyboard.
  const pad = keyboardOpen ? tokens.space.sm : insets.bottom + tokens.space.sm;

  return (
    <View style={[styles.wrap, { paddingBottom: pad }]}>
      {canSendOffer ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSendOffer}
          hitSlop={8}
          style={styles.offerLink}
        >
          <Icon name="tag" size={14} color="cyan" />
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
          <Icon name="plus" size={20} color="lime" />
        </Pressable>

        <TextInput
          style={styles.input}
          placeholder={nb.chat.inputPlaceholder}
          placeholderTextColor={tokens.color.navyMuted}
          value={text}
          onChangeText={setText}
          multiline
          spellCheck={false}
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

const CONTROL = 42;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    paddingHorizontal: tokens.space.md,
    paddingTop: tokens.space.sm,
    gap: tokens.space.sm,
  },
  offerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-end',
    paddingVertical: 2,
    paddingHorizontal: tokens.space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  attach: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL / 2,
    borderWidth: 1.5,
    borderColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: CONTROL,
    maxHeight: 120,
    borderRadius: tokens.radius.tile,
    borderWidth: 1,
    borderColor: tokens.color.line,
    paddingHorizontal: tokens.space.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: tokens.font.regular,
    fontSize: 15,
    color: tokens.color.navy,
  },
  send: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL / 2,
    backgroundColor: tokens.color.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendDisabled: { opacity: 0.4 },
});
