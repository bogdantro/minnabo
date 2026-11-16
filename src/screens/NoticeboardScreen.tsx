import { ShareEventSheet } from '@/components/ShareCards';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AreaPhotoCard, MoreMenuSheet } from '@/components/community/FellesTop';
import { CommunityLinkCard } from '@/components/community/CommunityLinkCard';
import { EventsCalendar, upcomingEvents } from '@/components/community/EventsCalendar';
import { serverMessage } from '@/lib/errors';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Image } from '@/components/ui/Image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BoardArt } from '@/components/art/Scenes';
import { ImageViewer } from '@/components/ImageViewer';
import { PostCard, photosOf } from '@/components/noticeboard/PostCard';
import { TypeStories, type NoticeFilter } from '@/components/noticeboard/TypeStories';
import { DateField } from '@/components/ui/DateField';
import { EmptyScene } from '@/components/ui/EmptyScene';
import { TimeField } from '@/components/ui/TimeField';
import Animated, { FadeInUp, LinearTransition } from 'react-native-reanimated';
import type { EventType, NoticeComment, NoticeKind, NoticeboardPost } from '@/domain/types';
import nb from '@/i18n/nb';
import {
  useCreateNoticeboardPost,
  useDeleteNoticeboardPost,
  useMyNabolag,
  useNoticeboard,
  useProfile,
  useSavedNoticeIds,
  useAddNoticeComment,
  useDeleteNoticeComment,
  useKeepNotice,
  useNoticeComments,
  useUpdateNoticeboardPost,
  useToggleNoticeLike,
  useToggleSavedNotice,
} from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { confirm } from '@/lib/confirm';
import { postedAgo } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { shareNotice } from '@/lib/share';
import { toast } from '@/lib/toast';
import { pickAndUpload } from '@/lib/uploads';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { ListingsMap } from '@/components/ListingsMap';
import { LendItemForm, LendItemFormById } from '@/components/lend/LendItemForm';
import { EVENT_ICON, EVENT_TYPES, NOTICE_STYLE, NOTICE_TYPES, TOPIC_STYLE, noticeType, type NoticeType } from '@/components/community/noticeKinds';
import { ADULT_ONLY_TOPICS, NOTICE_TOPICS, type NoticeTopic } from '@/domain/community';
import { useCommentLikes, useMyOrganisations, useNabolagDetails, usePinNotice, useToggleCommentLike } from '@/api/communityQueries';
import { Toggle } from '@/components/ui';
import {
  Avatar,
  Button,
  Chip,
  ErrorState,
  ErrorText,
  FadeUp,
  Icon,
  IconButton,
  Input,
  ListGroup,
  ListRow,
  Note,
  RowSkeleton,
  Screen,
  SectionHeader,
  Shake,
  Sheet,
  Spinner,
  SubHeader,
  TextLink,
  type IconName,
} from '@/components/ui';

type Filter = NoticeFilter;
type Photo = { path: string; url: string };
/** Photos on one oppslag (0099); the first is the one in the feed. */
const MAX_PHOTOS = 6;
// wait for the layout to settle before scrolling to an opened oppslag
const FOCUS_SCROLL_DELAY_MS = 300;
type Compose = { type?: NoticeType; photo?: Photo };

/** The day from the date field + "10:00" → ISO. */
const eventIso = (d: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const at = new Date(d);
  at.setHours(h || 0, m || 0, 0, 0);
  return at.toISOString();
};
const TITLE_MAX = 60;
/** «Avstemning»: 2–6 choices (notice_poll_options_check in 0101). */
const POLL_MIN = 2;
const POLL_MAX = 6;
const POLL_OPTION_MAX = 60;
const TEXT_MAX = 400;
const COMMENT_MAX = 500;
/** The feed runs nearly edge to edge, like a group feed. */
const FEED_INSET = 10;
const MAX_FACES = 5;
const QUICK: { key: string; label: string; icon: IconName; bg: string; fg: string; start?: Compose }[] = [
  { key: 'photo', label: nb.noticeboard.quick.photo, icon: 'image', bg: colors.cyanTint, fg: colors.cyanDeep },
  { key: 'EVENT', label: nb.noticeboard.quick.EVENT, ...NOTICE_STYLE.EVENT, start: { type: 'EVENT' } },
  { key: 'GIVEAWAY', label: nb.noticeboard.quick.GIVEAWAY, ...NOTICE_STYLE.GIVEAWAY, start: { type: 'GIVEAWAY' } },
  { key: 'TOOL_LEND', label: nb.noticeboard.quick.TOOL_LEND, ...NOTICE_STYLE.TOOL_LEND, start: { type: 'TOOL_LEND' } },
];

/** Oppslagstavle: the kommune's own group – a cover, a box to write in, and a feed of neighbours' posts. */
export function NoticeboardScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const scope = useLocationScope();
  const kommune = me.municipality || scope.municipality || '';
  const { data, isLoading, isError, refetch } = useNoticeboard();
  const del = useDeleteNoticeboardPost();
  const savedIds = useSavedNoticeIds().data ?? [];
  const toggleSaved = useToggleSavedNotice();
  const toggleLike = useToggleNoticeLike();
  const update = useUpdateNoticeboardPost();
  // "Svar" opens the public comments under the oppslag
  // `nabolag`: «Skriv oppslag» on a nabolag page starts the sheet with that nabolag as the audience
  // `oppslag`: a link to one oppslag (search, a varsel, a shared link) shows it first, marked (2026-11-15);
  // `svar=1` (an answer to my oppslag) opens the answers under it as well
  const { oppslag, svar, ny, tittel, tekst, nabolag } = useLocalSearchParams<{
    oppslag?: string;
    svar?: string;
    ny?: string;
    tittel?: string;
    tekst?: string;
    nabolag?: string;
  }>();
  const focusId = typeof oppslag === 'string' && oppslag ? oppslag : null;
  const [commentsFor, setCommentsFor] = useState<string | null>(svar === '1' ? focusId : null);
  const [focusClosed, setFocusClosed] = useState<string | null>(null);
  // a new link while Oppslagstavla is already open (the same screen gets new params): follow it
  const linkKey = `${focusId ?? ''}|${svar ?? ''}`;
  const [seenLink, setSeenLink] = useState(linkKey);
  if (seenLink !== linkKey) {
    setSeenLink(linkKey);
    setFocusClosed(null);
    setCommentsFor(svar === '1' ? focusId : null);
  }
  // «Sett den?» on a savnet dyr opens the answers with a start written for you (0108)
  const [prefill, setPrefill] = useState('');
  const pin = usePinNotice();
  // an arrangement is shared as a picture (0108)
  const [shareEvent, setShareEvent] = useState<NoticeboardPost | null>(null);
  const [editing, setEditing] = useState<NoticeboardPost | null>(null);
  const [menuFor, setMenuFor] = useState<NoticeboardPost | null>(null);
  const [viewer, setViewer] = useState<{ post: NoticeboardPost; index: number } | null>(null);
  const keep = useKeepNotice();
  const keepNotice = (post: NoticeboardPost) =>
    keep.mutate(post.id, {
      onSuccess: () => {
        haptics.success();
        toast.success(nb.noticeboard.stillKept, { icon: 'check', bottom: 100 });
      },
      onError: () => toast.error(nb.toast.genericError, { bottom: 100 }),
    });
  // «Søk i oppslagene»: title, text and place, case and æøå as typed
  const [q, setQ] = useState('');
  const toggleDone = (post: NoticeboardPost) =>
    update.mutate(
      { id: post.id, patch: { done: !post.doneAt } },
      {
        onSuccess: () => toast.success(post.doneAt ? nb.noticeboard.reopened : nb.noticeboard.markedDone, { icon: post.doneAt ? 'undo' : 'check', bottom: 100 }),
        onError: () => toast.error(nb.toast.genericError, { bottom: 100 }),
      },
    );
  const save = (id: string) => {
    const was = savedIds.includes(id);
    toggleSaved.mutate(id, {
      onSuccess: () => toast.success(was ? nb.noticeboard.unsaved : nb.noticeboard.saved, { icon: was ? 'x' : 'bookmark', bottom: 100 }),
      onError: () => toast.error(nb.toast.genericError, { bottom: 100 }),
    });
  };
  const like = (post: NoticeboardPost) => {
    haptics.light();
    toggleLike.mutate(post, { onError: () => toast.error(nb.toast.genericError, { bottom: 100 }) });
  };

  const [filter, setFilter] = useState<Filter>('ALL');
  const myNabolag = useMyNabolag(!!me.id).data ?? [];
  const [mineOnly, setMineOnly] = useState(false);
  // «Del hjelper med naboene» on Publisert opens the sheet with the text written for you
  const [compose, setCompose] = useState<Compose | null>(ny === '1' ? {} : null);
  // a new key each time, so a quick action starts on its own type with a clean form
  const [composeKey, setComposeKey] = useState(0);
  // «Lån ut» is a thing on Utlån too (0107): it has its own form, the same one as on Utlån
  const [lendForm, setLendForm] = useState<{ title?: string } | null>(null);
  const [lendEditId, setLendEditId] = useState<string | null>(null);
  const openCompose = (start: Compose) => {
    if (start.type === 'TOOL_LEND') {
      setLendForm({});
      return;
    }
    setComposeKey((n) => n + 1);
    setCompose(start);
  };
  // «Bilde»: pick first, like in a group; the sheet opens with the photo in place
  const photoFirst = async () => {
    try {
      const res = await pickAndUpload({ bucket: 'listing-images', folder: me.id, source: 'library' });
      if (res) openCompose({ photo: { path: res.path, url: res.publicUrl } });
    } catch (e) {
      toast.error(serverMessage(e, nb.toast.genericError));
    }
  };
  const [freshId, setFreshId] = useState<string | null>(null);
  // «Gis bort og funnet» on the map (0101): approximate circles only
  const [mapOpen, setMapOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!freshId) return;
    const t = setTimeout(() => setFreshId(null), 2400);
    return () => clearTimeout(t);
  }, [freshId]);

  const all = (data ?? [])
    .filter((p) => !scope.municipalities.length || scope.municipalities.includes(p.municipality))
    .filter((p) => !mineOnly || !myNabolag.length || !!p.neighbourhoodId);
  const query = q.trim().toLocaleLowerCase('nb-NO');
  const matching = useMemo(
    () => (query ? all.filter((p) => [p.title, p.body, p.place].some((t) => t?.toLocaleLowerCase('nb-NO').includes(query))) : all),
    [all, query],
  );
  // a vert's pinned oppslag (0108) come first, newest pin at the top; then the newest oppslag
  const shown = (filter === 'ALL' ? matching : matching.filter((p) => noticeType(p) === filter))
    .slice()
    .sort((a, b) => (b.pinnedAt ? Date.parse(b.pinnedAt) : 0) - (a.pinnedAt ? Date.parse(a.pinnedAt) : 0));
  const counts = useMemo(() => {
    const c = { ALL: matching.length } as Record<Filter, number>;
    for (const t of NOTICE_TYPES) c[t] = matching.filter((p) => noticeType(p) === t).length;
    return c;
  }, [matching]);
  const author = { id: me.id, name: me.displayName, initials: me.initials, avatarUrl: me.avatarUrl };
  // found among every oppslag, not only the filtered list: a link must never land on nothing
  const focusPost = focusId && focusClosed !== focusId ? (data ?? []).find((p) => p.id === focusId) : undefined;
  const feed = focusPost ? shown.filter((p) => p.id !== focusPost.id) : shown;
  // the opened oppslag sits under the hero and the filters: scroll it into view, once per link
  const scrollRef = useRef<ScrollView>(null);
  const listY = useRef(0);
  // where the type circles are, for «Se alle» on «Skjer i nærheten»
  const storiesY = useRef(0);
  const scrolledFor = useRef<string | null>(null);
  const onListLayout = (e: LayoutChangeEvent) => {
    listY.current = e.nativeEvent.layout.y;
  };
  const onFocusLayout = (e: LayoutChangeEvent) => {
    if (!focusPost || scrolledFor.current === focusPost.id) return;
    scrolledFor.current = focusPost.id;
    const focusY = e.nativeEvent.layout.y;
    // a child is measured before its parent, so the list's own place is known a moment later
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, listY.current + focusY - 12), animated: true }), FOCUS_SCROLL_DELAY_MS);
  };
  const authors = [...new Set(all.map((p) => p.authorProfileId))];

  const card = (p: NoticeboardPost) => (
    <PostCard
          post={p}
          now={now}
          fresh={p.id === freshId}
          mine={p.authorProfileId === me.id}
          meId={me.id}
          me={author}
          saved={savedIds.includes(p.id)}
          onLike={() => like(p)}
          onReply={() => setCommentsFor(p.id)}
          onSave={() => save(p.id)}
          onShare={() => (p.eventType ? setShareEvent(p) : void shareNotice(p.id, nb.noticeboard.shareText(p.title)))}
          onMore={() => setMenuFor(p)}
          onPhoto={(index) => setViewer({ post: p, index })}
          onKeep={() => keepNotice(p)}
          onClose={() => toggleDone(p)}
          onSeen={() => {
            setPrefill(nb.felles.topics.seenItPrefill);
            setCommentsFor(p.id);
          }}
    />
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace(me.isYouth ? '/ung' : '/fellesskap'));
  const remove = async (id: string) => {
    const ok = await confirm({ title: nb.noticeboard.deleteConfirm, destructive: true, confirmLabel: nb.noticeboard.remove });
    if (ok) del.mutate(id, { onSuccess: () => toast.success(nb.noticeboard.deleted, { bottom: 100 }) });
  };
  const closeMenu = (then: () => void) => {
    setMenuFor(null);
    then();
  };

  return (
    <>
      <Screen
        scroll
        scrollRef={scrollRef}
        spacer="none"
        header={
          <SubHeader
            title={nb.noticeboard.title}
            onBack={back}
            sideWidth={96}
            right={
              <View style={styles.headBtns}>
                <IconButton icon="map" iconSize={18} accessibilityLabel={nb.mapModes.openA11y} onPress={() => setMapOpen(true)} />
                <IconButton icon="edit" iconSize={18} accessibilityLabel={nb.noticeboard.newPost} onPress={() => openCompose({})} />
              </View>
            }
          />
        }
      >
        <FadeUp>
          <View style={styles.cover}>
            <BoardArt />
          </View>
          <View style={[styles.group, shadow.card]}>
            <View style={styles.groupBadge}>
              <Icon name="pinned" size={24} color={colors.ink} />
            </View>
            <Text style={[text.h1, styles.groupTitle]} accessibilityRole="header">
              {nb.noticeboard.heading}
            </Text>
            <Text style={text.meta}>{[kommune ? nb.noticeboard.eyebrow(kommune) : null, nb.noticeboard.groupMeta].filter(Boolean).join(' · ')}</Text>
            <Text style={[text.body, styles.ink2]}>{nb.noticeboard.lead}</Text>
            {authors.length ? (
              <View style={styles.faces}>
                <View style={styles.faceRow}>
                  {authors.slice(0, MAX_FACES).map((id, i) => (
                    <Face key={id} id={id} first={i === 0} />
                  ))}
                </View>
                <Text style={[text.meta, styles.flex]}>{nb.noticeboard.authors(authors.length)}</Text>
              </View>
            ) : null}
            {/* «Mer i nabolaget» lives here as a menu since 2026-11-16 (it was a tile grid on Fellesskap) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${nb.felles.more.title}. ${nb.felles.more.sub}`}
              onPress={() => setMoreOpen(true)}
              style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}
              testID="tavle-more"
            >
              <View style={styles.moreIcon}>
                <Icon name="sparkle" size={16} color={colors.lime} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.moreTitle}>{nb.felles.more.title}</Text>
                <Text style={text.meta} numberOfLines={1}>
                  {nb.noticeboard.moreSub}
                </Text>
              </View>
              <Icon name="right" size={18} color={colors.faint} />
            </Pressable>
          </View>
        </FadeUp>

        <FadeUp delay={60} style={[styles.feedCard, styles.composer, shadow.card]}>
          <Pressable accessibilityRole="button" accessibilityLabel={nb.noticeboard.write} onPress={() => openCompose({})} style={styles.composeRow}>
            <Avatar initials={me.initials} uri={me.avatarUrl} seed={me.id} size={42} ring={false} />
            <View style={styles.composeBox}>
              <Text style={styles.composePh} numberOfLines={1}>
                {nb.noticeboard.composerPh(me.displayName.split(' ')[0])}
              </Text>
            </View>
          </Pressable>
          <View style={styles.quick}>
            {QUICK.map((q) => (
              <Pressable key={q.key} accessibilityRole="button" accessibilityLabel={q.label} onPress={() => (q.start ? openCompose(q.start) : void photoFirst())} style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}>
                <View style={[styles.quickIcon, { backgroundColor: q.bg }]}>
                  <Icon name={q.icon} size={17} color={q.fg} />
                </View>
                <Text style={styles.quickText} numberOfLines={1}>
                  {q.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </FadeUp>

        {/* «Ukas bilde» lives here, on the board, since 2026-11-15 */}
        <AreaPhotoCard kommune={kommune} inset={FEED_INSET} />

        {/* «Skjer i nærheten» and Utlån live here since 2026-11-16 (they were on Fellesskap) */}
        {upcomingEvents(all, now).length ? (
          <>
            <SectionHeader
              icon="cal"
              iconBg={colors.limeTint}
              iconColor={colors.limeDeep}
              title={nb.events.calTitle}
              subtitle={nb.events.calCount(upcomingEvents(all, now).length)}
              actionLabel={nb.events.calSeeAll}
              // already on the board: «Se alle» shows the arrangementer in the list below, and scrolls there
              onAction={() => {
                setFilter('EVENT');
                scrollRef.current?.scrollTo({ y: Math.max(0, storiesY.current - 8), animated: true });
              }}
            />
            <EventsCalendar posts={all} now={now} />
          </>
        ) : null}
        <View style={[styles.lendCard, { paddingHorizontal: FEED_INSET }]}>
          <CommunityLinkCard
            tone="lime"
            icon="montering"
            eyebrow={nb.lend.cardEyebrow}
            title={nb.lend.cardTitle}
            body={nb.lend.cardBody}
            cta={nb.lend.cardCta}
            a11y={`${nb.lend.cardTitle}. ${nb.lend.cardBody}`}
            onPress={() => safePush('/utlan')}
            testID="tavle-utlan"
          />
        </View>

        <View onLayout={(e) => (storiesY.current = e.nativeEvent.layout.y)}>
          <FadeUp delay={80} style={styles.stories}>
            <TypeStories value={filter} counts={counts} onChange={setFilter} />
          </FadeUp>
        </View>

        <FadeUp delay={100} style={[styles.px, styles.mt8]}>
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.mute} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={nb.noticeboard.searchPh}
              placeholderTextColor={colors.mute}
              accessibilityLabel={nb.noticeboard.searchA11y}
              returnKeyType="search"
              style={[text.input, styles.searchInput]}
              testID="notice-search"
            />
            {q ? (
              <Pressable accessibilityRole="button" accessibilityLabel={nb.noticeboard.searchClear} onPress={() => setQ('')} style={styles.searchClr}>
                <Icon name="x" size={16} color={colors.ink2} />
              </Pressable>
            ) : null}
          </View>
          {query ? <Text style={[text.meta, styles.searchHits]}>{nb.noticeboard.searchHits(shown.length)}</Text> : null}
        </FadeUp>

        {myNabolag.length ? (
          <View style={[styles.px, styles.scope]} accessibilityRole="radiogroup" accessibilityLabel={nb.noticeboard.scopeLabel}>
            {[false, true].map((mine) => {
              const on = mineOnly === mine;
              return (
                <Pressable
                  key={String(mine)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setMineOnly(mine)}
                  style={[styles.kchip, on && styles.kchipOn]}
                >
                  <Icon name={mine ? 'home' : 'globe'} size={16} color={on ? colors.white : colors.ink2} />
                  <Text style={[styles.kchipText, on && styles.white]}>{mine ? nb.noticeboard.scopeMine : nb.noticeboard.scopeAll}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.list} onLayout={onListLayout}>
          {isLoading ? (
            <View style={styles.px}>
              <RowSkeleton />
              <RowSkeleton />
            </View>
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : null}
          {/* a link to an oppslag that is gone says so, instead of quietly showing the board */}
          {!isLoading && !isError && data && focusId && focusClosed !== focusId && !focusPost ? (
            <View style={[styles.px, styles.focus]} testID="focused-gone">
              <Note icon="info">{nb.noticeboard.focusGone}</Note>
            </View>
          ) : null}
          {!isLoading && !isError && focusPost ? (
            <View onLayout={onFocusLayout}>
            <FadeUp style={styles.focus} testID="focused-oppslag">
              <View style={[styles.px, styles.focusHead]}>
                <Icon name="pinned" size={15} color={colors.limeDeep} />
                <Text style={[styles.focusLabel, styles.flex1]}>{nb.noticeboard.focusLabel}</Text>
                <Pressable accessibilityRole="button" onPress={() => setFocusClosed(focusPost.id)} hitSlop={10} style={styles.focusClose}>
                  <Text style={styles.focusCloseText}>{nb.noticeboard.focusClose}</Text>
                </Pressable>
              </View>
              <View style={styles.focusRing}>{card(focusPost)}</View>
            </FadeUp>
            </View>
          ) : null}
          {isLoading || isError ? null : feed.length ? (
            feed.map((p) => (
              <Animated.View key={p.id} entering={p.id === freshId ? FadeInUp.springify().damping(14) : undefined} layout={LinearTransition.duration(300)}>
                {card(p)}
              </Animated.View>
            ))
          ) : query ? (
            <FadeUp style={[styles.empty, styles.px]}>
              <EmptyScene icon="search" tone="cyan" />
              <Text style={styles.emptyTitle}>{nb.noticeboard.searchNone(q.trim())}</Text>
              <Text style={text.meta}>{nb.noticeboard.searchNoneSub}</Text>
              <Button label={nb.noticeboard.searchClear} variant="ghost" size="sm" block={false} align="center" onPress={() => setQ('')} />
            </FadeUp>
          ) : (
            <FadeUp style={[styles.empty, styles.px]}>
              <EmptyScene icon="pinned" tone="cyan" />
              <Text style={styles.emptyTitle}>{nb.noticeboard.emptyTitle}</Text>
              {kommune ? <Text style={text.meta}>{nb.noticeboard.emptyText(kommune)}</Text> : null}
              <Button label={nb.noticeboard.write} variant="ink" size="sm" block={false} align="center" onPress={() => openCompose({})} />
            </FadeUp>
          )}
          {kommune ? (
            <View style={styles.scopeFoot}>
              <View style={styles.scopePill}>
                <Icon name="pin" size={13} color={colors.ink2} />
                <Text style={styles.scopeText} selectable={false}>
                  {nb.noticeboard.scope(kommune)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
        <View style={styles.bottom} />
      </Screen>

      <ComposeSheet
        key={composeKey}
        visible={!!compose}
        startType={compose?.type}
        startPhoto={compose?.photo}
        startTitle={composeKey === 0 && typeof tittel === 'string' ? tittel : undefined}
        startBody={composeKey === 0 && typeof tekst === 'string' ? tekst : undefined}
        startAudience={composeKey === 0 && typeof nabolag === 'string' ? nabolag : undefined}
        kommune={kommune}
        place={me.place || kommune}
        me={author}
        onClose={() => setCompose(null)}
        onLend={(title) => {
          setCompose(null);
          setLendForm({ title });
        }}
        onPublished={(post) => {
          setCompose(null);
          if (filter !== 'ALL' && filter !== noticeType(post)) setFilter('ALL');
          setFreshId(post.id);
        }}
      />
      {lendForm ? <LendItemForm userId={me.id} kommune={kommune} startTitle={lendForm.title} onClose={() => setLendForm(null)} /> : null}
      {lendEditId ? <LendItemFormById id={lendEditId} userId={me.id} onClose={() => setLendEditId(null)} /> : null}
      {/* the same sheet, prefilled, for the owner's "Rediger" */}
      <ComposeSheet
        key={editing?.id ?? 'edit'}
        visible={!!editing}
        editing={editing ?? undefined}
        kommune={kommune}
        place={me.place || kommune}
        me={author}
        onClose={() => setEditing(null)}
        onPublished={() => setEditing(null)}
      />
      <CommentsSheet
        post={(data ?? []).find((p) => p.id === commentsFor) ?? null}
        me={author}
        prefill={prefill}
        onClose={() => {
          setCommentsFor(null);
          setPrefill('');
        }}
      />
      <Sheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.title}>
        {menuFor ? (
          <ListGroup>
            {menuFor.authorProfileId === me.id ? (
              <>
                <ListRow
                  icon="edit"
                  title={nb.noticeboard.menuEdit}
                  onPress={() => closeMenu(() => (menuFor.kind === 'TOOL_LEND' && menuFor.lendItemId ? setLendEditId(menuFor.lendItemId) : setEditing(menuFor)))}
                />
                <ListRow
                  icon={menuFor.doneAt ? 'undo' : 'check'}
                  title={menuFor.doneAt ? nb.noticeboard.menuReopen : nb.noticeboard.menuDone}
                  onPress={() => closeMenu(() => toggleDone(menuFor))}
                />
                <ListRow icon="trash" iconBg={colors.dangerTint} iconColor={colors.danger} title={nb.noticeboard.remove} onPress={() => closeMenu(() => void remove(menuFor.id))} />
              </>
            ) : (
              <ListRow icon="flag" title={nb.noticeboard.menuReport} onPress={() => closeMenu(() => safePush(`/rapporter?profil=${menuFor.authorProfileId}`))} />
            )}
            <HostPinRow
              post={menuFor}
              onPin={(on) =>
                closeMenu(() =>
                  pin.mutate(
                    { noticeId: menuFor.id, pin: on },
                    {
                      onSuccess: () => toast.success(on ? nb.felles.nabolag.pinnedToast : nb.felles.nabolag.unpinnedToast, { bottom: 100 }),
                      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 100 }),
                    },
                  ),
                )
              }
            />
          </ListGroup>
        ) : null}
      </Sheet>
      <MoreMenuSheet visible={moreOpen} onClose={() => setMoreOpen(false)} youth={me.isYouth} kommune={kommune} />
      {shareEvent ? <ShareEventSheet post={shareEvent} visible onClose={() => setShareEvent(null)} /> : null}
      <ImageViewer images={viewer ? photosOf(viewer.post) : []} index={viewer?.index ?? 0} caption={viewer?.post.title} onClose={() => setViewer(null)} />
      {mapOpen ? <ListingsMap listings={[]} notices={all} onClose={() => setMapOpen(false)} /> : null}
    </>
  );
}

function Face({ id, first }: { id: string; first: boolean }) {
  const { data } = useProfile(id);
  return (
    <View style={[styles.face, !first && styles.faceOver]}>
      <Avatar initials={data?.initials ?? '·'} uri={data?.avatarUrl} seed={id} size={32} ring={false} />
    </View>
  );
}

type Me = { id: string; name: string; initials: string; avatarUrl?: string };

/**
 * "Svar": public comments under one oppslag, like the comments on a post in Instagram (2026-11-10): the
 * svar first, oldest at the top, and the writing field pinned at the bottom with your own picture.
 */
function CommentsSheet({ post, me, prefill, onClose }: { post: NoticeboardPost | null; me: Me; prefill?: string; onClose: () => void }) {
  const add = useAddNoticeComment(post?.id ?? '');
  const [draft, setDraft] = useState('');
  // «Sett den?»: the answer starts with a few words written for you, once per opened oppslag
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (post && prefill && prefilledFor !== post.id) {
    setPrefilledFor(post.id);
    setDraft(prefill);
  }
  if (!post && prefilledFor) setPrefilledFor(null);
  // «Svar» under one svar: the answer goes under that thread (one level, see 0099)
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const close = () => {
    setReplyTo(null);
    onClose();
  };

  const send = () => {
    const t = draft.trim();
    if (!t || add.isPending || !post) return;
    add.mutate(replyTo ? { body: t, parentId: replyTo.id } : t, {
      onSuccess: () => {
        setDraft('');
        setReplyTo(null);
        haptics.light();
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
    });
  };

  const footer = !post ? null : post.doneAt ? (
    <Note icon="check">{nb.noticeboard.doneNote}</Note>
  ) : (
    <View style={styles.cfoot}>
      {replyTo ? (
        <View style={styles.replyChip}>
          <Icon name="reply" size={14} color={colors.limeDeep} />
          <Text style={styles.replyChipText} numberOfLines={1}>
            {nb.noticeboard.replyingTo(replyTo.name)}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={nb.noticeboard.replyCancel} onPress={() => setReplyTo(null)} hitSlop={10} style={styles.replyChipX}>
            <Icon name="x" size={14} color={colors.ink2} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.cinputRow}>
        <Avatar initials={me.initials} uri={me.avatarUrl} seed={me.id} size={36} ring={false} />
        <Input
          value={draft}
          onChangeText={(v) => setDraft(v.slice(0, COMMENT_MAX))}
          placeholder={replyTo ? nb.noticeboard.replyingTo(replyTo.name) : nb.noticeboard.commentPh}
          multiline
          accessibilityLabel={nb.noticeboard.commentLabel}
          containerStyle={styles.flex}
          style={styles.cinput}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.noticeboard.commentSend}
          accessibilityState={{ disabled: !draft.trim() || add.isPending }}
          disabled={!draft.trim() || add.isPending}
          onPress={send}
          style={({ pressed }) => [styles.csend, !draft.trim() && styles.csendOff, pressed && styles.pressed]}
          testID="comment-send"
        >
          {add.isPending ? <Spinner size={18} color={colors.ink} /> : <Icon name="send" size={18} color={draft.trim() ? colors.ink : colors.mute} />}
        </Pressable>
      </View>
      {draft.length > COMMENT_MAX - 100 ? <Text style={[text.hint, styles.ccount]}>{`${draft.length}/${COMMENT_MAX}`}</Text> : null}
    </View>
  );

  return (
    <Sheet visible={!!post} onClose={close} title={nb.noticeboard.commentsTitle} subtitle={post?.title} titleSize="h2" scroll heightRatio={0.85} footer={footer}>
      {post ? (
        <Comments
          post={post}
          meId={me.id}
          onReplyTo={setReplyTo}
          onReport={(c) => {
            close();
            safePush(`/rapporter?kommentar=${c.id}&profil=${c.authorProfileId}`);
          }}
        />
      ) : null}
    </Sheet>
  );
}

function Comments({
  post,
  meId,
  onReplyTo,
  onReport,
}: {
  post: NoticeboardPost;
  meId: string;
  onReplyTo: (to: { id: string; name: string }) => void;
  onReport: (c: NoticeComment) => void;
}) {
  const { data, isLoading, isError, refetch } = useNoticeComments(post.id);
  const del = useDeleteNoticeComment(post.id);
  const [now] = useState(() => Date.now());
  const list = useMemo(() => data ?? [], [data]);
  const mineOppslag = post.authorProfileId === meId;
  // «Anbefalinger» (0108): answers can be liked, and the most liked come first
  const recommend = post.topic === 'RECOMMEND';
  const likesData = useCommentLikes(post.id, recommend).data;
  const likes = useMemo(() => likesData ?? {}, [likesData]);
  const toggleLike = useToggleCommentLike(post.id);
  // top-level svar in order, each with its answers under it
  const threads = useMemo(() => {
    const top = list.filter((c) => !c.parentId || !list.some((x) => x.id === c.parentId));
    const ordered = recommend ? [...top].sort((a, b) => (likes[b.id]?.count ?? 0) - (likes[a.id]?.count ?? 0)) : top;
    return ordered.map((c) => ({ c, answers: list.filter((x) => x.parentId === c.id) }));
  }, [list, recommend, likes]);

  if (isLoading) return <RowSkeleton />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (!list.length) {
    return (
      <View style={styles.cemptyWrap}>
        <View style={styles.cemptyRing}>
          <View style={styles.cemptyDisc}>
            <Icon name="msg" size={26} color={colors.cyanDeep} />
          </View>
        </View>
        <Text style={styles.emptyTitle}>{nb.noticeboard.commentsEmptyTitle}</Text>
        <Text style={[text.meta, styles.cempty]}>{nb.noticeboard.noComments}</Text>
      </View>
    );
  }
  return (
    <View style={styles.cwrap}>
      <Note icon="eye">{nb.noticeboard.commentPublic}</Note>
      {threads.map(({ c, answers }) => (
        <View key={c.id} style={styles.thread}>
          {[c, ...answers].map((x) => (
            <CommentRow
              key={x.id}
              comment={x}
              now={now}
              nested={x !== c}
              byOwner={x.authorProfileId === post.authorProfileId}
              canDelete={x.authorProfileId === meId || mineOppslag}
              onDelete={() => del.mutate(x.id, { onError: () => toast.error(nb.toast.genericError) })}
              onReport={x.authorProfileId === meId ? undefined : () => onReport(x)}
              onReply={post.doneAt ? undefined : (name) => onReplyTo({ id: c.id, name })}
              like={recommend && x === c ? { count: likes[c.id]?.count ?? 0, mine: !!likes[c.id]?.mine, top: c === threads[0]?.c && (likes[c.id]?.count ?? 0) > 0 } : undefined}
              onLike={recommend && x === c ? () => toggleLike.mutate(c.id) : undefined}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** One svar as a bubble, with the time and «Svar» under it (Facebook). */
function CommentRow({
  comment: c,
  now,
  nested = false,
  byOwner,
  canDelete,
  onDelete,
  onReport,
  onReply,
  like,
  onLike,
}: {
  /** «Anbefalinger»: likes on a top-level svar */
  like?: { count: number; mine: boolean; top: boolean };
  onLike?: () => void;
  comment: NoticeComment;
  now: number;
  /** an answer to a svar: indented under it */
  nested?: boolean;
  byOwner: boolean;
  canDelete: boolean;
  onDelete: () => void;
  /** someone else's comment can be reported */
  onReport?: () => void;
  /** «Svar» under it; not on an avsluttet oppslag */
  onReply?: (name: string) => void;
}) {
  const { data: author } = useProfile(c.authorProfileId);
  const name = author?.displayName?.split(' ')[0] ?? '';
  return (
    <View style={[styles.crow, nested && styles.crowNested]}>
      <Avatar initials={author?.initials ?? '·'} uri={author?.avatarUrl} seed={c.authorProfileId} size={nested ? 30 : 36} ring={false} />
      <View style={styles.flex}>
        <View style={styles.cbody}>
          <View style={styles.chead}>
            <Text style={styles.cname} numberOfLines={1}>
              {author?.displayName ?? ''}
            </Text>
            {byOwner ? (
              <View style={styles.ownerTag}>
                <Text style={styles.ownerTagText}>{nb.noticeboard.author}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.ctext}>{c.body}</Text>
        </View>
        <View style={styles.cunder}>
          <Text style={styles.ctime}>{postedAgo(c.createdAt, new Date(now))}</Text>
          {like && onLike ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: like.mine }}
              accessibilityLabel={nb.felles.topics.likeA11y(like.count)}
              onPress={onLike}
              hitSlop={10}
              style={styles.clike}
            >
              <Icon name="thumb" size={13} color={like.mine ? colors.limeDeep : colors.mute} />
              <Text style={[styles.creplyText, like.mine && { color: colors.limeDeep }]}>{like.count ? String(like.count) : nb.felles.topics.likeAnswer}</Text>
            </Pressable>
          ) : null}
          {like?.top ? <Text style={styles.ctop}>{nb.felles.topics.topAnswer}</Text> : null}
          {onReply ? (
            <Pressable accessibilityRole="button" accessibilityLabel={nb.noticeboard.replyToA11y(author?.displayName ?? '')} onPress={() => onReply(name)} hitSlop={10} style={styles.creply}>
              <Text style={styles.creplyText}>{nb.noticeboard.replyTo}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {canDelete ? (
        <IconButton icon="trash" variant="ghost" iconSize={16} iconColor={colors.mute} accessibilityLabel={nb.noticeboard.commentDelete} onPress={onDelete} />
      ) : null}
      {onReport ? (
        <IconButton icon="flag" variant="ghost" iconSize={16} iconColor={colors.mute} accessibilityLabel={nb.noticeboard.commentReport} onPress={onReport} />
      ) : null}
    </View>
  );
}

/**
 * «Nytt oppslag», shaped like «Lag innlegg» (Facebook, 2026-11-10): who you write as and who sees it at the
 * top, the type as coloured chips, then a big title and the text without boxes around them, the photos, and
 * «Publiser oppslag» pinned at the bottom.
 */
function ComposeSheet({
  visible,
  editing,
  startType,
  startPhoto,
  startTitle,
  startBody,
  startAudience,
  kommune,
  place,
  me,
  onClose,
  onLend,
  onPublished,
}: {
  /** «Lån ut» picked: the thing gets the Utlån form instead (0107) */
  onLend?: (title: string) => void;
  /** a quick action under the writing box picked the type already */
  startType?: NoticeType;
  /** «Bilde» under the writing box picked it already */
  startPhoto?: Photo;
  startTitle?: string;
  startBody?: string;
  /** one of my nabolag, chosen already */
  startAudience?: string;
  visible: boolean;
  /** set → the sheet edits this oppslag instead of making a new one */
  editing?: NoticeboardPost;
  kommune: string;
  place: string;
  me: Me;
  onClose: () => void;
  onPublished: (post: NoticeboardPost) => void;
}) {
  const userId = me.id;
  const create = useCreateNoticeboardPost();
  const update = useUpdateNoticeboardPost();
  const [type, setType] = useState<NoticeType | null>(editing ? noticeType(editing) : (startType ?? (startTitle ? 'GENERAL' : null)));
  // a newer kind (0108): stored as GENERAL + topic
  const [topic, setTopic] = useState<NoticeTopic | null>(editing?.topic ?? null);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const myOrgs = useMyOrganisations(!editing).data ?? [];
  // samkjøring is never offered to a youth account (rule 5; the database refuses it too)
  const youth = useCurrentUser().isYouth;
  const [asOrg, setAsOrg] = useState<string | null>(null);
  const isEventType = type === 'EVENT';
  const [eventKind, setEventKind] = useState<EventType>('DUGNAD');
  // «Avstemning» (0101): only on a new oppslag, like the arrangement itself
  const [pollOn, setPollOn] = useState(false);
  const [pollOpts, setPollOpts] = useState<string[]>(['', '']);
  const pollFilled = pollOpts.map((o) => o.trim()).filter(Boolean);
  const pollBad = pollOn && pollFilled.length < POLL_MIN;
  const [title, setTitle] = useState(editing?.title ?? startTitle ?? '');
  const [body, setBody] = useState(editing?.body ?? startBody ?? '');
  const [eventDay, setEventDay] = useState<Date | null>(null);
  const [eventTime, setEventTime] = useState('10:00');
  const [photos, setPhotos] = useState<Photo[]>(() => {
    if (editing) return (editing.imageUrls ?? []).map((url, i) => ({ url, path: editing.imagePaths?.[i] ?? url }));
    return startPhoto ? [startPhoto] : [];
  });
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [shake, setShake] = useState(0);
  // who can read it: null = the whole kommune, or one of my nabolag
  const myNabolag = useMyNabolag(!!userId).data ?? [];
  const [audience, setAudience] = useState<string | null>(startAudience ?? null);
  const [pickAudience, setPickAudience] = useState(false);
  const target = myNabolag.find((n) => n.id === audience);
  const audienceLabel = target ? nb.noticeboard.audienceNabolag(target.place) : nb.noticeboard.audienceAll(kommune);

  const titleBad = title.trim().length < 4;
  const textBad = body.trim().length < 10;

  const reset = () => {
    setType(null);
    setTitle('');
    setBody('');
    setPhotos([]);
    setTried(false);
    setAudience(null);
    setEventDay(null);
    setEventKind('DUGNAD');
    setPollOn(false);
    setPollOpts(['', '']);
  };

  const addPhoto = async () => {
    if (!userId || busy || photos.length >= MAX_PHOTOS) return;
    setBusy(true);
    try {
      const res = await pickAndUpload({ bucket: 'listing-images', folder: userId, source: 'library' });
      if (res) setPhotos((list) => [...list, { path: res.path, url: res.publicUrl }].slice(0, MAX_PHOTOS));
    } catch (e) {
      toast.error(serverMessage(e, nb.toast.genericError));
    } finally {
      setBusy(false);
    }
  };

  const publish = () => {
    if (!type || titleBad || textBad || (isEventType && !eventDay && !editing) || (!editing && pollBad)) {
      setTried(true);
      if (!type) setShake((n) => n + 1);
      haptics.warning();
      return;
    }
    // an arrangement is a GENERAL oppslag with a date and a type, so older apps still show it (0090, 0101)
    const kind: NoticeKind = type === 'EVENT' ? 'GENERAL' : type;
    if (editing) {
      update.mutate(
        { id: editing.id, patch: { kind, title: title.trim(), body: body.trim(), imagePaths: photos.map((p) => p.path) } },
        {
          onSuccess: (post) => {
            haptics.success();
            toast.success(nb.noticeboard.savedEdit, { bottom: 100 });
            onPublished(post);
          },
          onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
        },
      );
      return;
    }
    create.mutate(
      {
        kind,
        title: title.trim(),
        body: body.trim(),
        place,
        municipality: kommune,
        imagePath: photos[0]?.path,
        imagePaths: photos.map((p) => p.path),
        neighbourhoodId: target?.id,
        ...(isEventType && eventDay ? { isDugnad: eventKind === 'DUGNAD', eventType: eventKind, eventAt: eventIso(eventDay, eventTime) } : {}),
        ...(isEventType && repeatWeekly ? { repeatWeekly: true } : {}),
        ...(isEventType && asOrg ? { organisationId: asOrg } : {}),
        ...(pollOn && pollFilled.length >= POLL_MIN ? { pollOptions: pollFilled } : {}),
        ...(topic && type === 'GENERAL' ? { topic } : {}),
      },
      {
        onSuccess: (post) => {
          haptics.success();
          toast.success(nb.noticeboard.published(target?.place ?? kommune), { bottom: 100 });
          reset();
          onPublished(post);
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );
  };

  const footer = (
    <Button label={editing ? nb.noticeboard.saveEdit : nb.noticeboard.publish} variant="lime" size="lg" icon="send" loading={create.isPending || update.isPending} onPress={publish} />
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? nb.noticeboard.editTitle : nb.noticeboard.newPost} titleSize="h2" scroll heightRatio={0.92} footer={footer}>
      {/* who writes, and who sees it */}
      <View style={styles.author}>
        <Avatar initials={me.initials} uri={me.avatarUrl} seed={me.id} size={46} ring={false} />
        <View style={styles.flex}>
          <Text style={styles.authorName} numberOfLines={1}>
            {me.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${nb.noticeboard.audienceLabel} ${audienceLabel}`}
            accessibilityState={{ expanded: pickAudience }}
            disabled={!!editing || !myNabolag.length}
            onPress={() => setPickAudience((v) => !v)}
            style={styles.audPill}
          >
            <Icon name={target ? 'home' : 'globe'} size={13} color={colors.ink2} />
            <Text style={styles.audText} numberOfLines={1}>
              {editing ? nb.noticeboard.shownIn(editing.municipality || kommune) : audienceLabel}
            </Text>
            {!editing && myNabolag.length ? <Icon name={pickAudience ? 'up' : 'down'} size={13} color={colors.ink2} /> : null}
          </Pressable>
        </View>
      </View>
      {pickAudience && !editing ? (
        <View style={[styles.kinds, styles.mt12]} accessibilityRole="radiogroup" accessibilityLabel={nb.noticeboard.audienceLabel}>
          {[null, ...myNabolag].map((n) => {
            const on = (n?.id ?? null) === audience;
            const label = n ? nb.noticeboard.audienceNabolag(n.place) : nb.noticeboard.audienceAll(kommune);
            return (
              <Pressable
                key={n?.id ?? 'all'}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={label}
                onPress={() => {
                  setAudience(n?.id ?? null);
                  setPickAudience(false);
                }}
                style={[styles.kchip, on && styles.kchipOn]}
              >
                <Icon name={n ? 'home' : 'globe'} size={16} color={on ? colors.white : colors.ink2} />
                <Text style={[styles.kchipText, on && styles.white]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {!editing && !myNabolag.length ? <Text style={[text.hint, styles.mt8]}>{nb.noticeboard.audienceNoNabolag}</Text> : null}

      <Text style={[text.label, styles.mt18, styles.mb10]}>{nb.noticeboard.composeWhat}</Text>
      <Shake shakeKey={shake}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll} contentContainerStyle={styles.typeRow}>
          {NOTICE_TYPES.map((k) => {
            const on = type === k;
            const st = NOTICE_STYLE[k];
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={nb.noticeboard.kinds[k]}
                onPress={() => {
                  setTopic(null);
                  if (k === 'TOOL_LEND' && onLend && !editing) onLend(title.trim());
                  else setType(k);
                }}
                style={[styles.tchip, on && { backgroundColor: st.bg, borderColor: st.fg }]}
              >
                <View style={[styles.tchipIcon, { backgroundColor: on ? colors.white : st.bg }]}>
                  <Icon name={st.icon} size={15} color={st.fg} />
                </View>
                <Text style={[styles.tchipText, on && { color: st.fg }]}>{nb.noticeboard.kinds[k]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Shake>
      {tried && !type ? <ErrorText shakeKey={shake}>{nb.noticeboard.errKind}</ErrorText> : null}

      {/* «Flere typer» (0108): savnet dyr, overskuddsmat, samkjøring … – new oppslag only */}
      {!editing ? (
        <>
          <Text style={[text.hint, styles.mt12, styles.mb10]}>{nb.felles.topics.label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll} contentContainerStyle={styles.typeRow}>
            {NOTICE_TOPICS.filter((tp) => !(youth && ADULT_ONLY_TOPICS.includes(tp))).map((tp) => {
              const on = topic === tp;
              const st = TOPIC_STYLE[tp];
              return (
                <Pressable
                  key={tp}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={nb.felles.topics.names[tp]}
                  onPress={() => {
                    setTopic(on ? null : tp);
                    setType(on ? null : 'GENERAL');
                  }}
                  style={[styles.tchip, on && { backgroundColor: st.bg, borderColor: st.fg }]}
                >
                  <View style={[styles.tchipIcon, { backgroundColor: on ? colors.white : st.bg }]}>
                    <Icon name={st.icon} size={15} color={st.fg} />
                  </View>
                  <Text style={[styles.tchipText, on && { color: st.fg }]}>{nb.felles.topics.names[tp]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {topic ? <Text style={[text.meta, styles.mt8]}>{nb.felles.topics.hints[topic]}</Text> : null}
        </>
      ) : null}

      {!editing && isEventType ? (
        <View style={styles.dugnadBox}>
          <Text style={text.label}>{nb.events.typeLabel}</Text>
          <View style={styles.eventKinds}>
            {EVENT_TYPES.map((k) => (
              <Chip key={k} label={nb.events.types[k]} icon={EVENT_ICON[k]} size="sm" selected={eventKind === k} onPress={() => setEventKind(k)} />
            ))}
          </View>
          <Text style={text.meta}>{nb.events.composeSub}</Text>
          <View style={styles.dugnadWhen}>
            <DateField label={nb.events.date} value={eventDay} onChange={setEventDay} minToday />
            {tried && !eventDay ? <ErrorText>{nb.events.dateMissing}</ErrorText> : null}
            <TimeField label={nb.events.time} value={eventTime} onChange={setEventTime} />
          </View>
          <View style={styles.repeatRow}>
            <View style={styles.flex}>
              <Text style={text.label}>{nb.felles.event.repeat}</Text>
              <Text style={text.hint}>{nb.felles.event.repeatSub}</Text>
            </View>
            <Toggle value={repeatWeekly} onValueChange={setRepeatWeekly} accessibilityLabel={nb.felles.event.repeat} />
          </View>
          {myOrgs.length ? (
            <View style={styles.eventKinds}>
              <Text style={[text.label, styles.orgLabel]}>{nb.felles.orgs.postAs}</Text>
              <Chip label={nb.felles.orgs.postAsMe} icon="user" size="sm" selected={!asOrg} onPress={() => setAsOrg(null)} />
              {myOrgs.map((o) => (
                <Chip key={o.id} label={o.name} icon="award" size="sm" selected={asOrg === o.id} onPress={() => setAsOrg(o.id)} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* the post itself: no boxes, like writing a post */}
      <View style={styles.writeCard}>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder={topic ? nb.felles.topics.titlePh[topic] : nb.noticeboard.composeTitlePh}
          maxLength={TITLE_MAX}
          accessibilityLabel={nb.noticeboard.titleLabel}
          style={styles.titleInput}
        />
        {tried && titleBad ? <ErrorText>{nb.noticeboard.errTitle}</ErrorText> : null}
        <View style={styles.writeLine} />
        <Input
          value={body}
          onChangeText={setBody}
          placeholder={nb.noticeboard.composeBodyPh(me.name.split(' ')[0])}
          maxLength={TEXT_MAX}
          multiline
          accessibilityLabel={nb.noticeboard.textLabel}
          style={styles.bodyInput}
        />
        {tried && textBad ? <ErrorText>{nb.noticeboard.errText}</ErrorText> : null}
        <Text style={[text.counter, styles.writeCount]}>{`${body.length}/${TEXT_MAX}`}</Text>
      </View>

      {pollOn && !editing ? (
        <View style={styles.pollBox}>
          <View style={styles.pollHead}>
            <Icon name="chart" size={16} color={colors.cyanDeep} />
            <Text style={[text.label, styles.flex]}>{nb.poll.title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={nb.poll.remove} onPress={() => setPollOn(false)} hitSlop={10} style={styles.pollX}>
              <Icon name="x" size={16} color={colors.ink2} />
            </Pressable>
          </View>
          {pollOpts.map((o, i) => (
            <View key={i} style={styles.pollRow}>
              <Input
                value={o}
                onChangeText={(v) => setPollOpts((list) => list.map((x, j) => (j === i ? v : x)))}
                placeholder={nb.poll.optionPh(i + 1)}
                maxLength={POLL_OPTION_MAX}
                accessibilityLabel={nb.poll.option(i + 1)}
                style={styles.flex}
              />
              {pollOpts.length > POLL_MIN ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={nb.poll.removeOption(i + 1)}
                  onPress={() => setPollOpts((list) => list.filter((_, j) => j !== i))}
                  hitSlop={8}
                  style={styles.pollX}
                >
                  <Icon name="minus" size={16} color={colors.ink2} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {pollOpts.length < POLL_MAX ? (
            <TextLink label={nb.poll.addOption} icon="plus" onPress={() => setPollOpts((list) => [...list, ''])} />
          ) : null}
          {tried && pollBad ? <ErrorText>{nb.poll.errOptions}</ErrorText> : null}
        </View>
      ) : null}

      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos} style={styles.mt14}>
          {photos.map((p, i) => (
            <View key={p.path} style={styles.photoBig}>
              <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
              {i === 0 ? (
                <View style={styles.coverTag}>
                  <Text style={styles.coverTagText}>{nb.noticeboard.coverPhoto}</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${nb.noticeboard.removePhoto} ${i + 1}`}
                onPress={() => setPhotos((list) => list.filter((x) => x.path !== p.path))}
                hitSlop={8}
                style={styles.photoX}
              >
                <Icon name="x" size={14} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {/* «Legg til i oppslaget» */}
      <View style={styles.addBar}>
        <Text style={styles.addBarText}>{nb.noticeboard.composeAdd}</Text>
        <Text style={text.hint}>{photos.length ? nb.noticeboard.photosCount(photos.length, MAX_PHOTOS) : nb.noticeboard.optional}</Text>
        {!editing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nb.poll.addA11y}
            accessibilityState={{ selected: pollOn }}
            onPress={() => setPollOn((v) => !v)}
            style={({ pressed }) => [styles.addBtn, pollOn && styles.addPollOn, pressed && styles.pressed]}
          >
            <Icon name="chart" size={20} color={pollOn ? colors.white : colors.cyanDeep} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.noticeboard.addPhoto}
          disabled={photos.length >= MAX_PHOTOS}
          onPress={addPhoto}
          style={({ pressed }) => [styles.addBtn, photos.length >= MAX_PHOTOS && styles.addBtnOff, pressed && styles.pressed]}
        >
          {busy ? <Spinner size={18} color={colors.cyanDeep} /> : <Icon name="image" size={20} color={colors.cyanDeep} />}
        </Pressable>
      </View>

      <View style={styles.where}>
        <View style={styles.whereIcon}>
          <Icon name={target ? 'home' : 'globe'} size={16} color={colors.ink} />
        </View>
        <Text style={styles.whereText}>
          <Text style={styles.whereStrong}>{target ? nb.noticeboard.shownInNabolag(target.place) : nb.noticeboard.shownIn(kommune)}</Text>
          {`\n${nb.noticeboard.approxOnly}`}
        </Text>
      </View>
    </Sheet>
  );
}

/** «Fest øverst i nabolaget» for a vert (0108); nothing for everyone else. */
function HostPinRow({ post, onPin }: { post: NoticeboardPost; onPin: (on: boolean) => void }) {
  const details = useNabolagDetails(post.neighbourhoodId).data;
  if (!post.neighbourhoodId || !details?.iAmHost) return null;
  return (
    <ListRow icon="pinned" title={post.pinnedAt ? nb.felles.nabolag.unpin : nb.felles.nabolag.pin} onPress={() => onPin(!post.pinnedAt)} />
  );
}

const styles = StyleSheet.create({
  focus: { gap: 8, marginBottom: 6 },
  lendCard: { marginTop: 14 },
  focusHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  focusLabel: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.3, textTransform: 'uppercase', color: colors.limeDeep },
  focusClose: { minHeight: 44, justifyContent: 'center' },
  focusCloseText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.ink, textDecorationLine: 'underline' },
  focusRing: { borderWidth: 2, borderColor: colors.lime, borderRadius: radius.card + 4, marginHorizontal: 8, paddingVertical: 4 },
  flex1: { flex: 1 },
  clike: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 },
  ctop: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.limeDeep },
  repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  orgLabel: { width: '100%' },
  dugnadBox: { marginTop: 14, padding: 14, borderRadius: radius.card, backgroundColor: colors.limeSoft, gap: 12 },
  dugnadWhen: { gap: 12 },
  headBtns: { flexDirection: 'row' },
  eventKinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pollBox: { marginTop: 14, padding: 14, borderRadius: radius.card, backgroundColor: colors.cyanTint, gap: 10 },
  pollHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pollRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pollX: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  addPollOn: { backgroundColor: colors.cyanDeep },
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  ink2: { color: colors.ink2 },
  white: { color: colors.white },
  pressed: { opacity: 0.7 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  scope: { flexDirection: 'row', gap: 8, marginTop: 6 },
  f125: { fontSize: 12.5 },
  center: { justifyContent: 'center', marginTop: 4 },
  bottom: { height: 60 },
  cover: { height: 164, overflow: 'hidden' },
  group: { marginTop: -22, marginHorizontal: FEED_INSET, padding: 16, paddingTop: 34, borderRadius: radius.card, backgroundColor: colors.surface, gap: 5 },
  groupBadge: {
    position: 'absolute',
    left: 16,
    top: -26,
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: { fontSize: 25, lineHeight: 29 },
  faces: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  faceRow: { flexDirection: 'row' },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  moreIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  moreTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  face: { borderRadius: 18, borderWidth: 2, borderColor: colors.white, backgroundColor: colors.white },
  faceOver: { marginLeft: -10 },
  feedCard: { marginHorizontal: FEED_INSET, borderRadius: radius.card, backgroundColor: colors.surface },
  composer: { marginTop: 10, padding: 12, gap: 10 },
  composeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  composeBox: { flex: 1, minWidth: 0, height: 44, borderRadius: radius.pill, backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: 16 },
  composePh: { fontFamily: fonts.body, fontSize: 15, color: colors.mute },
  quick: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line2, paddingTop: 8 },
  quickBtn: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  quickIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickText: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink2 },
  chips: { gap: 8, paddingHorizontal: FEED_INSET, paddingTop: 2, paddingBottom: 6 },
  chip: {
    height: 42,
    paddingLeft: 6,
    paddingRight: 15,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  ci: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  chipCount: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink, opacity: 0.6 },
  list: { gap: 10, marginTop: 10 },
  stories: { marginTop: 14 },
  // the last line of the feed: where these oppslag come from
  scopeFoot: { alignItems: 'center', paddingHorizontal: screenPadding, paddingTop: 10 },
  scopePill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, userSelect: 'none' },
  scopeText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink2 },
  mb10: { marginBottom: 10 },
  thread: { gap: 2 },
  cfoot: { gap: 8 },
  cinputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  csend: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  csendOff: { backgroundColor: colors.line2 },
  ccount: { textAlign: 'right' },
  cemptyWrap: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  cemptyRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.cyan, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  cemptyDisc: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  cunder: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 3, marginLeft: 12 },
  ctime: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.mute },
  ownerTag: { height: 20, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: colors.limeTint, justifyContent: 'center' },
  ownerTagText: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.limeDeep },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  audPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, marginTop: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.bg },
  audText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink2, flexShrink: 1 },
  typeRow: { gap: 8, paddingHorizontal: 20 },
  typeScroll: { marginHorizontal: -20 },
  tchip: { height: 42, paddingLeft: 5, paddingRight: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 7 },
  tchipIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tchipText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink2 },
  writeCard: { marginTop: 18, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, borderRadius: radius.card, backgroundColor: colors.bg },
  titleInput: { borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, minHeight: 50, fontFamily: fonts.display, fontSize: 21, letterSpacing: -0.3 },
  writeLine: { height: 1, backgroundColor: colors.line },
  bodyInput: { borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, minHeight: 120, fontSize: 16, lineHeight: 23, textAlignVertical: 'top' },
  writeCount: { textAlign: 'right' },
  photoBig: { width: 150, height: 150, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.track },
  addBar: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingLeft: 16, paddingRight: 6, borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.line },
  addBarText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  addBtnOff: { opacity: 0.4 },
  post: { overflow: 'hidden', paddingTop: 12 },
  postFresh: { borderWidth: 2, borderColor: colors.lime },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 4 },
  who: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postText: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 6 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kp: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: radius.pill },
  kpText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  title: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23, letterSpacing: -0.2, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  tile: { height: 250, backgroundColor: colors.track },
  grid: { gap: 3 },
  tileMain: { height: 220, backgroundColor: colors.track },
  thumbs: { flexDirection: 'row', gap: 3 },
  thumb: { flex: 1, height: 96, backgroundColor: colors.track },
  thumbMore: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  thumbMoreText: { fontFamily: fonts.display, fontSize: 22, color: colors.white },
  search: {
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 5,
  },
  searchInput: { flex: 1, height: '100%', fontSize: 15.5 },
  searchClr: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  searchHits: { marginTop: 8, marginLeft: 6 },
  still: { marginHorizontal: 14, marginTop: 12, padding: 14, gap: 12, borderRadius: radius.card, backgroundColor: colors.limeTint },
  stillTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stillIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stillTitle: { ...text.cardTitle, fontSize: 15.5, marginBottom: 2 },
  stillBtns: { flexDirection: 'row', gap: 8 },
  autoNote: { marginHorizontal: 14, marginTop: 10 },
  crowNested: { marginLeft: 46, marginTop: 8 },
  creply: { alignSelf: 'flex-start', marginTop: 4, minHeight: 24, justifyContent: 'center' },
  creplyText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink2 },
  replyChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 30, paddingLeft: 10, paddingRight: 4, borderRadius: radius.pill, backgroundColor: colors.limeTint },
  replyChipText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.limeDeep, flexShrink: 1 },
  replyChipX: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  photos: { flexDirection: 'row', gap: 8 },
  photoSm: { width: 96, height: 96, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.track },
  photoSmAdd: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoSmAddText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.mute },
  photoX: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  coverTag: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 7, height: 20, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.lime },
  coverTagText: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.ink },
  panels: { paddingHorizontal: 14, paddingTop: 12, gap: 10 },
  counts: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 10 },
  likeCount: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heartDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.heart, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', marginTop: 8, marginHorizontal: 8, paddingVertical: 2, borderTopWidth: 1, borderTopColor: colors.line2 },
  action: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: radius.m },
  actionPressed: { backgroundColor: colors.bg },
  actionText: { fontFamily: fonts.bodySemi, fontSize: 14 },
  preview: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4 },
  previewBubble: { alignSelf: 'flex-start', maxWidth: '100%', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.bg },
  previewName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  previewText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.ink },
  previewMeta: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.mute, marginTop: 3, marginLeft: 12 },
  cwrap: { gap: 14 },
  cform: { gap: 8 },
  cinput: { minHeight: 44, maxHeight: 120, paddingVertical: 11, borderRadius: 22, borderWidth: 0, backgroundColor: colors.bg, fontSize: 15 },
  cformFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cempty: { textAlign: 'center', paddingVertical: 18 },
  crow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cbody: { flex: 1, minWidth: 0, gap: 3, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.m, backgroundColor: colors.bg },
  chead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cname: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, flexShrink: 1 },
  ctext: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink },
  empty: { paddingVertical: 18, alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, textAlign: 'center' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kchip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  kchipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  kchipText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink2 },
  photoAdd: {
    height: 96,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoAddText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.mute },
  photo: { height: 110, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.track },
  photoRm: { position: 'absolute', top: 8, right: 8 },
  where: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.m, backgroundColor: colors.bg },
  whereIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  whereText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18.9, color: colors.ink2 },
  whereStrong: { fontFamily: fonts.bodyBold, color: colors.ink },
});
