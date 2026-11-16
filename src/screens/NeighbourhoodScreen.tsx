import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { NoticeboardPost } from '@/domain/types';
import nb from '@/i18n/nb';
import { NeighbourhoodHighlights } from '@/components/NeighbourhoodHighlights';
import { useListings, useNeighbourhoodInfo, useNoticeboard, useProfile, useToggleNeighbourhood } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { monthYear, postedAgo } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { serverMessage } from '@/lib/errors';
import { NabolagList } from '@/components/community/NabolagList';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { OppdragCard } from '@/components/OppdragCard';
import { EVENT_ICON, NOTICE_STYLE, eventTypeOf, noticeType } from '@/components/community/noticeKinds';
import { Image } from '@/components/ui/Image';
import {
  Avatar,
  Button,
  EmptyState,
  FadeUp,
  Icon,
  IconButton,
  ListingListSkeleton,
  Pill,
  PressableScale,
  ScaleIn,
  Screen,
  SectionHeader,
  SubHeader,
  Tabs,
  type IconName,
  pullRefreshControl,
  usePullRefresh,
} from '@/components/ui';

type Tab = 'oppslag' | 'oppdrag';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** How many oppslag / oppdrag the page shows before «Se alle». */
const PREVIEW = 4;

/**
 * Nabolag (design/screens/Nabolag.dc.html, redesigned and expanded 2026-11-10). Without `?place=` it is the
 * list of the kommune's nabolag, where you pick up to three; with it, the page of that one nabolag.
 */
export function NeighbourhoodScreen() {
  const { place, kommune } = useLocalSearchParams<{ place?: string; kommune?: string }>();
  return typeof place === 'string' && place ? (
    <NabolagPage place={place} kommuneParam={typeof kommune === 'string' ? kommune : undefined} />
  ) : (
    <NabolagList />
  );
}

/**
 * One nabolag as a group page: a cover with the neighbours' faces, the name, three numbers (members, oppslag
 * this week, open oppdrag), «Bli med» – or, for members, «Skriv oppslag» and «Inviter naboer» – the faces of
 * who is in it, the group's oppslag and the kommune's oppdrag, and the rules.
 */
function NabolagPage({ place, kommuneParam }: { place: string; kommuneParam?: string }) {
  const pull = usePullRefresh();
  const router = useRouter();
  const me = useCurrentUser();
  const scope = useLocationScope();
  // the nabolag's own kommune when the link has it (it can differ from mine after a move)
  const kommune = kommuneParam || me.municipality || scope.municipality || '';
  const { data: info, isFetched } = useNeighbourhoodInfo(kommune, place);
  const toggle = useToggleNeighbourhood(kommune, place, me.id);
  const [tab, setTab] = useState<Tab>('oppslag');
  const [now] = useState(() => Date.now());

  const tasks = useListings(kommune ? { type: 'TASK_REQUEST', municipalities: [kommune] } : undefined, 'NEWEST');
  const notices = useNoticeboard();
  const localTasks = (tasks.data ?? []).filter((l) => l.owner.id !== me.id);
  // only this nabolag's own oppslag (members can read them; the server decides)
  const localPosts = (notices.data ?? []).filter((p) => !!info?.id && p.neighbourhoodId === info.id);
  const freshPosts = localPosts.filter((p) => now - Date.parse(p.createdAt) < WEEK_MS).length;

  const name = info?.name ?? `${place} nabolag`;
  const joined = !!info?.isMember;
  const count = info?.memberCount ?? 0;
  const others = (info?.memberIds ?? []).filter((id) => id !== me.id);
  const faces = joined ? [me.id, ...others] : others;
  const rest = Math.max(0, count - faces.length);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/nabolag'));
  const invite = async () => {
    try {
      const link = Linking.createURL('/nabolag', { queryParams: { place, kommune } });
      await Share.share({ message: `${nb.neighbourhood.inviteText(name)}\n${link}`, url: link });
    } catch {
      /* the share sheet was closed */
    }
  };
  const setJoined = (on: boolean) => {
    haptics.light();
    toggle.mutate(on, {
      onSuccess: () =>
        on
          ? toast.success(nb.neighbourhood.joinedToast(name), { icon: 'users' })
          : toast.success(nb.neighbourhood.leftToast(name), {
              icon: 'logout',
              action: { label: nb.neighbourhood.undo, onPress: () => toggle.mutate(true) },
            }),
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
    });
  };
  const write = () => (info?.id ? safePush(`/oppslagstavle?ny=1&nabolag=${info.id}`) : undefined);

  if (!kommune) {
    return (
      <Screen header={<SubHeader title={nb.neighbourhood.title} onBack={back} />}>
        <EmptyState icon="home" title={nb.neighbourhood.title} body={nb.neighbourhood.noArea} actionLabel={nb.neighbourhood.pickArea} onAction={() => safePush('/profil/rediger')} />
      </Screen>
    );
  }

  if (isFetched && !info?.id) {
    return (
      <Screen header={<SubHeader title={nb.neighbourhood.title} onBack={back} />}>
        <EmptyState icon="home" title={nb.neighbourhood.notFound} actionLabel={nb.neighbourhood.allNabolag} onAction={() => router.replace('/nabolag')} />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      spacer="none"
      scrollProps={{ refreshControl: pullRefreshControl(pull) }}
      header={
        <SubHeader
          title={nb.neighbourhood.title}
          onBack={back}
          right={<IconButton icon="share" iconSize={18} accessibilityLabel={nb.neighbourhood.share} onPress={() => void invite()} />}
        />
      }
    >
      {/* cover art: the base design's houses, ring and the neighbours' faces */}
      <FadeUp style={[styles.px, styles.mt6]}>
        <View style={styles.cover} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.hill, styles.hillL]} />
          <View style={[styles.hill, styles.hillR]} />
          <View style={styles.ring} />
          <Pos style={styles.hHome}>
            <Float amp={5} delay={200}>
              <House icon="home" />
            </Float>
          </Pos>
          <Pos style={styles.hUsers}>
            <Float amp={7}>
              <House icon="users" big />
            </Float>
          </Pos>
          <Pos style={styles.hHage}>
            <Float amp={5} delay={500}>
              <House icon="hage" />
            </Float>
          </Pos>
          {others[0] ? (
            <Pos style={styles.av1}>
              <MemberAvatar id={others[0]} />
            </Pos>
          ) : null}
          {others[1] ? (
            <Pos style={styles.av2}>
              <MemberAvatar id={others[1]} />
            </Pos>
          ) : null}
          <View style={[styles.dot, styles.dotLime]} />
          <View style={[styles.dot, styles.dotBlue]} />
          {joined ? (
            <ScaleIn style={styles.coverBadge}>
              <Icon name="check" size={13} color={colors.ink} />
              <Text style={styles.coverBadgeText}>{nb.neighbourhood.member}</Text>
            </ScaleIn>
          ) : null}
        </View>
      </FadeUp>

      {/* name and where */}
      <FadeUp delay={80} style={[styles.px, styles.head]}>
        <Text style={[text.h1, styles.name]} accessibilityRole="header">
          {name}
        </Text>
        <View style={styles.row6c}>
          <Icon name="pin" size={14} color={colors.mute} />
          <Text style={text.meta}>{nb.neighbourhood.where(place, kommune)}</Text>
        </View>
        <View style={styles.row6}>
          <Pill label={nb.neighbourhood.open} tone="line" icon="globe" size="sm" />
          <Pill label={nb.neighbourhood.moderated} tone="line" icon="shield" size="sm" />
        </View>
      </FadeUp>

      {/* three numbers */}
      <FadeUp delay={120} style={[styles.px, styles.stats]}>
        <View style={[styles.stat, shadow.card]} accessible accessibilityLabel={nb.neighbourhood.membersAria(count)}>
          <View style={styles.cnt}>
            <Animated.Text key={count} entering={(joined ? FadeInUp : FadeInDown).springify().damping(14)} style={styles.statNum}>
              {count}
            </Animated.Text>
          </View>
          <Text style={styles.statLabel}>{nb.neighbourhood.memberWord(count)}</Text>
        </View>
        <View style={[styles.stat, shadow.card]} accessible accessibilityLabel={nb.neighbourhood.statPostsAria(freshPosts)}>
          <Text style={styles.statNum}>{freshPosts}</Text>
          <Text style={styles.statLabel}>{nb.neighbourhood.statPosts}</Text>
        </View>
        <View style={[styles.stat, shadow.card]} accessible accessibilityLabel={nb.neighbourhood.statTasksAria(localTasks.length)}>
          <Text style={styles.statNum}>{localTasks.length}</Text>
          <Text style={styles.statLabel}>{nb.neighbourhood.statTasks}</Text>
        </View>
      </FadeUp>

      {/* what I can do here */}
      <FadeUp delay={160} style={[styles.px, styles.mt16]}>
        {joined ? (
          <View style={styles.actions}>
            <Button label={nb.neighbourhood.write} icon="edit" size="md" onPress={write} style={styles.flex} />
            <Button label={nb.neighbourhood.invite} icon="users" variant="ghost" size="md" onPress={() => void invite()} style={styles.flex} />
          </View>
        ) : (
          <View style={[styles.joinCard, shadow.card]}>
            <View style={styles.flex}>
              <Text style={styles.joinTitle}>{nb.neighbourhood.joinTitle(place)}</Text>
              <Text style={text.meta}>{nb.neighbourhood.joinWhy}</Text>
            </View>
            <ScaleIn>
              <Button label={nb.neighbourhood.join} variant="lime" icon="plus" block={false} onPress={() => setJoined(true)} />
            </ScaleIn>
          </View>
        )}
      </FadeUp>

      {/* who is in it */}
      {faces.length ? (
        <FadeUp delay={200} style={styles.mt22}>
          <View style={[styles.px, styles.facesHead]}>
            <Text style={styles.facesTitle}>{nb.neighbourhood.facesTitle}</Text>
            {joined ? (
              <Pressable accessibilityRole="button" onPress={() => setJoined(false)} hitSlop={10} style={styles.leave}>
                <Text style={styles.leaveText}>{nb.neighbourhood.leave}</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.facesRow}>
            {faces.map((id) => (
              <Face key={id} id={id} me={id === me.id} />
            ))}
            {rest > 0 ? (
              <View style={styles.faceItem}>
                <View style={styles.faceMore}>
                  <Text style={styles.faceMoreText}>{`+${rest}`}</Text>
                </View>
                <Text style={styles.faceName}>{nb.neighbourhood.moreFaces}</Text>
              </View>
            ) : null}
          </ScrollView>
        </FadeUp>
      ) : null}

      {/* opt-in only: the neighbours who helped most this month */}
      <NeighbourhoodHighlights kommune={kommune} style={[styles.mx, styles.mt16]} />

      {/* the group's oppslag, and the kommune's oppdrag */}
      <FadeUp delay={220} style={styles.mt22}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'oppslag', label: localPosts.length ? `${nb.neighbourhood.tabs.oppslag} · ${localPosts.length}` : nb.neighbourhood.tabs.oppslag },
            { value: 'oppdrag', label: localTasks.length ? `${nb.neighbourhood.tabs.oppdrag} · ${localTasks.length}` : nb.neighbourhood.tabs.oppdrag },
          ]}
        />
      </FadeUp>

      {tab === 'oppslag' ? (
        <View style={[styles.px, styles.stack10, styles.mt14]}>
          {joined ? (
            <Pressable accessibilityRole="button" accessibilityLabel={nb.neighbourhood.write} onPress={write} style={[styles.composer, shadow.card]}>
              <Avatar initials={me.initials} uri={me.avatarUrl} seed={me.id} size={38} ring={false} />
              <View style={styles.composerBox}>
                <Text style={styles.composerPh} numberOfLines={1}>
                  {nb.neighbourhood.composerPh(place)}
                </Text>
              </View>
              <View style={styles.composerIcon}>
                <Icon name="image" size={18} color={colors.cyanDeep} />
              </View>
            </Pressable>
          ) : null}
          {localPosts.length ? (
            localPosts.slice(0, PREVIEW).map((p) => <PostRow key={p.id} post={p} now={now} />)
          ) : (
            <View style={styles.emptyBox}>
              <View style={styles.emptyRing}>
                <View style={styles.emptyDisc}>
                  <Icon name={joined ? 'pinned' : 'lock'} size={24} color={colors.cyanDeep} />
                </View>
              </View>
              <Text style={styles.emptyTitle}>{joined ? nb.neighbourhood.noPosts : nb.neighbourhood.membersOnly}</Text>
              {joined ? <Text style={[text.meta, styles.centerText]}>{nb.neighbourhood.noPostsSub}</Text> : null}
            </View>
          )}
          <Button label={nb.neighbourhood.openBoard} variant="ghost" iconRight="arrow" onPress={() => safePush('/oppslagstavle')} />
        </View>
      ) : (
        <View style={[styles.px, styles.stack12, styles.mt14]}>
          {tasks.isLoading ? (
            <ListingListSkeleton />
          ) : localTasks.length ? (
            localTasks.slice(0, PREVIEW).map((l) => (
              <FadeUp key={l.id}>
                <OppdragCard listing={l} />
              </FadeUp>
            ))
          ) : (
            <Text style={[text.meta, styles.center]}>{nb.neighbourhood.noTasks}</Text>
          )}
          <Button label={nb.neighbourhood.seeAll(kommune)} variant="ghost" iconRight="arrow" onPress={() => safePush('/oppdrag-liste')} />
        </View>
      )}

      {/* about */}
      <SectionHeader
        title={nb.neighbourhood.about}
        subtitle={info?.createdAt ? nb.neighbourhood.created(monthYear(info.createdAt)) : undefined}
        icon="info"
        iconBg={colors.cyanTint}
        iconColor={colors.cyanDeep}
        style={styles.mt34}
      />
      <View style={styles.px}>
        <View style={[styles.card, styles.about, shadow.card]}>
          <Text style={[text.body, styles.ink2]}>{nb.neighbourhood.aboutBody(place)}</Text>
          <View style={styles.divider} />
          <Text style={text.eyebrow}>{nb.neighbourhood.rulesEyebrow}</Text>
          {nb.neighbourhood.rules.map((r) => (
            <View key={r} style={styles.rule}>
              <View style={styles.ruleIcon}>
                <Icon name="check" size={14} color={colors.limeDeep} />
              </View>
              <Text style={styles.ruleText}>{r}</Text>
            </View>
          ))}
          <Button label={nb.neighbourhood.report} variant="ghost" size="sm" icon="flag" block={false} onPress={() => safePush('/rapporter')} style={styles.selfStart} />
        </View>
      </View>
      <View style={styles.bottom} />
    </Screen>
  );
}

function MemberAvatar({ id }: { id: string }) {
  const { data: p } = useProfile(id);
  return <Avatar initials={p?.initials ?? '·'} uri={p?.avatarUrl} seed={id} size={32} />;
}

/** One neighbour in «Naboene her»: the face in a ring and the first name; opens the profile. */
function Face({ id, me }: { id: string; me: boolean }) {
  const { data: p } = useProfile(id);
  const first = me ? nb.neighbourhood.you : (p?.displayName ?? '').split(' ')[0];
  return (
    <PressableScale accessibilityRole="link" accessibilityLabel={p?.displayName ?? first} onPress={() => (me ? safePush('/profil') : safePush(`/profil/${id}`))} style={styles.faceItem}>
      <View style={[styles.faceRing, me && styles.faceRingMe]}>
        <Avatar initials={p?.initials ?? '·'} uri={p?.avatarUrl} seed={id} size={50} ring={false} />
      </View>
      <Text style={styles.faceName} numberOfLines={1}>
        {first}
      </Text>
    </PressableScale>
  );
}

/** One of the group's oppslag: the photo (if any), the type, the title and who wrote it when. */
function PostRow({ post, now }: { post: NoticeboardPost; now: number }) {
  const { data: author } = useProfile(post.authorProfileId);
  const type = noticeType(post);
  const k = NOTICE_STYLE[type];
  const ev = eventTypeOf(post);
  const kindIcon = ev ? EVENT_ICON[ev] : k.icon;
  const kindLabel = ev ? nb.events.types[ev] : nb.noticeboard.kindsShort[type];
  const photo = post.imageUrls?.[0] ?? post.imageUrl;
  return (
    <FadeUp>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${ev ? nb.events.types[ev] : nb.noticeboard.kinds[type]}: ${post.title}`}
        onPress={() => safePush(`/oppslagstavle?oppslag=${post.id}`)}
        style={[styles.post, shadow.card]}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={styles.postPhoto} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.postPhoto, styles.postIcon, { backgroundColor: k.bg }]}>
            <Icon name={kindIcon} size={24} color={k.fg} />
          </View>
        )}
        <View style={styles.postBody}>
          <View style={styles.row6c}>
            <View style={[styles.kp, { backgroundColor: k.bg }]}>
              <Icon name={kindIcon} size={11} color={k.fg} />
              <Text style={[styles.kpText, { color: k.fg }]}>{kindLabel}</Text>
            </View>
            <Text style={[text.meta, styles.f12]}>{postedAgo(post.createdAt, new Date(now))}</Text>
          </View>
          <Text style={styles.postTitle} numberOfLines={2}>
            {post.title}
          </Text>
          <View style={styles.row6c}>
            <Avatar initials={author?.initials ?? '·'} uri={author?.avatarUrl} seed={post.authorProfileId} size={20} ring={false} />
            <Text style={[text.meta, styles.flexShrink]} numberOfLines={1}>
              {[author?.displayName, post.replies ? nb.noticeboard.replies(post.replies) : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
      </PressableScale>
    </FadeUp>
  );
}

function House({ icon, big }: { icon: IconName; big?: boolean }) {
  return (
    <View style={[styles.house, big && styles.houseBig, shadow.medium]}>
      <Icon name={icon} size={big ? 24 : 22} color={big ? colors.lime : colors.ink} />
    </View>
  );
}

function Pos({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <ScaleIn style={[styles.abs, style]}>
      <>{children}</>
    </ScaleIn>
  );
}

/** `.float` – slow up/down bob (off with reduced motion). */
function Float({ children, amp, delay = 0 }: { children: ReactNode; amp: number; delay?: number }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => {
      y.set(withRepeat(withTiming(-amp, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
    }, delay);
    return () => clearTimeout(t);
  }, [amp, delay, reduced, y]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={s}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  mx: { marginHorizontal: screenPadding },
  px: { paddingHorizontal: screenPadding },
  abs: { position: 'absolute' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  flexShrink: { flexShrink: 1 },
  mt6: { marginTop: 6 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  mt22: { marginTop: 22 },
  mt34: { marginTop: 34 },
  f12: { fontSize: 12 },
  center: { textAlign: 'center', paddingVertical: 12 },
  centerText: { textAlign: 'center' },
  ink2: { color: colors.ink2 },
  selfStart: { alignSelf: 'flex-start' },
  bottom: { height: 60 },
  row6: { flexDirection: 'row', gap: 6 },
  row6c: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stack10: { gap: 10 },
  stack12: { gap: 12 },
  cover: { height: 176, borderRadius: 30, overflow: 'hidden', backgroundColor: colors.coverBg },
  hill: { position: 'absolute', borderRadius: 999 },
  hillL: { left: -60, bottom: -120, width: 300, height: 200, backgroundColor: colors.coverHillLime },
  hillR: { right: -80, bottom: -130, width: 320, height: 210, backgroundColor: colors.coverHillCyan },
  ring: { position: 'absolute', left: 110, top: 20, width: 130, height: 130, borderRadius: 65, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.coverRing },
  house: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  houseBig: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.ink },
  hHome: { left: 50, top: 70 },
  hUsers: { left: 150, top: 42 },
  hHage: { right: 60, top: 82 },
  av1: { left: 116, top: 118 },
  av2: { right: 118, top: 124 },
  dot: { position: 'absolute', borderRadius: 999 },
  dotLime: { right: 36, top: 30, width: 12, height: 12, backgroundColor: colors.lime },
  dotBlue: { left: 30, top: 28, width: 8, height: 8, backgroundColor: colors.coverDot },
  coverBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: colors.lime },
  coverBadgeText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  head: { marginTop: 16, gap: 8 },
  name: { fontSize: 30, lineHeight: 33 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 16 },
  stat: { flex: 1, paddingVertical: 14, paddingHorizontal: 10, borderRadius: radius.card, backgroundColor: colors.white, alignItems: 'center', gap: 2 },
  cnt: { height: 30, overflow: 'hidden', justifyContent: 'flex-end' },
  statNum: { ...text.num, fontSize: 26, lineHeight: 30 },
  statLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.mute, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  joinCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.card, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.limeTint },
  joinTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.ink },
  facesHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  facesTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  leave: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 6 },
  leaveText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.mute, textDecorationLine: 'underline' },
  facesRow: { gap: 12, paddingHorizontal: screenPadding },
  faceItem: { width: 64, alignItems: 'center', gap: 6 },
  faceRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: colors.cyan, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  faceRingMe: { borderColor: colors.lime, borderWidth: 2.5 },
  faceName: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.ink2, maxWidth: 64 },
  faceMore: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  faceMoreText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink2 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.card, backgroundColor: colors.white },
  composerBox: { flex: 1, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: 14 },
  composerPh: { fontFamily: fonts.body, fontSize: 14.5, color: colors.mute },
  composerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  emptyRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.cyan, alignItems: 'center', justifyContent: 'center' },
  emptyDisc: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.card },
  post: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: radius.card, backgroundColor: colors.surface, alignItems: 'center' },
  postPhoto: { width: 76, height: 76, borderRadius: 14, backgroundColor: colors.track },
  postIcon: { alignItems: 'center', justifyContent: 'center' },
  postBody: { flex: 1, minWidth: 0, gap: 5 },
  kp: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 20, paddingHorizontal: 7, borderRadius: radius.pill },
  kpText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  postTitle: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19.5, color: colors.ink },
  about: { padding: 18, gap: 14 },
  divider: { height: 1, backgroundColor: colors.line2 },
  rule: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ruleIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center', marginTop: -1 },
  ruleText: { flex: 1, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink2 },
});
