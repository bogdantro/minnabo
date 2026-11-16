import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Conversation } from '@/domain/types';
import nb from '@/i18n/nb';
import { EmptyScene } from '@/components/ui/EmptyScene';
import {
  useArchiveConversation,
  useConversations,
  useMarkConversationsRead,
  useMyAgreements,
  usePendingReviews,
  useReceivedProposals,
  useReplyMinutes,
  useToggleBlock,
} from '@/api/queries';
import { useConversationFlags, useInboxFlags, useMessageSearch } from '@/api/inboxQueries';
import { mutedConversations } from '@/lib/mutedConversations';
import { useChatDrafts } from '@/lib/chatDrafts';
import { useTypingChannel } from '@/api/realtime';
import { SwipeRow, type SwipeAction } from '@/components/SwipeRow';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatDayLabel } from '@/lib/calendar';
import { formatTime } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { useTabReselect } from '@/lib/tabReselect';
import { toast } from '@/lib/toast';
import { serverMessage } from '@/lib/errors';
import { colors, fonts, motion, radius, screenPadding, shadow, text } from '@/theme/theme';
import { HomeTopBar } from '@/components/TopBar';
import { NAV_OCCUPIED } from '@/components/BottomNav';
import { MinNaboRow } from '@/components/MinNaboRow';
import { ConversationRow } from '@/components/inbox/ConversationRow';
import {
  ActionTray,
  BulkBar,
  ChatSettingsSheet,
  GroupRow,
  MessageHits,
  QuickReplySheet,
  RowMenuSheet,
  TomorrowStrip,
  openTray,
  replyTimeText,
} from '@/components/inbox/InboxExtras';
import { ChatScreen } from '@/screens/ChatScreen';
import { groupByListing, inFolder, isSnoozed, rowStatus, sortInbox, withinDays, type InboxFolder, type InboxItem } from '@/domain/inboxModel';
import { Avatar, Button, Chip, ChipRow, ErrorState, FadeUp, Icon, IconButton, Pill, RowSkeleton, ScaleIn, ListScreen } from '@/components/ui';

type Filter = 'alle' | 'uleste' | 'client' | 'helper' | 'arkiv' | InboxFolder;
/** Faces in the strip at the top of Innboks. */
const MAX_FACES = 12;
/** Rows that listen for «skriver …» (one realtime channel each). */
const TYPING_ROWS = 8;
/** Side by side (list + chat) from this window width: tablets and the web. */
const TWO_PANES_FROM = 900;
const LIST_PANE_W = 400;

/** Innboks tab (design/screens/Innboks.dc.html), with the 0109 additions. */
export function InnboksScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const { width } = useWindowDimensions();
  const twoPanes = width >= TWO_PANES_FROM;
  const [paneId, setPaneId] = useState<string | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useConversations();
  // tap «Innboks» again: back to the top
  const listRef = useRef<FlatList<Row> | null>(null);
  useTabReselect('innboks', () => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  // The tab stays mounted: coming back from a chat must show its newest message.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const markRead = useMarkConversationsRead();
  const archive = useArchiveConversation();
  const setFlags = useConversationFlags();
  const toggleBlock = useToggleBlock();
  const agenda = useMyAgreements().data ?? [];
  const received = useReceivedProposals().data ?? [];
  const pendingReviews = usePendingReviews(!!me.id).data ?? [];
  const replyMinutes = useReplyMinutes(me.id || undefined).data;
  const flags = useInboxFlags(!!me.id).data;
  const drafts = useChatDrafts();
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('alle');
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  // search refinements (0109)
  const [onlyMedia, setOnlyMedia] = useState(false);
  const [days, setDays] = useState<7 | 30 | null>(null);
  const [menuFor, setMenuFor] = useState<Conversation | null>(null);
  const [quickFor, setQuickFor] = useState<Conversation | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  // "Merk alle som lest" is applied locally at once and sent after the Angre window.
  const [readHere, setReadHere] = useState<Set<string> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<string[]>([]);
  const [now] = useState(() => Date.now());

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (pending.current.length) markRead.mutate(pending.current);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush once on unmount
    [],
  );

  const everything = useMemo(() => data ?? [], [data]);
  // archived chats have their own tab; nothing else counts them
  const convs = useMemo(() => everything.filter((c) => !c.archived), [everything]);
  const archivedList = useMemo(() => everything.filter((c) => c.archived), [everything]);
  const isUnread = (c: Conversation) => c.unread && !readHere?.has(c.id);
  const awake = convs.filter((c) => !isSnoozed(c, now));
  const unreadN = awake.filter(isUnread).length;
  // messages, when the backend counts them; otherwise one per unread conversation
  const unreadMsgs = awake.filter(isUnread).reduce((n, c) => n + Math.max(c.unreadCount ?? 1, 1), 0);
  const needle = q.trim().toLowerCase();
  const written = useMemo(() => new Set(flags?.written ?? []), [flags]);
  const media = useMemo(() => new Set(flags?.media ?? []), [flags]);
  const ctx = { now, agenda, written };
  const folderCount = (f: InboxFolder) => convs.filter((c) => inFolder(f, c, ctx)).length;
  const isMuted = (c: Conversation) => mutedConversations.has(c.id) || (!!c.mutedUntil && Date.parse(c.mutedUntil) > now);

  const list = (filter === 'arkiv' ? archivedList : filter === 'snoozed' ? convs : awake).filter((c) => {
    if (filter === 'uleste' && !isUnread(c)) return false;
    if ((filter === 'client' || filter === 'helper') && c.role !== filter) return false;
    if (filter !== 'alle' && filter !== 'uleste' && filter !== 'client' && filter !== 'helper' && filter !== 'arkiv' && !inFolder(filter, c, ctx)) return false;
    if (onlyMedia && !media.has(c.id)) return false;
    if (days && !withinDays(c.lastMessageAt, days, now)) return false;
    if (!needle) return true;
    return `${c.counterpart.displayName} ${c.listing.title} ${c.lastMessagePreview}`.toLowerCase().includes(needle);
  });
  // one list, newest first (pinned on top), in one white panel; several tilbud on one oppdrag are stacked
  type Row =
    | { kind: 'conv'; key: string; c: Conversation; i: number; first: boolean; last: boolean; nested?: boolean }
    | { kind: 'group'; key: string; listingId: string; title: string; convs: Conversation[]; i: number; first: boolean; last: boolean };
  const items: InboxItem[] = filter === 'alle' && !needle && !selecting ? groupByListing(sortInbox(list)) : sortInbox(list).map((c) => ({ kind: 'conv' as const, c }));
  type Flat =
    | { kind: 'conv'; key: string; c: Conversation; nested?: boolean }
    | { kind: 'group'; key: string; listingId: string; title: string; convs: Conversation[] };
  const flat: Flat[] = items.flatMap((it): Flat[] =>
    it.kind === 'conv'
      ? [{ kind: 'conv' as const, key: it.c.id, c: it.c }]
      : [
          { kind: 'group' as const, key: `g-${it.listingId}`, listingId: it.listingId, title: it.title, convs: it.convs },
          ...(openGroups.has(it.listingId) ? it.convs.map((c) => ({ kind: 'conv' as const, key: c.id, c, nested: true })) : []),
        ],
  );
  const rows = flat.map((r, i) => ({ ...r, i, first: i === 0, last: i === flat.length - 1 }) as Row);
  const search = useMessageSearch(needle);

  // the faces at the top (Messenger): who is active now first, then the newest conversations
  const people = useMemo(() => {
    const seen = new Set<string>();
    // a snoozed conversation stays out of sight until it wakes, faces too
    return [...convs.filter((c) => !isSnoozed(c, now))]
      .sort((a, b) => Number(!!b.counterpart.online) - Number(!!a.counterpart.online) || Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt))
      .filter((c) => (seen.has(c.counterpart.id) ? false : (seen.add(c.counterpart.id), true)))
      .slice(0, MAX_FACES);
  }, [convs, now]);
  const names = useMemo(() => Object.fromEntries(convs.map((c) => [c.counterpart.id, c.counterpart.displayName])), [convs]);

  const open = (id: string, messageId?: string) => {
    if (twoPanes) setPaneId(id);
    else safePush(`/chat/${id}${messageId ? `?melding=${messageId}` : ''}`);
  };
  const setArchived = (c: Conversation, archived: boolean) => {
    archive.mutate({ id: c.id, archived }, { onError: () => toast.error(nb.toast.genericError) });
    toast.success(archived ? nb.inbox.archivedToast : nb.inbox.restoredToast, {
      icon: 'archive',
      action: { label: nb.inbox.undo, onPress: () => archive.mutate({ id: c.id, archived: !archived }) },
    });
  };
  const toggleMute = (c: Conversation) => {
    const on = mutedConversations.toggle(c.id);
    toast.info(on ? nb.chat.mutedToast : nb.chat.unmutedToast, { icon: 'bell' });
  };
  const swipeActions = (c: Conversation): SwipeAction[] => [
    ...(isUnread(c) ? [{ key: 'read', label: nb.inbox.swipeRead, icon: 'checks' as const, tone: 'cyan' as const, onPress: () => markRead.mutate([c.id]) }] : []),
    { key: 'more', label: nb.innboks.menu.more, icon: 'more', tone: 'lime', onPress: () => setMenuFor(c) },
    {
      key: 'archive',
      label: c.archived ? nb.inbox.swipeRestore : nb.inbox.swipeArchive,
      icon: 'archive',
      tone: 'ink',
      onPress: () => setArchived(c, !c.archived),
    },
  ];
  const flagged = (c: Conversation, f: Parameters<typeof setFlags.mutate>[0]['flags'], ok: string) =>
    setFlags.mutate({ id: c.id, flags: f }, { onSuccess: () => toast.success(ok), onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)) });

  const markAll = () => {
    const ids = awake.filter(isUnread).map((c) => c.id);
    if (!ids.length) return;
    pending.current = ids;
    setReadHere(new Set(ids));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      markRead.mutate(pending.current, { onSettled: () => setReadHere(null) });
      pending.current = [];
    }, motion.durations.toastVisible + 400);
    toast.success(nb.inbox.markedToast, {
      icon: 'checks',
      action: {
        label: nb.inbox.undo,
        onPress: () => {
          clearTimeout(timer.current);
          timer.current = undefined;
          pending.current = [];
          setReadHere(null);
        },
      },
    });
  };

  // ---- bulk (Velg)
  const togglePick = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const endSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const bulk = (fn: (ids: string[]) => void) => {
    const ids = [...picked];
    fn(ids);
    toast.success(nb.innboks.bulk.doneToast(ids.length));
    endSelecting();
  };

  // ---- «Trenger deg nå»
  const offersToAnswer = received.filter((p) => p.status === 'SENT').length;
  const changes = convs.filter((c) => c.statusTag === 'REVISION_PENDING');
  const chips: { f: Filter; label: string; n?: number; hideEmpty?: boolean; icon?: 'archive' | 'pinned' | 'alert' | 'clock' }[] = [
    { f: 'alle', label: nb.inbox.filterAll },
    { f: 'uleste', label: nb.inbox.filterUnread, n: unreadN },
    { f: 'waitingMe', label: nb.innboks.filters.waitingMe, n: folderCount('waitingMe') },
    { f: 'waitingThem', label: nb.innboks.filters.waitingThem },
    { f: 'requests', label: nb.innboks.filters.requests, n: folderCount('requests'), hideEmpty: true },
    { f: 'suspicious', label: nb.innboks.filters.suspicious, n: folderCount('suspicious'), hideEmpty: true, icon: 'alert' },
    { f: 'client', label: nb.inbox.filterClient },
    { f: 'helper', label: nb.inbox.filterHelper },
    { f: 'agreed', label: nb.innboks.filters.agreed },
    { f: 'done', label: nb.innboks.filters.done },
    { f: 'snoozed', label: nb.innboks.filters.snoozed, n: folderCount('snoozed'), hideEmpty: true, icon: 'clock' },
  ];

  const statusLabel = (c: Conversation) => {
    const s = rowStatus(c, agenda);
    if (!s) return undefined;
    if (s.kind === 'agreedAt') return { label: nb.innboks.status.agreedAt(`${formatDayLabel(new Date(s.at!)).toLowerCase()} ${formatTime(s.at!)}`), tone: 'ok' as const };
    if (s.kind === 'review') return { label: nb.innboks.status.review, tone: 'warn' as const };
    if (s.kind === 'done') return { label: nb.innboks.status.done, tone: 'dark' as const };
    if (s.kind === 'agreed') return { label: nb.innboks.status.agreed, tone: 'ok' as const };
    return undefined;
  };

  const listPane = (
    <ListScreen
      listRef={listRef}
      data={isLoading || isError ? [] : rows}
      keyExtractor={(r) => r.key}
      resetKey={`${filter}|${needle}|${onlyMedia}|${days}`}
      gap={0}
      spacer="nav"
      header={
        <HomeTopBar
          avatar={{ uri: me.avatarUrl, initials: me.initials }}
          onProfilePress={() => safePush('/profil')}
          onNotificationsPress={() => safePush('/varsler')}
        />
      }
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={colors.limeDeep} />}
      listHeader={
        <View>
          <FadeUp style={[styles.px, styles.head]}>
            <View style={styles.headText}>
              <Text style={text.h1} accessibilityRole="header">
                {nb.inbox.title}
              </Text>
              <Text style={text.meta} accessibilityLiveRegion="polite">
                {nb.inbox.sub(unreadMsgs, unreadN)}
              </Text>
            </View>
            <IconButton icon="gear" iconSize={18} accessibilityLabel={nb.innboks.settings.open} onPress={() => setSettingsOpen(true)} />
          </FadeUp>
          <FadeUp delay={60} style={[styles.px, styles.headBtns]}>
            <Button label={nb.inbox.markAll} icon="checks" variant="ghost" size="sm" block={false} disabled={unreadN === 0} onPress={markAll} />
            <Button
              label={selecting ? nb.innboks.bulk.done : nb.innboks.bulk.select}
              icon={selecting ? 'x' : 'check'}
              variant="ghost"
              size="sm"
              block={false}
              onPress={() => (selecting ? endSelecting() : setSelecting(true))}
            />
          </FadeUp>
          {replyMinutes != null ? <Text style={[text.hint, styles.px, styles.mt8]}>{nb.innboks.replyTime(replyTimeText(replyMinutes))}</Text> : null}

          <ActionTray
            offers={offersToAnswer}
            changes={changes.length}
            reviews={pendingReviews.length}
            onOffers={openTray.offers}
            onChanges={() => changes[0] && open(changes[0].id)}
            onReviews={() => pendingReviews[0] && openTray.review(pendingReviews[0].proposalId)}
          />
          <TomorrowStrip agenda={agenda} names={names} onOpen={(a) => safePush(`/avtale/${a.proposalId}`)} />

          <FadeUp delay={100} style={[styles.px, styles.mt16]}>
            <View style={[styles.search, focused && styles.searchFocus]}>
              <Icon name="search" size={19} color={colors.mute} />
              <TextInput
                value={q}
                onChangeText={setQ}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={nb.inbox.searchPlaceholder}
                placeholderTextColor={colors.placeholder}
                accessibilityLabel={nb.inbox.searchPlaceholder}
                returnKeyType="search"
                style={styles.searchInput}
              />
              {q ? (
                <ScaleIn>
                  <IconButton icon="x" iconSize={16} variant="ghost" accessibilityLabel={nb.inbox.clear} onPress={() => setQ('')} />
                </ScaleIn>
              ) : null}
            </View>
          </FadeUp>

          {needle ? (
            <View style={styles.mt12}>
              <ChipRow>
                <Chip label={nb.innboks.search.media} icon="image" size="sm" selected={onlyMedia} onPress={() => setOnlyMedia((v) => !v)} />
                <Chip label={nb.innboks.search.week} size="sm" selected={days === 7} onPress={() => setDays((d) => (d === 7 ? null : 7))} />
                <Chip label={nb.innboks.search.month} size="sm" selected={days === 30} onPress={() => setDays((d) => (d === 30 ? null : 30))} />
              </ChipRow>
            </View>
          ) : null}

          <FadeUp delay={150} style={styles.mt12}>
            <View accessibilityRole="tablist" accessibilityLabel={nb.inbox.filterLabel}>
              <ChipRow>
                {chips
                  .filter((ch) => !ch.hideEmpty || (ch.n ?? 0) > 0 || filter === ch.f)
                  .map((ch) => (
                    <Chip
                      key={ch.f}
                      label={ch.label}
                      icon={ch.icon}
                      selected={filter === ch.f}
                      onPress={() => setFilter(ch.f)}
                      accessibilityLabel={ch.n ? `${ch.label}, ${ch.n}` : ch.label}
                      trailing={ch.n ? <Pill label={String(ch.n)} tone={filter === ch.f ? 'accent' : 'neutral'} /> : undefined}
                    />
                  ))}
                {archivedList.length ? <Chip label={nb.inbox.filterArchive} icon="archive" selected={filter === 'arkiv'} onPress={() => setFilter('arkiv')} /> : null}
              </ChipRow>
            </View>
          </FadeUp>
          {filter === 'requests' ? <Text style={[text.hint, styles.px, styles.mt8]}>{nb.innboks.requestsNote}</Text> : null}
          {filter === 'suspicious' ? <Text style={[text.hint, styles.px, styles.mt8, styles.danger]}>{nb.innboks.suspiciousNote}</Text> : null}

          {filter === 'alle' && !needle && !selecting && people.length > 1 ? (
            <FadeUp delay={180}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faces} accessibilityLabel={nb.inbox.facesLabel}>
                {people.map((c) => (
                  <Pressable
                    key={c.counterpart.id}
                    accessibilityRole="link"
                    accessibilityLabel={`${c.counterpart.displayName}${c.counterpart.online ? `, ${nb.inbox.activeNow}` : ''}`}
                    onPress={() => open(c.id)}
                    style={({ pressed }) => [styles.face, pressed && styles.facePressed]}
                  >
                    <View style={[styles.faceRing, isUnread(c) && styles.faceRingUnread]}>
                      <Avatar initials={c.counterpart.initials} uri={c.counterpart.avatarUrl} seed={c.counterpart.id} size={54} online={c.counterpart.online} ring={false} />
                    </View>
                    <Text style={[styles.faceName, isUnread(c) && styles.faceNameUnread]} numberOfLines={1}>
                      {c.counterpart.displayName.split(' ')[0]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </FadeUp>
          ) : null}

          {needle ? <MessageHits hits={search.data ?? []} needle={needle} convs={everything} onOpen={(h) => open(h.conversationId, h.messageId)} /> : null}
          {needle && rows.length ? <Text style={[styles.sectionLabel, styles.px]}>{nb.innboks.search.chats}</Text> : null}

          {!needle ? <MinNaboRow /> : null}
        </View>
      }
      empty={
        <View style={styles.px}>
          {isLoading ? (
            <View style={styles.mt18}>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </View>
          ) : isError ? (
            <View style={styles.errorBox}>
              <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
            </View>
          ) : null}
          {!isLoading && !isError && list.length === 0 ? (
            needle ? (
              (search.data ?? []).length ? null : (
                <ScaleIn style={[styles.dash, styles.mt26]}>
                  <View style={[styles.emptyIc, { backgroundColor: colors.cyanTint }]}>
                    <Icon name="search" size={22} color={colors.cyanDeep} />
                  </View>
                  <Text style={[text.label, styles.f155, styles.center]}>{nb.inbox.noHits(q.trim())}</Text>
                  <Text style={[text.meta, styles.center]}>{nb.inbox.noHitsSub}</Text>
                  <Button label={nb.inbox.clearSearch} variant="ghost" size="sm" block={false} align="center" onPress={() => setQ('')} />
                </ScaleIn>
              )
            ) : filter === 'uleste' ? (
              <ScaleIn style={[styles.caught, shadow.card, styles.mt26]}>
                <EmptyScene icon="checks" tone="lime" />
                <Text style={styles.caughtTitle}>{nb.inbox.caughtUp}</Text>
                <Text style={[text.meta, styles.center]}>{nb.inbox.caughtUpSub}</Text>
                <Button label={nb.inbox.showAll} variant="ghost" size="sm" block={false} align="center" onPress={() => setFilter('alle')} style={styles.mt4} />
              </ScaleIn>
            ) : filter !== 'alle' ? (
              <ScaleIn style={[styles.caught, shadow.card, styles.mt26]}>
                <EmptyScene icon="msg" tone="cyan" />
                <Text style={styles.caughtTitle}>
                  {filter === 'client' || filter === 'helper' || filter === 'arkiv' ? nb.inbox.emptyFilter[filter] : nb.innboks.empty[filter]}
                </Text>
                <Button label={nb.inbox.showAll} variant="ghost" size="sm" block={false} align="center" onPress={() => setFilter('alle')} style={styles.mt4} />
              </ScaleIn>
            ) : (
              <ScaleIn style={[styles.caught, shadow.card, styles.mt26]}>
                <EmptyScene icon="msg" tone="cyan" />
                <Text style={styles.caughtTitle}>{nb.inbox.emptyTitle}</Text>
                <Text style={[text.meta, styles.center]}>{nb.inbox.emptySub}</Text>
                <Button label={nb.inbox.findJob} size="sm" block={false} align="center" onPress={() => router.replace('/')} style={styles.mt4} />
              </ScaleIn>
            )
          ) : null}
        </View>
      }
      renderItem={({ item: r }) => (
        // only the first screenful fades in; later pages appear at once
        <FadeUp delay={r.i < 8 ? Math.min(r.i + 3, 10) * 50 : 0} style={styles.px}>
          <View style={[styles.panel, r.first && styles.panelFirst, r.last && styles.panelLast, r.kind === 'conv' && r.nested && styles.nested]}>
            {r.kind === 'group' ? (
              <GroupRow
                title={r.title}
                convs={r.convs}
                open={openGroups.has(r.listingId)}
                onToggle={() =>
                  setOpenGroups((s) => {
                    const n = new Set(s);
                    if (n.has(r.listingId)) n.delete(r.listingId);
                    else n.add(r.listingId);
                    return n;
                  })
                }
                onCompare={() => safePush(`/tilbud/sammenlign/${r.listingId}`)}
              />
            ) : selecting ? (
              <ConversationRow
                c={r.c}
                unread={isUnread(r.c)}
                status={statusLabel(r.c)}
                muted={isMuted(r.c)}
                selecting
                selected={picked.has(r.c.id)}
                onPress={() => togglePick(r.c.id)}
              />
            ) : (
              <SwipeRow id={r.c.id} openId={openRow} onOpenChange={setOpenRow} actions={swipeActions(r.c)}>
                <LiveRow
                  c={r.c}
                  listen={r.i < TYPING_ROWS}
                  unread={isUnread(r.c)}
                  actions={swipeActions(r.c)}
                  status={statusLabel(r.c)}
                  draft={drafts[r.c.id]}
                  muted={isMuted(r.c)}
                  onPress={() => open(r.c.id)}
                  onLongPress={() => setMenuFor(r.c)}
                />
              </SwipeRow>
            )}
            {r.last ? null : <View style={styles.sep} />}
          </View>
        </FadeUp>
      )}
      listFooter={
        <View style={styles.px}>
          <FadeUp delay={400} style={styles.safety}>
            <View style={styles.safetyIc}>
              <Icon name="shield" size={16} color={colors.ok} />
            </View>
            <Text style={[text.meta, styles.flex]}>{nb.inbox.safety}</Text>
          </FadeUp>
        </View>
      }
    />
  );

  const paneConv = paneId ? everything.find((c) => c.id === paneId) : undefined;

  return (
    <View style={styles.flex}>
      {twoPanes ? (
        <View style={styles.panes}>
          <View style={styles.listPane}>{listPane}</View>
          {/* room for the floating tab bar, so it never covers the text field */}
          <View style={[styles.chatPane, { paddingBottom: NAV_OCCUPIED + 8 }]}>
            {paneConv ? (
              <ChatScreen key={paneConv.id} conversation={paneConv} onBack={() => setPaneId(null)} />
            ) : (
              <View style={styles.paneEmpty}>
                <EmptyScene icon="msg" tone="cyan" />
                <Text style={[text.meta, styles.center]}>{nb.inbox.emptySub}</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        listPane
      )}

      {selecting ? (
        <BulkBar
          count={picked.size}
          onRead={() => bulk((ids) => markRead.mutate(ids))}
          onMute={() => bulk((ids) => ids.forEach((id) => !mutedConversations.has(id) && mutedConversations.toggle(id)))}
          onArchive={() => bulk((ids) => ids.forEach((id) => archive.mutate({ id, archived: true })))}
          onDone={endSelecting}
        />
      ) : null}

      <RowMenuSheet
        c={menuFor}
        muted={!!menuFor && mutedConversations.has(menuFor.id)}
        onClose={() => setMenuFor(null)}
        onPin={(c, on) => {
          setMenuFor(null);
          flagged(c, { pinned: on }, on ? nb.innboks.menu.pinnedToast : nb.innboks.menu.unpinnedToast);
        }}
        onSnooze={(c, until) => {
          setMenuFor(null);
          flagged(c, { snoozeUntil: until }, until ? nb.innboks.menu.snoozedToast : nb.innboks.settings.saved);
        }}
        onMute={(c, until) => {
          setMenuFor(null);
          if (until === 'always') {
            if (!mutedConversations.has(c.id)) toggleMute(c);
          } else if (until === 'off') {
            if (mutedConversations.has(c.id)) toggleMute(c);
            if (c.mutedUntil) flagged(c, { mutedUntil: null }, nb.chat.unmutedToast);
          } else flagged(c, { mutedUntil: until }, nb.innboks.menu.mutedToast);
        }}
        onReply={(c) => {
          setMenuFor(null);
          setQuickFor(c);
        }}
        onBlock={(c) => {
          setMenuFor(null);
          toggleBlock.mutate(c.counterpart.id, { onSuccess: () => toast.info(nb.chat.blockedToast(c.counterpart.displayName), { icon: 'ban' }) });
        }}
        onReport={(c) => {
          setMenuFor(null);
          safePush(`/rapporter?profil=${c.counterpart.id}`);
        }}
      />
      <QuickReplySheet c={quickFor} meId={me.id} onClose={() => setQuickFor(null)} />
      <ChatSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

/** A row that also shows «skriver …» while the other person types (the first rows only: one channel each). */
function LiveRow({ listen, ...props }: Parameters<typeof ConversationRow>[0] & { listen: boolean }) {
  return listen ? <TypingRow {...props} /> : <ConversationRow {...props} />;
}

function TypingRow(props: Parameters<typeof ConversationRow>[0]) {
  const { counterpartTyping } = useTypingChannel(props.c.id);
  return <ConversationRow {...props} typing={counterpartTyping} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  px: { paddingHorizontal: screenPadding },
  center: { textAlign: 'center' },
  danger: { color: colors.danger },
  f155: { fontSize: 15.5 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  mt26: { marginTop: 26 },
  errorBox: { height: 380 },
  head: { paddingTop: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  headText: { flex: 1, gap: 6 },
  headBtns: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  sectionLabel: { marginTop: 18, fontFamily: fonts.bodyBold, fontSize: 12.5, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.mute },
  search: {
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 18,
    paddingRight: 6,
  },
  searchFocus: { borderColor: colors.cyan2 },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.bodyMedium, fontSize: 15.5, color: colors.ink },
  // one white panel: the first row has the top corners, the last the bottom ones
  panel: { backgroundColor: colors.white, overflow: 'hidden' },
  panelFirst: { marginTop: 14, borderTopLeftRadius: radius.listingCard, borderTopRightRadius: radius.listingCard },
  panelLast: { borderBottomLeftRadius: radius.listingCard, borderBottomRightRadius: radius.listingCard },
  nested: { paddingLeft: 18, backgroundColor: colors.surface2 },
  sep: { height: 1, marginLeft: 82, backgroundColor: colors.line2 },
  faces: { gap: 14, paddingHorizontal: screenPadding, paddingTop: 16, paddingBottom: 2 },
  face: { width: 62, alignItems: 'center', gap: 5 },
  facePressed: { opacity: 0.75 },
  faceRing: { padding: 2.5, borderRadius: 34, borderWidth: 2, borderColor: 'transparent' },
  faceRingUnread: { borderColor: colors.lime },
  faceName: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.ink2, maxWidth: 62 },
  faceNameUnread: { fontFamily: fonts.bodyBold, color: colors.ink },
  dash: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 10,
  },
  caught: { paddingVertical: 30, paddingHorizontal: 22, borderRadius: 28, backgroundColor: colors.white, alignItems: 'center', gap: 10 },
  emptyIc: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  caughtTitle: { fontFamily: text.h3.fontFamily, fontSize: 19, lineHeight: 23, letterSpacing: -0.38, color: colors.ink, textAlign: 'center' },
  safety: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    backgroundColor: colors.glassBg,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  safetyIc: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.okTint, alignItems: 'center', justifyContent: 'center' },
  panes: { flex: 1, flexDirection: 'row' },
  listPane: { width: LIST_PANE_W, borderRightWidth: 1, borderRightColor: colors.line2 },
  chatPane: { flex: 1 },
  paneEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 30 },
});
