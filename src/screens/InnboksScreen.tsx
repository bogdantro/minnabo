import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Conversation } from '@/domain/types';
import nb from '@/i18n/nb';
import { useConversations, useMarkConversationsRead } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { daysAgo, formatTime, shortDate } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, fonts, motion, radius, screenPadding, shadow, sizes, text } from '@/theme/theme';
import { HomeTopBar } from '@/components/TopBar';
import { MinNaboRow } from '@/components/MinNaboRow';
import {
  Avatar,
  Button,
  Chip,
  ChipRow,
  ErrorState,
  FadeUp,
  Icon,
  IconButton,
  Pill,
  RowSkeleton,
  ScaleIn,
  Screen,
} from '@/components/ui';

type Filter = 'alle' | 'uleste';
const GROUPS = ['today', 'yday', 'older'] as const;
const groupOf = (iso: string) => {
  const d = daysAgo(iso);
  return d <= 0 ? 'today' : d === 1 ? 'yday' : 'older';
};
const timeOf = (iso: string) => {
  const d = daysAgo(iso);
  return d <= 0 ? formatTime(iso) : d === 1 ? nb.inbox.groups.yday : shortDate(iso).replace(/^\S+ /, '');
};

/** Innboks tab (design/screens/Innboks.dc.html). */
export function InnboksScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const { data, isLoading, isError, isFetching, refetch } = useConversations();
  // The tab stays mounted: coming back from a chat must show its newest message.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const markRead = useMarkConversationsRead();
  const [filter, setFilter] = useState<Filter>('alle');
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  // "Merk alle som lest" is applied locally at once and sent after the Angre window.
  const [readHere, setReadHere] = useState<Set<string> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<string[]>([]);

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

  const convs = useMemo(() => data ?? [], [data]);
  const isUnread = (c: Conversation) => c.unread && !readHere?.has(c.id);
  const unreadN = convs.filter(isUnread).length;
  // messages, when the backend counts them; otherwise one per unread conversation
  const unreadMsgs = convs.filter(isUnread).reduce((n, c) => n + Math.max(c.unreadCount ?? 1, 1), 0);
  const needle = q.trim().toLowerCase();
  const list = convs.filter((c) => {
    if (filter === 'uleste' && !isUnread(c)) return false;
    if (!needle) return true;
    return `${c.counterpart.displayName} ${c.listing.title} ${c.lastMessagePreview}`.toLowerCase().includes(needle);
  });
  let idx = 0;
  const groups = GROUPS.map((g) => ({
    g,
    rows: list.filter((c) => groupOf(c.lastMessageAt) === g).map((c) => ({ c, i: idx++ })),
  })).filter((g) => g.rows.length);

  const markAll = () => {
    const ids = convs.filter(isUnread).map((c) => c.id);
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

  return (
    <Screen
      scroll
      header={
        <HomeTopBar
          avatar={{ uri: me.avatarUrl, initials: me.initials }}
          onProfilePress={() => safePush('/profil')}
          onNotificationsPress={() => safePush('/varsler')}
        />
      }
      scrollProps={{
        keyboardShouldPersistTaps: 'handled',
        refreshControl: <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={colors.limeDeep} />,
      }}
    >
      <FadeUp style={[styles.px, styles.head]}>
        <View style={styles.headText}>
          <Text style={text.h1} accessibilityRole="header">
            {nb.inbox.title}
          </Text>
          <Text style={text.meta} accessibilityLiveRegion="polite">
            {nb.inbox.sub(unreadMsgs, unreadN)}
          </Text>
        </View>
        <Button
          label={nb.inbox.markAll}
          icon="checks"
          variant="ghost"
          size="sm"
          block={false}
          disabled={unreadN === 0}
          onPress={markAll}
        />
      </FadeUp>

      <FadeUp delay={100} style={[styles.px, styles.mt16]}>
        <View style={[styles.search, shadow.card, focused && styles.searchFocus]}>
          <Icon name="search" size={20} color={colors.mute} />
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

      <FadeUp delay={150} style={styles.mt12}>
        <View accessibilityRole="tablist" accessibilityLabel={nb.inbox.filterLabel}>
          <ChipRow>
            <Chip label={nb.inbox.filterAll} selected={filter === 'alle'} onPress={() => setFilter('alle')} />
            <Chip
              label={nb.inbox.filterUnread}
              selected={filter === 'uleste'}
              onPress={() => setFilter('uleste')}
              accessibilityLabel={`${nb.inbox.filterUnread}, ${unreadN}`}
              trailing={unreadN ? <Pill label={String(unreadN)} tone={filter === 'uleste' ? 'accent' : 'neutral'} /> : undefined}
            />
          </ChipRow>
        </View>
      </FadeUp>

      <MinNaboRow />

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
        ) : (
          groups.map(({ g, rows }) => (
            <View key={g}>
              <Text style={[text.eyebrow, styles.grp]}>{nb.inbox.groups[g]}</Text>
              <View style={styles.gap10}>
                {rows.map(({ c, i }) => (
                  <FadeUp key={c.id} delay={Math.min(i + 3, 10) * 50}>
                    <ConvCard c={c} unread={isUnread(c)} onPress={() => safePush(`/chat/${c.id}`)} />
                  </FadeUp>
                ))}
              </View>
            </View>
          ))
        )}

        {!isLoading && !isError && list.length === 0 ? (
          needle ? (
            <ScaleIn style={[styles.dash, styles.mt26]}>
              <View style={[styles.emptyIc, { backgroundColor: colors.cyanTint }]}>
                <Icon name="search" size={22} color={colors.cyanDeep} />
              </View>
              <Text style={[text.label, styles.f155, styles.center]}>{nb.inbox.noHits(q.trim())}</Text>
              <Text style={[text.meta, styles.center]}>{nb.inbox.noHitsSub}</Text>
              <Button label={nb.inbox.clearSearch} variant="ghost" size="sm" block={false} align="center" onPress={() => setQ('')} />
            </ScaleIn>
          ) : filter === 'uleste' ? (
            <ScaleIn style={[styles.caught, shadow.card, styles.mt26]}>
              <View style={[styles.emptyIc, styles.caughtIc]}>
                <Icon name="checks" size={28} color={colors.ok} />
              </View>
              <Text style={styles.caughtTitle}>{nb.inbox.caughtUp}</Text>
              <Text style={[text.meta, styles.center]}>{nb.inbox.caughtUpSub}</Text>
              <Button label={nb.inbox.showAll} variant="ghost" size="sm" block={false} align="center" onPress={() => setFilter('alle')} style={styles.mt4} />
            </ScaleIn>
          ) : (
            <ScaleIn style={[styles.caught, shadow.card, styles.mt26]}>
              <View style={[styles.emptyIc, { backgroundColor: colors.cyanTint }]}>
                <Icon name="msg" size={24} color={colors.cyanDeep} />
              </View>
              <Text style={styles.caughtTitle}>{nb.inbox.emptyTitle}</Text>
              <Text style={[text.meta, styles.center]}>{nb.inbox.emptySub}</Text>
              <Button label={nb.inbox.findJob} size="sm" block={false} align="center" onPress={() => router.replace('/')} style={styles.mt4} />
            </ScaleIn>
          )
        ) : null}

        <FadeUp delay={400} style={styles.safety}>
          <View style={styles.safetyIc}>
            <Icon name="shield" size={16} color={colors.ok} />
          </View>
          <Text style={[text.meta, styles.flex]}>{nb.inbox.safety}</Text>
        </FadeUp>
      </View>
      <View style={styles.spacerNav} />
    </Screen>
  );
}

function ConvCard({ c, unread, onPress }: { c: Conversation; unread: boolean; onPress: () => void }) {
  const tag =
    c.statusTag === 'NEW_OFFER'
      ? { label: nb.inbox.tagNewOffer, tone: 'need' as const, icon: 'sparkle' as const }
      : c.statusTag === 'OFFER_ACCEPTED'
        ? { label: nb.inbox.tagOfferAccepted, tone: 'ok' as const, icon: 'check' as const }
        : c.statusTag === 'REVISION_PENDING'
          ? { label: nb.inbox.tagRevision, tone: 'warn' as const, icon: 'edit' as const }
          : null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${c.counterpart.displayName}, ${c.listing.title}${unread ? `, ${nb.inbox.unreadA11y}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.conv, unread ? [styles.convUnread, shadow.unreadConv] : shadow.card, pressed && styles.pressed]}
    >
      <Avatar initials={c.counterpart.initials} uri={c.counterpart.avatarUrl} seed={c.counterpart.id} size={48} online={c.counterpart.online} />
      <View style={styles.cb}>
        <View style={styles.top}>
          <Text style={styles.nm} numberOfLines={1}>
            {c.counterpart.displayName}
          </Text>
          <Text style={[styles.tm, unread && styles.tmUnread]}>{timeOf(c.lastMessageAt)}</Text>
        </View>
        <View style={styles.lst}>
          <View style={styles.td} />
          <Text style={styles.lstText} numberOfLines={1}>
            {c.listing.title}
          </Text>
        </View>
        <View style={styles.msgRow}>
          {/* my last message: one tick = sendt, two = levert, two in colour = lest */}
          {c.lastMessageDelivery ? (
            <View accessible accessibilityLabel={nb.inbox.receipt[c.lastMessageDelivery]} style={styles.tick}>
              <Icon
                name={c.lastMessageDelivery === 'SENT' ? 'check' : 'checks'}
                size={15}
                color={c.lastMessageDelivery === 'READ' ? colors.cyanDeep : colors.faint}
              />
            </View>
          ) : null}
          <Text style={[styles.msg, unread && styles.msgUnread]} numberOfLines={1}>
            {c.lastMessageMine ? nb.inbox.you : ''}
            {c.lastMessagePreview}
          </Text>
          {unread ? (
            <ScaleIn>
              <View style={styles.bubN}>
                {c.unreadCount ? (
                  <Text style={styles.bubText}>{c.unreadCount > 99 ? '99+' : c.unreadCount}</Text>
                ) : (
                  <View style={styles.bubDot} />
                )}
              </View>
            </ScaleIn>
          ) : null}
        </View>
        {tag ? <Pill label={tag.label} tone={tag.tone} icon={tag.icon} size="sm" style={styles.tag} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  px: { paddingHorizontal: screenPadding },
  center: { textAlign: 'center' },
  pressed: { transform: [{ scale: 0.985 }] },
  f155: { fontSize: 15.5 },
  gap10: { gap: 10 },
  mt4: { marginTop: 4 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  mt26: { marginTop: 26 },
  errorBox: { height: 380 },
  head: { paddingTop: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  headText: { flex: 1, gap: 6 },
  search: {
    height: sizes.search,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 18,
    paddingRight: 6,
  },
  searchFocus: { borderColor: colors.cyan2 },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.bodyMedium, fontSize: 15.5, color: colors.ink },
  grp: { marginTop: 18, marginBottom: 10, marginHorizontal: 4 },
  conv: {
    flexDirection: 'row',
    gap: 13,
    padding: 14,
    borderRadius: radius.listingCard,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  convUnread: { borderColor: colors.unreadConvBorder, borderWidth: 1.5 },
  cb: { flex: 1, minWidth: 0, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  nm: { flex: 1, minWidth: 0, fontFamily: text.label.fontFamily, fontSize: 15.5, lineHeight: 19, color: colors.ink },
  tm: { fontFamily: text.body.fontFamily, fontSize: 12.5, color: colors.faint },
  tmUnread: { fontFamily: text.label.fontFamily, color: colors.limeDeep },
  lst: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  td: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.limeDot },
  lstText: { flexShrink: 1, fontFamily: text.bodySemi.fontFamily, fontSize: 12.5, lineHeight: 15, color: colors.ink2 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tick: { marginRight: -5 },
  msg: { flex: 1, minWidth: 0, fontFamily: text.body.fontFamily, fontSize: 14, lineHeight: 19, color: colors.mute },
  msgUnread: { fontFamily: text.label.fontFamily, color: colors.ink },
  bubN: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  bubText: { fontFamily: fonts.bodyHeavy, fontSize: 12, lineHeight: 22, color: colors.lime },
  bubDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  tag: { alignSelf: 'flex-start', marginTop: 3 },
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
  caughtIc: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.limeSoft },
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
  spacerNav: { height: 130 },
});
