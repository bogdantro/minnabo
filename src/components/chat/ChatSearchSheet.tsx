import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Message } from '@/domain/types';
import nb from '@/i18n/nb';
import { dayMonthYear, formatTime } from '@/lib/datetime';
import { colors, fonts, radius, text } from '@/theme/theme';
import { Icon, SearchField, Sheet } from '@/components/ui';

/** Text messages that contain the words, newest first (the translation counts too). Pure, for tests. */
export function searchMessages(list: Message[], q: string): Message[] {
  const needle = q.trim().toLocaleLowerCase('nb-NO');
  if (needle.length < 2) return [];
  return list
    .filter((m) => m.kind === 'TEXT' && !m.deletedAt && `${m.text}\n${m.translationNb ?? ''}`.toLocaleLowerCase('nb-NO').includes(needle))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** A short piece of the text around the first hit: ['… før ', 'treff', ' etter …']. */
export function snippet(value: string, q: string, around = 34): [string, string, string] {
  const i = value.toLocaleLowerCase('nb-NO').indexOf(q.trim().toLocaleLowerCase('nb-NO'));
  if (i < 0) return [value.slice(0, around * 2), '', ''];
  const end = i + q.trim().length;
  const start = Math.max(0, i - around);
  return [`${start > 0 ? '…' : ''}${value.slice(start, i)}`, value.slice(i, end), `${value.slice(end, end + around)}${end + around < value.length ? '…' : ''}`];
}

/** «Søk i samtalen» (0101): find a message; a tap jumps to it in the chat. */
export function ChatSearchSheet({
  visible,
  messages,
  nameOf,
  onClose,
  onPick,
}: {
  visible: boolean;
  messages: Message[];
  nameOf: (m: Message) => string;
  onClose: () => void;
  onPick: (m: Message) => void;
}) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => searchMessages(messages, q), [messages, q]);
  const close = () => {
    setQ('');
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={close} title={nb.chatSearch.title} titleSize="h2" heightRatio={0.85}>
      <SearchField placeholder={nb.chatSearch.placeholder} value={q} onChangeText={setQ} autoFocus />
      <Text style={[text.meta, styles.count]} accessibilityLiveRegion="polite">
        {q.trim().length < 2 ? nb.chatSearch.hint : nb.chatSearch.count(hits.length)}
      </Text>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {hits.map((m) => {
          const inText = m.text.toLocaleLowerCase('nb-NO').includes(q.trim().toLocaleLowerCase('nb-NO'));
          const [a, b, c] = snippet(inText ? m.text : (m.translationNb ?? ''), q);
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={nb.chatSearch.a11y(nameOf(m), dayMonthYear(m.createdAt), m.text)}
              onPress={() => {
                setQ('');
                onPick(m);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.ic}>
                <Icon name="msg" size={16} color={colors.cyanDeep} />
              </View>
              <View style={styles.flex}>
                <View style={styles.head}>
                  <Text style={text.label} numberOfLines={1}>
                    {nameOf(m)}
                  </Text>
                  <Text style={styles.when}>{`${dayMonthYear(m.createdAt)} ${formatTime(m.createdAt)}`}</Text>
                </View>
                <Text style={styles.snip} numberOfLines={2}>
                  {a}
                  <Text style={styles.hit}>{b}</Text>
                  {c}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  count: { marginTop: 10, marginBottom: 6 },
  list: { maxHeight: 520 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line2 },
  pressed: { opacity: 0.7 },
  ic: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 3 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  when: { ...text.meta, fontSize: 12 },
  snip: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.ink2 },
  hit: { fontFamily: fonts.bodyBold, color: colors.ink, backgroundColor: colors.limeTint, borderRadius: radius.s },
});
