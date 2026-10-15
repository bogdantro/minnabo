import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
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
import { NOTICE_STYLE } from '@/components/community/noticeKinds';
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
} from '@/components/ui';

type Tab = 'oppdrag' | 'oppslag';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Nabolag (design/screens/Nabolag.dc.html). Without `?place=` it is the list of the kommune's
 * nabolag, where you pick up to three; with it, the page of that one nabolag.
 */
export function NeighbourhoodScreen() {
  const { place } = useLocalSearchParams<{ place?: string }>();
  return typeof place === 'string' && place ? <NabolagPage place={place} /> : <NabolagList />;
}

function NabolagPage({ place }: { place: string }) {
  const router = useRouter();
  const me = useCurrentUser();
  const scope = useLocationScope();
  const kommune = me.municipality || scope.municipality || '';
  const { data: info, isFetched } = useNeighbourhoodInfo(kommune, place);
  const toggle = useToggleNeighbourhood(kommune, place, me.id);
  const [tab, setTab] = useState<Tab>('oppdrag');
  const [now] = useState(() => Date.now());

  const tasks = useListings(kommune ? { type: 'TASK_REQUEST', municipalities: [kommune] } : undefined, 'NEWEST');
  const notices = useNoticeboard();
  const localTasks = tasks.data ?? [];
  // only this nabolag's own oppslag (members can read them; the server decides)
  const localPosts = (notices.data ?? []).filter((p) => !!info?.id && p.neighbourhoodId === info.id);
  const freshPosts = localPosts.filter((p) => now - Date.parse(p.createdAt) < WEEK_MS).length;

  const name = info?.name ?? `${place} nabolag`;
  const joined = !!info?.isMember;
  const count = info?.memberCount ?? 0;
  const others = (info?.memberIds ?? []).filter((id) => id !== me.id);
  const stack = others.slice(0, 4);
  const rest = Math.max(0, count - stack.length - (joined ? 1 : 0));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/nabolag'));
  const share = async () => {
    try {
      await Clipboard.setStringAsync(Linking.createURL('/nabolag', { queryParams: { place } }));
      toast.success(nb.neighbourhood.linkCopied, { icon: 'copy' });
    } catch {
      toast.error(nb.toast.genericError);
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

  if (!kommune) {
    return (
      <Screen header={<SubHeader title={nb.neighbourhood.title} onBack={back} />}>
        <EmptyState
          icon="home"
          title={nb.neighbourhood.title}
          body={nb.neighbourhood.noArea}
          actionLabel={nb.neighbourhood.pickArea}
          onAction={() => safePush('/profil/rediger')}
        />
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
      header={
        <SubHeader
          title={nb.neighbourhood.title}
          onBack={back}
          right={<IconButton icon="share" iconSize={18} accessibilityLabel={nb.neighbourhood.share} onPress={share} />}
        />
      }
    >
      {/* cover art */}
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
        </View>
      </FadeUp>

      {/* head */}
      <FadeUp delay={80} style={[styles.px, styles.head]}>
        <View style={styles.row6}>
          <Pill label={nb.neighbourhood.open} tone="line" icon="globe" />
          <Pill label={nb.neighbourhood.moderated} tone="line" icon="shield" />
        </View>
        <Text style={text.h1} accessibilityRole="header">
          {name}
        </Text>
        <View style={styles.row6c}>
          <Icon name="pin" size={14} color={colors.mute} />
          <Text style={text.meta}>{nb.neighbourhood.where(place, kommune)}</Text>
        </View>
      </FadeUp>

      {/* members */}
      <FadeUp delay={140} style={[styles.px, styles.mt16]}>
        <View style={[styles.card, styles.memberCard, shadow.card]}>
          <View style={styles.flexGap10}>
            <View style={styles.avstack}>
              {joined ? (
                <ScaleIn style={styles.avItem}>
                  <Avatar initials={me.initials} uri={me.avatarUrl} size={32} me />
                </ScaleIn>
              ) : null}
              {stack.map((id, i) => (
                <View key={id} style={[styles.avItem, (joined || i > 0) && styles.avOverlap]}>
                  <MemberAvatar id={id} />
                </View>
              ))}
              {rest > 0 ? (
                <View style={[styles.more, (joined || stack.length > 0) && styles.avOverlap]}>
                  <Text style={styles.moreText}>{`+${rest}`}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.countRow} accessible accessibilityLabel={nb.neighbourhood.membersAria(count)}>
              <View style={styles.cnt}>
                <Animated.Text key={count} entering={(joined ? FadeInUp : FadeInDown).springify().damping(14)} style={styles.count}>
                  {count}
                </Animated.Text>
              </View>
              <Text style={text.meta}>{nb.neighbourhood.members}</Text>
            </View>
          </View>
          {joined ? (
            <ScaleIn style={styles.memberSide}>
              <Pill label={nb.neighbourhood.member} tone="ok" icon="check" />
              <Button label={nb.neighbourhood.leave} variant="ghost" size="sm" block={false} onPress={() => setJoined(false)} />
            </ScaleIn>
          ) : (
            <ScaleIn>
              <Button label={nb.neighbourhood.join} variant="lime" icon="plus" block={false} onPress={() => setJoined(true)} />
            </ScaleIn>
          )}
        </View>
      </FadeUp>

      {/* tabs */}
      <FadeUp delay={200} style={styles.mt22}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'oppdrag', label: nb.neighbourhood.tabs.oppdrag },
            { value: 'oppslag', label: nb.neighbourhood.tabs.oppslag },
          ]}
        />
      </FadeUp>
      <View style={[styles.px, styles.scopeRow]}>
        <Pill label={nb.neighbourhood.scope(kommune)} tone="neutral" icon="pin" />
        <Text style={text.meta}>
          {tab === 'oppdrag' ? nb.neighbourhood.openTasks(localTasks.length) : nb.neighbourhood.posts(freshPosts || localPosts.length)}
        </Text>
      </View>

      {tab === 'oppdrag' ? (
        <View style={[styles.px, styles.stack12]}>
          {tasks.isLoading ? (
            <ListingListSkeleton />
          ) : localTasks.length ? (
            localTasks.slice(0, 4).map((l) => (
              <FadeUp key={l.id}>
                <OppdragCard listing={l} />
              </FadeUp>
            ))
          ) : (
            <Text style={[text.meta, styles.center]}>{nb.neighbourhood.noTasks}</Text>
          )}
          <Button label={nb.neighbourhood.seeAll(kommune)} variant="ghost" iconRight="arrow" onPress={() => safePush('/oppdrag-liste')} />
        </View>
      ) : (
        <View style={[styles.px, styles.stack10]}>
          {localPosts.length ? (
            localPosts.slice(0, 4).map((p) => <PostRow key={p.id} post={p} now={now} />)
          ) : (
            <Text style={[text.meta, styles.center]}>{joined ? nb.neighbourhood.noPosts : nb.neighbourhood.membersOnly}</Text>
          )}
          <Button label={nb.neighbourhood.openBoard} variant="ghost" iconRight="arrow" onPress={() => safePush('/oppslagstavle')} />
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
          <Button
            label={nb.neighbourhood.report}
            variant="ghost"
            size="sm"
            icon="flag"
            block={false}
            onPress={() => safePush('/rapporter')}
            style={styles.selfStart}
          />
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

function PostRow({ post, now }: { post: NoticeboardPost; now: number }) {
  const { data: author } = useProfile(post.authorProfileId);
  const k = NOTICE_STYLE[post.kind];
  const who = author?.displayName ?? '';
  return (
    <FadeUp>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${nb.noticeboard.kinds[post.kind]}: ${post.title}`}
        onPress={() => safePush(`/oppslagstavle?oppslag=${post.id}`)}
        style={[styles.post, shadow.card]}
      >
        <Avatar initials={author?.initials ?? '·'} uri={author?.avatarUrl} seed={post.authorProfileId} size={48} ring={false} />
        <View style={styles.postBody}>
          <View style={styles.row8c}>
            <View style={[styles.kp, { backgroundColor: k.bg }]}>
              <Text style={[styles.kpText, { color: k.fg }]}>{nb.noticeboard.kinds[post.kind]}</Text>
            </View>
            <Text style={[text.meta, styles.f12]}>{postedAgo(post.createdAt, new Date(now))}</Text>
          </View>
          <Text style={styles.postTitle}>{post.title}</Text>
          <Text style={text.meta}>{[who, post.place].filter(Boolean).join(' · ')}</Text>
        </View>
        <Icon name="right" size={20} color={colors.faint} />
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
  px: { paddingHorizontal: screenPadding },
  abs: { position: 'absolute' },
  mt6: { marginTop: 6 },
  mt16: { marginTop: 16 },
  mt22: { marginTop: 22 },
  mt34: { marginTop: 34 },
  f12: { fontSize: 12 },
  center: { textAlign: 'center', paddingVertical: 12 },
  ink2: { color: colors.ink2 },
  selfStart: { alignSelf: 'flex-start' },
  bottom: { height: 60 },
  row6: { flexDirection: 'row', gap: 6 },
  row6c: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row8c: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  head: { marginTop: 18, gap: 8 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card },
  memberCard: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  flexGap10: { flex: 1, minWidth: 0, gap: 10 },
  avstack: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  avItem: { borderRadius: 16 },
  avOverlap: { marginLeft: -10 },
  more: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  moreText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.ink2 },
  countRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  cnt: { height: 30, overflow: 'hidden', justifyContent: 'flex-end' },
  count: { ...text.num, fontSize: 26, lineHeight: 30 },
  memberSide: { gap: 6, alignItems: 'flex-end' },
  scopeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 12 },
  post: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.surface, alignItems: 'center' },
  postBody: { flex: 1, minWidth: 0, gap: 5 },
  kp: { height: 22, paddingHorizontal: 9, borderRadius: radius.pill, justifyContent: 'center' },
  kpText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  postTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 20, color: colors.ink },
  about: { padding: 18, gap: 14 },
  divider: { height: 1, backgroundColor: colors.line2 },
  rule: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ruleIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center', marginTop: -1 },
  ruleText: { flex: 1, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink2 },
});
