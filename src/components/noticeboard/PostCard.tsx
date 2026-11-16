import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import type { NoticeboardPost } from '@/domain/types';
import nb from '@/i18n/nb';
import { useNoticeComments, useProfile } from '@/api/queries';
import { postedAgo } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { colors, fonts, radius, text } from '@/theme/theme';
import { LendPanel } from '@/components/lend/LendPanel';
import { EVENT_ICON, eventTypeOf, noticeLook, noticeType } from '@/components/community/noticeKinds';
import { EventExtras, TopicPanel } from '@/components/noticeboard/TopicPanels';
import { ANSWER_PROMPT_AFTER, AnswerPrompt, EventPanel, PollPanel, QueuePanel, ReactionBar, isEvent } from '@/components/noticeboard/NoticePanels';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Avatar, Button, Icon, IconButton, Note, Pill, type IconName } from '@/components/ui';
import { Image } from '@/components/ui/Image';

/** Long text is folded after this many lines, with «Se mer» (like any feed). */
const FOLD_LINES = 4;
/** Photo height as a share of the card's width (5:4, a little lower than Instagram's 4:5 so text stays in view). */
const PHOTO_RATIO = 0.8;
/** A drag this far sideways (px) starts moving the photos; up-and-down first scrolls the feed instead. */
const SWIPE_START = 12;
/** Let go after a quarter of a photo, or with a quick flick (px/s), and it moves to the next. */
const SWIPE_SHARE = 0.25;
const SWIPE_SPEED = 500;
const SNAP = { damping: 22, stiffness: 220, mass: 0.8 };

export const photosOf = (p: NoticeboardPost) => (p.imageUrls?.length ? p.imageUrls : p.imageUrl ? [p.imageUrl] : []);

/**
 * One oppslag in the feed, shaped like a post in a group (Facebook / Instagram, asked 2026-11-10): who and
 * where in one line, the text with «Se mer», photos you swipe through (double tap = «Liker»), the counts,
 * the actions, the newest svar and a «Skriv et svar …» row. Brand colours and shapes only.
 */
export function PostCard({
  post,
  now,
  fresh,
  mine,
  meId,
  me,
  saved,
  onLike,
  onReply,
  onSave,
  onShare,
  onMore,
  onPhoto,
  onKeep,
  onClose,
  onSeen,
}: {
  post: NoticeboardPost;
  now: number;
  fresh: boolean;
  mine: boolean;
  meId: string;
  me: { initials: string; avatarUrl?: string };
  saved: boolean;
  onLike: () => void;
  onReply: () => void;
  onSave: () => void;
  onShare: () => void;
  onMore: () => void;
  onPhoto: (index: number) => void;
  onKeep: () => void;
  onClose: () => void;
  /** «Sett den?» on a savnet dyr: opens the answers with a start written (0108) */
  onSeen?: () => void;
}) {
  const { data: author } = useProfile(post.authorProfileId);
  const type = noticeType(post);
  // a newer kind (0108) has its own look and name
  const k = noticeLook(post);
  // an arrangement shows its own kind on the tag: «Dugnad», «Loppemarked» …
  const ev = eventTypeOf(post);
  const { isYouth } = useCurrentUser();
  const authorFirst = (author?.displayName ?? '').split(' ')[0];
  const hasPoll = !!post.pollOptions?.length;
  const queue = post.kind === 'GIVEAWAY' && !post.doneAt;
  // «Svar på dette»: someone else's oppslag that nobody has answered for a day
  const unanswered = !mine && !post.doneAt && !(post.replies ?? 0) && now - Date.parse(post.createdAt) > ANSWER_PROMPT_AFTER;
  const likes = post.likes ?? 0;
  const replies = post.replies ?? 0;
  const [folded, setFolded] = useState(true);
  const [long, setLong] = useState(false);
  const where = post.neighbourhoodId ? nb.noticeboard.onlyNabolag(post.place) : post.place;
  const when = fresh ? nb.noticeboard.justNow : postedAgo(post.createdAt, new Date(now));

  return (
    <View style={[styles.card, fresh && styles.fresh]} testID={`notice-${post.id}`}>
      <View style={styles.head}>
        <Avatar initials={author?.initials ?? '·'} uri={author?.avatarUrl} seed={post.authorProfileId} size={42} ring={false} />
        <View style={styles.flex}>
          <View style={styles.nameRow}>
            <Text style={styles.who} numberOfLines={1}>
              {author?.displayName ?? ''}
            </Text>
            <View style={[styles.kindTag, { backgroundColor: k.bg }]}>
              <Icon name={ev ? EVENT_ICON[ev] : k.icon} size={11} color={k.fg} />
              <Text style={[styles.kind, { color: k.fg }]} numberOfLines={1}>
                {ev ? nb.events.types[ev] : post.topic ? nb.felles.topics.names[post.topic] : nb.noticeboard.kindsShort[type]}
              </Text>
            </View>
          </View>
          {post.pinnedAt ? (
            <View style={styles.pinned}>
              <Icon name="pinned" size={11} color={colors.limeDeep} />
              <Text style={styles.pinnedText}>{nb.felles.nabolag.pinned}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Icon name={post.neighbourhoodId ? 'home' : 'globe'} size={11} color={colors.mute} />
            <Text style={styles.meta} numberOfLines={1}>
              {[where, when, post.editedAt ? nb.noticeboard.edited : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        <IconButton icon="more" variant="ghost" iconSize={20} accessibilityLabel={nb.noticeboard.moreAria(post.title)} onPress={onMore} />
      </View>

      <View style={styles.textBlock}>
        {post.doneAt ? (
          <View style={styles.doneRow}>
            <Pill label={post.autoClosed ? nb.noticeboard.autoClosed : nb.noticeboard.done} tone="ok" icon="check" size="sm" />
          </View>
        ) : null}
        <Text style={styles.title}>{post.title}</Text>
        {post.body ? (
          <>
            <Text
              style={styles.body}
              numberOfLines={folded ? FOLD_LINES : undefined}
              onTextLayout={(e) => {
                if (!long && e.nativeEvent.lines.length > FOLD_LINES) setLong(true);
              }}
            >
              {post.body}
            </Text>
            {long ? (
              <Pressable accessibilityRole="button" onPress={() => setFolded((f) => !f)} hitSlop={8} style={styles.more}>
                <Text style={styles.moreText}>{folded ? nb.noticeboard.seeMore : nb.noticeboard.seeLess}</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>

      {mine && post.stillAskedAt && !post.doneAt ? <StillCurrent onKeep={onKeep} onClose={onClose} /> : null}
      {mine && post.autoClosed && post.doneAt ? (
        <Note icon="hourglass" style={styles.autoNote}>
          {nb.noticeboard.autoClosedNote}
        </Note>
      ) : null}

      <PhotoCarousel post={post} liked={!!post.likedByMe} onLike={onLike} onOpen={onPhoto} />

      {isEvent(post) || post.kind === 'TOOL_LEND' || queue || hasPoll || (post.topic && !post.doneAt) ? (
        <View style={styles.panels}>
          {post.topic ? <TopicPanel post={post} mine={mine} now={now} onSeen={onSeen ?? onReply} /> : null}
          {isEvent(post) ? <EventPanel post={post} mine={mine} youth={isYouth} now={now} /> : null}
          {isEvent(post) ? <EventExtras post={post} mine={mine} meId={meId} youth={isYouth} now={now} /> : null}
          {post.kind === 'TOOL_LEND' ? <LendPanel post={post} meId={meId} mine={mine} /> : null}
          {queue ? <QueuePanel post={post} mine={mine} authorFirst={authorFirst} onReply={onReply} /> : null}
          {hasPoll ? <PollPanel post={post} now={now} /> : null}
        </View>
      ) : null}

      {likes || replies ? (
        <View style={styles.counts}>
          {likes ? (
            <View style={styles.likeCount}>
              <View style={styles.heartDot}>
                <Icon name="heart" size={11} color={colors.white} filled />
              </View>
              <Text style={styles.countText}>{nb.noticeboard.likes(likes)}</Text>
            </View>
          ) : (
            <View />
          )}
          {replies ? (
            <Pressable accessibilityRole="button" onPress={onReply} hitSlop={8}>
              <Text style={styles.countText}>{nb.noticeboard.replies(replies)}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <LikeAction on={!!post.likedByMe} a11y={nb.noticeboard.likeAria(post.title, likes)} onPress={onLike} />
        <Action icon="msg" label={nb.noticeboard.reply} a11y={nb.noticeboard.replyAria(post.title, replies)} onPress={onReply} />
        <Action icon="share" label={nb.noticeboard.share} a11y={nb.noticeboard.shareAria(post.title)} onPress={onShare} />
        {mine ? null : (
          <Action
            icon="bookmark"
            label={saved ? nb.noticeboard.savedLabel : nb.noticeboard.save}
            on={saved}
            onColor={colors.ink}
            a11y={saved ? nb.noticeboard.savedLabel : nb.noticeboard.save}
            onPress={onSave}
          />
        )}
      </View>

      <View style={styles.reactions}>
        <ReactionBar post={post} meId={meId} />
      </View>

      {replies ? <LatestReply postId={post.id} total={replies} now={now} onOpen={onReply} /> : null}
      {unanswered ? (
        <View style={styles.answerWrap}>
          <AnswerPrompt authorFirst={authorFirst} onReply={onReply} />
        </View>
      ) : post.doneAt ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel={nb.noticeboard.writeReplyA11y(post.title)} onPress={onReply} style={styles.prompt}>
          <Avatar initials={me.initials} uri={me.avatarUrl} seed={meId} size={30} ring={false} />
          <View style={styles.promptBox}>
            <Text style={styles.promptText}>{nb.noticeboard.writeReply}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

/**
 * The photos, one at a time: drag sideways to the next (finger on a phone, mouse in a browser), «2/5» in the
 * corner and dots under them (Instagram). Up-and-down still scrolls the feed. A tap opens the photo big; a
 * double tap gives a «Liker» with a heart that pops up. In a browser there are also arrows to click.
 */
function PhotoCarousel({ post, liked, onLike, onOpen }: { post: NoticeboardPost; liked: boolean; onLike: () => void; onOpen: (index: number) => void }) {
  const photos = photosOf(post);
  const n = photos.length;
  const [width, setWidth] = useState(0);
  const [at, setAt] = useState(0);
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const burst = useSharedValue(0);
  const burstStyle = useAnimatedStyle(() => ({ opacity: burst.get(), transform: [{ scale: 0.6 + burst.get() * 0.5 }] }));
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  if (!n) return null;

  const w = width || 340;
  const height = Math.round(w * PHOTO_RATIO);
  const shown = Math.min(at, n - 1);

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(n - 1, i));
    setAt(next);
    x.set(withSpring(-next * w, SNAP));
  };
  const likeByTap = () => {
    haptics.light();
    burst.set(withSequence(withSpring(1, { damping: 9, stiffness: 220 }), withTiming(1, { duration: 280 }), withTiming(0, { duration: 220 })));
    // a double tap only ever adds a like, like on Instagram
    if (!liked) onLike();
  };

  // sideways only: a mostly vertical drag is left to the feed's scrolling
  const pan = Gesture.Pan()
    .enabled(n > 1)
    .activeOffsetX([-SWIPE_START, SWIPE_START])
    .failOffsetY([-SWIPE_START, SWIPE_START])
    .onStart(() => {
      start.set(x.get());
    })
    .onUpdate((e) => {
      const min = -(n - 1) * w;
      let next = start.get() + e.translationX;
      // a little give past the first and the last photo
      if (next > 0) next = next * 0.3;
      if (next < min) next = min + (next - min) * 0.3;
      x.set(next);
    })
    .onEnd((e) => {
      const from = Math.round(-start.get() / w);
      const far = Math.abs(e.translationX) > w * SWIPE_SHARE || Math.abs(e.velocityX) > SWIPE_SPEED;
      const dir = e.translationX < 0 ? 1 : -1;
      runOnJS(goTo)(far ? from + dir : from);
    });
  const double = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .onEnd(() => runOnJS(likeByTap)());
  const single = Gesture.Tap().onEnd(() => runOnJS(onOpen)(shown));
  const gesture = Gesture.Race(pan, Gesture.Exclusive(double, single));

  return (
    <View
      onLayout={(e) => {
        const next = e.nativeEvent.layout.width;
        setWidth(next);
        // keep showing the same photo when the width changes (rotation, first layout)
        x.set(-Math.min(at, n - 1) * next);
      }}
      style={styles.carousel}
    >
      <GestureDetector gesture={gesture}>
        <View style={[styles.viewport, { height }]} collapsable={false}>
          <Animated.View style={[styles.photoRow, { width: w * n, height }, rowStyle]}>
            {photos.map((uri, i) => (
              <View
                key={`${uri}-${i}`}
                accessible
                accessibilityRole="imagebutton"
                accessibilityLabel={n > 1 ? nb.noticeboard.photoN(post.title, i + 1, n) : nb.noticeboard.openPhoto(post.title)}
                accessibilityHint={nb.noticeboard.photoHint}
                onAccessibilityTap={() => onOpen(i)}
                style={{ width: w, height }}
              >
                {/* the picture itself takes no touches: in a browser it would otherwise start the browser's own image drag */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Image source={{ uri }} style={[StyleSheet.absoluteFill, styles.photoBg]} resizeMode="cover" accessibilityIgnoresInvertColors />
                </View>
              </View>
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
      <Animated.View pointerEvents="none" style={[styles.burst, { height }, burstStyle]}>
        <Icon name="heart" size={86} color={colors.white} filled />
      </Animated.View>
      {n > 1 ? (
        <>
          <View style={styles.counter} pointerEvents="none">
            <Text style={styles.counterText}>{nb.noticeboard.photoCount(shown + 1, n)}</Text>
          </View>
          {/* a mouse can't always drag nicely: arrows in the browser, like Instagram on the web */}
          {Platform.OS === 'web' && shown > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={nb.noticeboard.photoPrev} onPress={() => goTo(shown - 1)} style={[styles.arrow, styles.arrowL, { top: height / 2 - 16 }]}>
              <Icon name="left" size={18} color={colors.ink} />
            </Pressable>
          ) : null}
          {Platform.OS === 'web' && shown < n - 1 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={nb.noticeboard.photoNext} onPress={() => goTo(shown + 1)} style={[styles.arrow, styles.arrowR, { top: height / 2 - 16 }]}>
              <Icon name="right" size={18} color={colors.ink} />
            </Pressable>
          ) : null}
          <View style={styles.dots}>
            {photos.map((_, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={nb.noticeboard.photoGoTo(i + 1, n)}
                onPress={() => goTo(i)}
                hitSlop={6}
                style={[styles.dot, i === shown && styles.dotOn]}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** «Liker» with a small bounce when it turns on. */
function LikeAction({ on, a11y, onPress }: { on: boolean; a11y: string; onPress: () => void }) {
  const s = useSharedValue(1);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={a11y}
      onPress={() => {
        if (!on) s.set(withSequence(withSpring(1.35, { damping: 6, stiffness: 400 }), withSpring(1)));
        onPress();
      }}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Animated.View style={pop}>
        <Icon name="heart" size={20} color={on ? colors.heart : colors.ink2} filled={on} />
      </Animated.View>
      <Text style={[styles.actionText, { color: on ? colors.heart : colors.ink2 }]} numberOfLines={1}>
        {nb.noticeboard.like}
      </Text>
    </Pressable>
  );
}

function Action({ icon, label, on = false, onColor, a11y, onPress }: { icon: IconName; label: string; on?: boolean; onColor?: string; a11y: string; onPress: () => void }) {
  const color = on ? (onColor ?? colors.ink) : colors.ink2;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={a11y} onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
      <Icon name={icon} size={19} color={color} filled={on} />
      <Text style={[styles.actionText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The newest answer right under the post, like a comment in a group. */
function LatestReply({ postId, total, now, onOpen }: { postId: string; total: number; now: number; onOpen: () => void }) {
  const list = useNoticeComments(postId).data ?? [];
  const last = list[list.length - 1];
  const { data: author } = useProfile(last?.authorProfileId ?? '');
  if (!last) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={nb.noticeboard.seeAll(total)} onPress={onOpen} style={styles.preview}>
      {total > 1 ? <Text style={styles.seeAll}>{nb.noticeboard.seeAll(total)}</Text> : null}
      <View style={styles.previewRow}>
        <Avatar initials={author?.initials ?? '·'} uri={author?.avatarUrl} seed={last.authorProfileId} size={30} ring={false} />
        <View style={styles.flex}>
          <View style={styles.previewBubble}>
            <Text style={styles.previewName} numberOfLines={1}>
              {author?.displayName ?? ''}
            </Text>
            <Text style={styles.previewText} numberOfLines={2}>
              {last.body}
            </Text>
          </View>
          <Text style={styles.previewMeta}>{postedAgo(last.createdAt, new Date(now))}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** For the owner, when the app asks after 14 days (0099): keep it, or close it. */
function StillCurrent({ onKeep, onClose }: { onKeep: () => void; onClose: () => void }) {
  return (
    <View style={styles.still} testID="notice-still">
      <View style={styles.stillTop}>
        <View style={styles.stillIcon}>
          <Icon name="hourglass" size={18} color={colors.limeDeep} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.stillTitle}>{nb.noticeboard.stillTitle}</Text>
          <Text style={[text.meta, styles.f125]}>{nb.noticeboard.stillText}</Text>
        </View>
      </View>
      <View style={styles.stillBtns}>
        <Button label={nb.noticeboard.stillDone} variant="ghost" size="sm" block={false} onPress={onClose} style={styles.flex} />
        <Button label={nb.noticeboard.stillKeep} icon="check" size="sm" block={false} onPress={onKeep} style={styles.flex} />
      </View>
    </View>
  );
}

const PAD = 14;

const styles = StyleSheet.create({
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 3, paddingHorizontal: 8, height: 20, borderRadius: radius.pill, backgroundColor: colors.limeTint },
  pinnedText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.limeDeep },
  flex: { flex: 1, minWidth: 0 },
  f125: { fontSize: 12.5 },
  card: { marginHorizontal: 10, borderRadius: radius.card, backgroundColor: colors.surface, overflow: 'hidden', paddingTop: 12 },
  fresh: { borderWidth: 2, borderColor: colors.lime },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: PAD, paddingRight: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  who: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19, color: colors.ink },
  kindTag: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 20, paddingHorizontal: 7, borderRadius: radius.pill },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  kind: { fontFamily: fonts.bodyBold, fontSize: 11.5, lineHeight: 14 },
  meta: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16, color: colors.mute },
  textBlock: { paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 12, gap: 4 },
  doneRow: { flexDirection: 'row', marginBottom: 4 },
  title: { fontFamily: fonts.display, fontSize: 17.5, lineHeight: 22, letterSpacing: -0.2, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21.5, color: colors.ink },
  more: { alignSelf: 'flex-start', minHeight: 24, justifyContent: 'center' },
  moreText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.mute },
  autoNote: { marginHorizontal: PAD, marginBottom: 12 },
  carousel: { position: 'relative' },
  // userSelect: no text/image selection while dragging with a mouse
  viewport: { overflow: 'hidden', userSelect: 'none' },
  photoRow: { flexDirection: 'row' },
  arrow: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', opacity: 0.92 },
  arrowL: { left: 10 },
  arrowR: { right: 10 },
  photoBg: { backgroundColor: colors.track },
  burst: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', top: 12, right: 12, height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.scrim, justifyContent: 'center' },
  counterText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.cyan, width: 7, height: 7, borderRadius: 3.5, marginTop: -0.5 },
  panels: { paddingHorizontal: PAD, paddingTop: 12, gap: 10 },
  reactions: { paddingHorizontal: PAD, paddingTop: 8 },
  answerWrap: { paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 14 },
  counts: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingTop: 10 },
  likeCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heartDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.heart, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: fonts.body, fontSize: 13, color: colors.mute },
  actions: { flexDirection: 'row', marginTop: 8, marginHorizontal: 6, paddingVertical: 2, borderTopWidth: 1, borderTopColor: colors.line2 },
  action: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.m },
  actionPressed: { backgroundColor: colors.bg },
  actionText: { fontFamily: fonts.bodySemi, fontSize: 13.5 },
  preview: { paddingHorizontal: PAD, paddingTop: 2, gap: 6 },
  seeAll: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.mute },
  previewRow: { flexDirection: 'row', gap: 8 },
  previewBubble: { alignSelf: 'flex-start', maxWidth: '100%', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.bg },
  previewName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  previewText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.ink },
  previewMeta: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.mute, marginTop: 3, marginLeft: 12 },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 14 },
  promptBox: { flex: 1, height: 36, borderRadius: radius.pill, backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: 14 },
  promptText: { fontFamily: fonts.body, fontSize: 14, color: colors.mute },
  still: { marginHorizontal: PAD, marginBottom: 12, padding: 14, gap: 12, borderRadius: radius.card, backgroundColor: colors.limeTint },
  stillTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stillIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stillTitle: { ...text.cardTitle, fontSize: 15.5, marginBottom: 2 },
  stillBtns: { flexDirection: 'row', gap: 8 },
});
