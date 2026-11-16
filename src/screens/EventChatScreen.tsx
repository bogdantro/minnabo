import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import nb from '@/i18n/nb';
import type { EventMessage } from '@/domain/types';
import { useCanUseEventChat, useEventMessages, useEventRsvps, useNoticeboard, usePostEventMessage, useProfile } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { dayMonth, formatTime, shortDate } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { EVENT_ICON, eventTypeOf } from '@/components/community/noticeKinds';
import { colors, fonts, screenPadding, shadow, text } from '@/theme/theme';
import { Avatar, EmptyState, ErrorState, Icon, IconButton, Input, Note, RowSkeleton, Screen, SubHeader } from '@/components/ui';

const MAX = 1000;
/** The chat closes a week after the arrangement (can_use_event_chat in 0101). */
const OPEN_AFTER = 7 * 86_400_000;

/**
 * Gruppechat for an arrangement (0101): everyone who answered «Kommer» or «Kanskje», and the one who
 * made it. Adults only. Read-only and then gone for the app a week after.
 */
export function EventChatScreen({ noticeId }: { noticeId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const post = (useNoticeboard().data ?? []).find((p) => p.id === noticeId);
  const open = useCanUseEventChat(noticeId);
  const allowed = open.data === true;
  const { data, isLoading, isError, refetch } = useEventMessages(noticeId, allowed);
  const rsvps = useEventRsvps(noticeId).data;
  const postMsg = usePostEventMessage(noticeId);
  const [draft, setDraft] = useState('');
  const [openedAt] = useState(() => Date.now());
  const scroll = useRef<ScrollView>(null);
  const ev = post ? eventTypeOf(post) : null;
  const closesAt = post?.eventAt ? new Date(Date.parse(post.eventAt) + OPEN_AFTER).toISOString() : null;
  const members = (rsvps?.going ?? 0) + (rsvps?.maybe ?? 0) + 1;

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/oppslagstavle?oppslag=${noticeId}`));
  const send = () => {
    const body = draft.trim();
    if (!body || postMsg.isPending) return;
    postMsg.mutate(body, {
      onSuccess: () => {
        haptics.light();
        setDraft('');
      },
      onError: (e) => toast.error(serverMessage(e, nb.eventChat.sendFailed)),
    });
  };

  const messages = data ?? [];
  const blocked = open.isFetched && !allowed;

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen header={<SubHeader title={nb.eventChat.title} onBack={back} />}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        >
          {post ? (
            <View style={[styles.head, shadow.card]}>
              <View style={styles.headIc}>
                <Icon name={ev ? EVENT_ICON[ev] : 'cal'} size={20} color={colors.ink} />
              </View>
              <View style={styles.flex}>
                <Text style={text.label} numberOfLines={2}>
                  {post.title}
                </Text>
                <Text style={text.meta}>
                  {[post.eventAt ? `${shortDate(post.eventAt)} kl. ${formatTime(post.eventAt)}` : null, nb.eventChat.members(members)].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          ) : null}

          {open.isLoading || (allowed && isLoading) ? (
            <RowSkeleton />
          ) : blocked ? (
            <Note icon="lock">{me.isYouth ? nb.eventChat.youth : post?.eventAt && Date.parse(post.eventAt) + OPEN_AFTER < openedAt ? nb.eventChat.closed : nb.eventChat.notJoined}</Note>
          ) : isError || open.isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : messages.length ? (
            messages.map((m, i) => <Line key={m.id} m={m} mine={m.authorProfileId === me.id} joined={messages[i - 1]?.authorProfileId === m.authorProfileId} />)
          ) : (
            <EmptyState icon="msg" title={nb.eventChat.empty} />
          )}

          {allowed && closesAt ? <Text style={styles.closes}>{nb.eventChat.closesNote(dayMonth(closesAt))}</Text> : null}
        </ScrollView>

        {allowed ? (
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder={nb.eventChat.placeholder}
              accessibilityLabel={nb.eventChat.placeholder}
              maxLength={MAX}
              multiline
              containerStyle={styles.input}
              style={styles.inputField}
            />
            <IconButton icon="send" variant="dark" accessibilityLabel={nb.eventChat.send} disabled={!draft.trim() || postMsg.isPending} onPress={send} />
          </View>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** One message; the name and face only on the first of a run from the same person. */
function Line({ m, mine, joined }: { m: EventMessage; mine: boolean; joined: boolean }) {
  const who = useProfile(m.authorProfileId).data;
  if (mine) {
    return (
      <View style={[styles.rowMine, joined && styles.joined]}>
        <View style={[styles.bubble, styles.bubbleMine]}>
          <Text style={[styles.body, styles.white]}>{m.body}</Text>
        </View>
        <Text style={styles.time}>{formatTime(m.createdAt)}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.rowTheirs, joined && styles.joined]}>
      <View style={styles.avatarCol}>{joined ? null : <Avatar initials={who?.initials ?? '·'} uri={who?.avatarUrl} seed={m.authorProfileId} size={30} ring={false} />}</View>
      <View style={styles.theirsCol}>
        {joined ? null : <Text style={styles.name}>{(who?.displayName ?? '').split(' ')[0]}</Text>}
        <View style={[styles.bubble, styles.bubbleTheirs, shadow.card]}>
          <Text style={styles.body}>{m.body}</Text>
        </View>
        <Text style={styles.time}>{formatTime(m.createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  list: { paddingHorizontal: screenPadding, paddingTop: 8, paddingBottom: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: colors.white, marginBottom: 6 },
  headIc: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  joined: { marginTop: -8 },
  rowMine: { alignItems: 'flex-end', gap: 4 },
  rowTheirs: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  avatarCol: { width: 30, marginBottom: 20 },
  theirsCol: { flex: 1, alignItems: 'flex-start', gap: 4 },
  name: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink2, paddingHorizontal: 6 },
  bubble: { maxWidth: '88%', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 20 },
  bubbleMine: { backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.white, borderBottomLeftRadius: 6 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  white: { color: colors.white },
  time: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.mute, paddingHorizontal: 6 },
  closes: { ...text.meta, fontSize: 12.5, textAlign: 'center', marginTop: 6 },
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
  inputField: { minHeight: 46, maxHeight: 120, borderRadius: 23, borderWidth: 0, backgroundColor: colors.bg, paddingVertical: 12, fontSize: 15.5 },
});
