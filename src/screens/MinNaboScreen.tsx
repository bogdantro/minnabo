import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MinNaboMessage } from '@/api/ApiClient';
import nb from '@/i18n/nb';
import { useMinNaboMarkRead, useMinNaboReply, useMinNaboThread, useMinNaboVote } from '@/api/queries';
import { formatTime, shortDate, daysAgo } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { ErrorState, Icon, IconButton, Input, Note, Pill, RowSkeleton, Screen, SubHeader, VerifiedIcon } from '@/components/ui';

const logo = require('../../assets/logo-icon.png');
const MAX = 2000;
const when = (iso: string) => (daysAgo(iso) <= 0 ? formatTime(iso) : `${shortDate(iso)} ${formatTime(iso)}`);

/**
 * The thread with «MinNabo» (0066): messages, news and polls from MinNabo, and my answers.
 * Opened from the pinned row in Innboks and from the varsel. Not in the design.
 */
export function MinNaboScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useMinNaboThread(true);
  const markRead = useMinNaboMarkRead();
  const reply = useMinNaboReply();
  const vote = useMinNaboVote();
  const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollView>(null);

  const messages = data ?? [];
  const unread = messages.some((m) => m.fromAdmin && !m.readAt);
  const mark = markRead.mutate;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  // seeing the thread reads it
  useEffect(() => {
    if (unread) mark();
  }, [unread, mark]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/innboks'));
  const send = () => {
    const body = draft.trim();
    if (!body || reply.isPending) return;
    reply.mutate(body, {
      onSuccess: () => {
        haptics.light();
        setDraft('');
      },
      onError: (e) => toast.error(serverMessage(e, nb.minnabo.sendFailed)),
    });
  };
  const pick = (m: MinNaboMessage, option: number) => {
    if (!m.broadcastId || m.pollClosed || m.myVote === option) return;
    haptics.light();
    vote.mutate({ broadcastId: m.broadcastId, option }, { onError: (e) => toast.error(serverMessage(e, nb.minnabo.voteFailed)) });
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        header={
          <SubHeader
            title={nb.minnabo.name}
            onBack={back}
            right={
              <View style={styles.badge} accessible accessibilityLabel={nb.minnabo.official}>
                <VerifiedIcon size={18} />
              </View>
            }
          />
        }
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        >
          <View style={styles.intro}>
            <View style={[styles.logobox, shadow.card]}>
              <Image source={logo} style={styles.logo} accessibilityIgnoresInvertColors />
            </View>
            <Pill label={nb.minnabo.official} tone="ok" icon="check" />
            <Text style={[text.meta, styles.center]}>{nb.minnabo.lead}</Text>
          </View>

          {isLoading ? (
            <RowSkeleton />
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : messages.length ? (
            messages.map((m) => (m.fromAdmin ? <FromMinNabo key={m.id} m={m} onPick={pick} /> : <Mine key={m.id} m={m} />))
          ) : (
            <Text style={[text.meta, styles.center]}>{nb.minnabo.empty}</Text>
          )}
          <Note icon="shield" style={styles.note}>
            {nb.minnabo.note}
          </Note>
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder={nb.minnabo.placeholder}
            accessibilityLabel={nb.minnabo.inputLabel}
            maxLength={MAX}
            multiline
            containerStyle={styles.input}
          />
          <IconButton
            icon="send"
            variant="dark"
            accessibilityLabel={nb.minnabo.send}
            disabled={!draft.trim() || reply.isPending}
            onPress={send}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Mine({ m }: { m: MinNaboMessage }) {
  return (
    <View style={styles.rowMine}>
      <View style={[styles.bubble, styles.bubbleMine]}>
        <Text style={[styles.body, styles.white]}>{m.body}</Text>
      </View>
      <Text style={styles.time}>{when(m.createdAt)}</Text>
    </View>
  );
}

function FromMinNabo({ m, onPick }: { m: MinNaboMessage; onPick: (m: MinNaboMessage, option: number) => void }) {
  const total = (m.pollCounts ?? []).reduce((a, b) => a + b, 0);
  return (
    <View style={styles.rowTheirs}>
      <View style={[styles.bubble, styles.bubbleTheirs, shadow.card]}>
        {m.kind !== 'MESSAGE' ? (
          <View style={styles.kindRow}>
            <Icon name={m.kind === 'POLL' ? 'chart' : 'sparkle'} size={14} color={colors.limeDeep} />
            <Text style={styles.kind}>{m.kind === 'POLL' ? nb.minnabo.poll : nb.minnabo.news}</Text>
          </View>
        ) : null}
        {m.title ? (
          <Text style={styles.title} accessibilityRole="header">
            {m.title}
          </Text>
        ) : null}
        <Text style={styles.body}>{m.body}</Text>

        {m.kind === 'POLL' && m.pollOptions ? (
          <View style={styles.options} accessibilityRole="radiogroup">
            {m.pollOptions.map((label, i) => {
              const option = i + 1;
              const mine = m.myVote === option;
              const count = m.pollCounts?.[i];
              const pct = count === undefined ? undefined : total ? Math.round((count / total) * 100) : 0;
              return (
                <Pressable
                  key={label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: mine, disabled: !!m.pollClosed }}
                  accessibilityLabel={nb.minnabo.optionAria(label, mine, pct)}
                  disabled={!!m.pollClosed}
                  onPress={() => onPick(m, option)}
                  style={[styles.option, mine && styles.optionMine]}
                >
                  {pct !== undefined ? <View style={[styles.fill, mine && styles.fillMine, { width: `${pct}%` }]} /> : null}
                  <Text style={[styles.optionText, mine && styles.optionTextMine]}>{label}</Text>
                  {pct !== undefined ? <Text style={styles.pct}>{`${pct} %`}</Text> : null}
                  {mine ? <Icon name="check" size={16} color={colors.limeDeep} /> : null}
                </Pressable>
              );
            })}
            <Text style={styles.pollMeta}>
              {m.pollClosed
                ? `${nb.minnabo.pollClosed} · ${nb.minnabo.pollVotes(total)}`
                : m.myVote
                  ? `${nb.minnabo.pollVoted} · ${nb.minnabo.pollVotes(total)}`
                  : nb.minnabo.pollPick}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.time}>{when(m.createdAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  badge: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: screenPadding, paddingTop: 8, paddingBottom: 16, gap: 12 },
  intro: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  logobox: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 46, height: 46 },
  center: { textAlign: 'center' },
  white: { color: colors.white },
  rowMine: { alignItems: 'flex-end', gap: 4 },
  rowTheirs: { alignItems: 'flex-start', gap: 4 },
  bubble: { maxWidth: '88%', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20 },
  bubbleMine: { backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.white, borderBottomLeftRadius: 6 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  kind: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase', color: colors.limeDeep },
  title: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: colors.ink, marginBottom: 4 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  time: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.mute, paddingHorizontal: 6 },
  options: { gap: 8, marginTop: 12 },
  option: {
    minHeight: 46,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  optionMine: { borderColor: colors.limeDot },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.neutralPill },
  fillMine: { backgroundColor: colors.limeTint },
  optionText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.ink },
  optionTextMine: { fontFamily: fonts.bodyBold },
  pct: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink2 },
  pollMeta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.mute, marginTop: 2 },
  note: { marginTop: 8 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: screenPadding,
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  input: { flex: 1 },
});
