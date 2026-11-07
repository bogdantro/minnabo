import { useEffect, useState } from 'react';
import { serverMessage } from '@/lib/errors';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from '@/components/ui/Image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BoardArt } from '@/components/art/Scenes';
import { ImageViewer } from '@/components/ImageViewer';
import { DugnadPanel, ToolLoanPanel } from '@/components/NoticeExtras';
import { DateField } from '@/components/ui/DateField';
import { EmptyScene } from '@/components/ui/EmptyScene';
import { TimeField } from '@/components/ui/TimeField';
import Animated, { FadeInUp, LinearTransition } from 'react-native-reanimated';
import type { NoticeComment, NoticeKind, NoticeboardPost } from '@/domain/types';
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
import { toast } from '@/lib/toast';
import { pickAndUpload } from '@/lib/uploads';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { NOTICE_STYLE, NOTICE_TYPES, noticeType, type NoticeType } from '@/components/community/noticeKinds';
import {
  Avatar,
  Button,
  ErrorState,
  ErrorText,
  FadeUp,
  Field,
  Icon,
  IconButton,
  Input,
  ListGroup,
  ListRow,
  Pill,
  Note,
  RowSkeleton,
  Screen,
  Shake,
  Sheet,
  Spinner,
  SubHeader,
  type IconName,
} from '@/components/ui';

type Filter = NoticeType | 'ALL';
type Photo = { path: string; url: string };
type Compose = { type?: NoticeType; photo?: Photo };

/** The day from the date field + "10:00" → ISO. */
const eventIso = (d: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const at = new Date(d);
  at.setHours(h || 0, m || 0, 0, 0);
  return at.toISOString();
};
const TITLE_MAX = 60;
const TEXT_MAX = 400;
const COMMENT_MAX = 500;
/** The feed runs nearly edge to edge, like a group feed. */
const FEED_INSET = 10;
const MAX_FACES = 5;
const QUICK: { key: string; label: string; icon: IconName; bg: string; fg: string; start?: Compose }[] = [
  { key: 'photo', label: nb.noticeboard.quick.photo, icon: 'image', bg: colors.cyanTint, fg: colors.cyanDeep },
  { key: 'DUGNAD', label: nb.noticeboard.quick.DUGNAD, ...NOTICE_STYLE.DUGNAD, start: { type: 'DUGNAD' } },
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
  const { oppslag, ny, tittel, tekst } = useLocalSearchParams<{ oppslag?: string; ny?: string; tittel?: string; tekst?: string }>();
  const [commentsFor, setCommentsFor] = useState<string | null>(typeof oppslag === 'string' ? oppslag : null);
  const [editing, setEditing] = useState<NoticeboardPost | null>(null);
  const [menuFor, setMenuFor] = useState<NoticeboardPost | null>(null);
  const [viewer, setViewer] = useState<NoticeboardPost | null>(null);
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
  const openCompose = (start: Compose) => {
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
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!freshId) return;
    const t = setTimeout(() => setFreshId(null), 2400);
    return () => clearTimeout(t);
  }, [freshId]);

  const all = (data ?? [])
    .filter((p) => !scope.municipalities.length || scope.municipalities.includes(p.municipality))
    .filter((p) => !mineOnly || !myNabolag.length || !!p.neighbourhoodId);
  const shown = filter === 'ALL' ? all : all.filter((p) => noticeType(p) === filter);
  const authors = [...new Set(all.map((p) => p.authorProfileId))];

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
        spacer="none"
        header={
          <SubHeader
            title={nb.noticeboard.title}
            onBack={back}
            right={<IconButton icon="edit" iconSize={18} accessibilityLabel={nb.noticeboard.newPost} onPress={() => openCompose({})} />}
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

        <FadeUp delay={100} style={styles.mt12}>
          <View accessibilityRole="tablist" accessibilityLabel={nb.noticeboard.kindLabel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {(['ALL', ...NOTICE_TYPES] as Filter[]).map((k) => {
                const on = filter === k;
                const st = k === 'ALL' ? { icon: 'pinned' as IconName, bg: colors.neutralPill, fg: colors.ink2 } : NOTICE_STYLE[k];
                const label = k === 'ALL' ? nb.noticeboard.all : nb.noticeboard.kinds[k];
                const n = k === 'ALL' ? all.length : all.filter((p) => noticeType(p) === k).length;
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${label}, ${n}`}
                    onPress={() => setFilter(k)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <View style={[styles.ci, { backgroundColor: on ? colors.onInk16b : st.bg }]}>
                      <Icon name={st.icon} size={16} color={on ? colors.white : st.fg} />
                    </View>
                    <Text style={[styles.chipText, on && styles.white]}>{label}</Text>
                    <Text style={[styles.chipCount, on && styles.white]}>{n}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
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

        <View style={styles.list}>
          {isLoading ? (
            <View style={styles.px}>
              <RowSkeleton />
              <RowSkeleton />
            </View>
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : shown.length ? (
            shown.map((p) => (
              <Animated.View key={p.id} entering={p.id === freshId ? FadeInUp.springify().damping(14) : undefined} layout={LinearTransition.duration(300)}>
                <PostCard
                  post={p}
                  now={now}
                  fresh={p.id === freshId}
                  mine={p.authorProfileId === me.id}
                  meId={me.id}
                  saved={savedIds.includes(p.id)}
                  onLike={() => like(p)}
                  onReply={() => setCommentsFor(p.id)}
                  onSave={() => save(p.id)}
                  onMore={() => setMenuFor(p)}
                  onPhoto={() => setViewer(p)}
                />
              </Animated.View>
            ))
          ) : (
            <FadeUp style={[styles.empty, styles.px]}>
              <EmptyScene icon="pinned" tone="cyan" />
              <Text style={styles.emptyTitle}>{nb.noticeboard.emptyTitle}</Text>
              {kommune ? <Text style={text.meta}>{nb.noticeboard.emptyText(kommune)}</Text> : null}
              <Button label={nb.noticeboard.write} variant="ink" size="sm" block={false} align="center" onPress={() => openCompose({})} />
            </FadeUp>
          )}
          {kommune ? (
            <Note icon="pin" style={styles.center}>
              {nb.noticeboard.scope(kommune)}
            </Note>
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
        kommune={kommune}
        place={me.place || kommune}
        userId={me.id}
        onClose={() => setCompose(null)}
        onPublished={(post) => {
          setCompose(null);
          if (filter !== 'ALL' && filter !== noticeType(post)) setFilter('ALL');
          setFreshId(post.id);
        }}
      />
      {/* the same sheet, prefilled, for the owner's "Rediger" */}
      <ComposeSheet
        key={editing?.id ?? 'edit'}
        visible={!!editing}
        editing={editing ?? undefined}
        kommune={kommune}
        place={me.place || kommune}
        userId={me.id}
        onClose={() => setEditing(null)}
        onPublished={() => setEditing(null)}
      />
      <CommentsSheet
        post={all.find((p) => p.id === commentsFor) ?? null}
        meId={me.id}
        onClose={() => setCommentsFor(null)}
      />
      <Sheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.title}>
        {menuFor ? (
          <ListGroup>
            {menuFor.authorProfileId === me.id ? (
              <>
                <ListRow icon="edit" title={nb.noticeboard.menuEdit} onPress={() => closeMenu(() => setEditing(menuFor))} />
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
          </ListGroup>
        ) : null}
      </Sheet>
      <ImageViewer images={viewer?.imageUrl ? [viewer.imageUrl] : []} caption={viewer?.title} onClose={() => setViewer(null)} />
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

function PostCard({
  post,
  now,
  fresh,
  mine,
  meId,
  saved,
  onLike,
  onReply,
  onSave,
  onMore,
  onPhoto,
}: {
  post: NoticeboardPost;
  now: number;
  fresh: boolean;
  mine: boolean;
  meId: string;
  saved: boolean;
  onLike: () => void;
  onReply: () => void;
  onSave: () => void;
  onMore: () => void;
  onPhoto: () => void;
}) {
  const { data: author } = useProfile(post.authorProfileId);
  const type = noticeType(post);
  const k = NOTICE_STYLE[type];
  const likes = post.likes ?? 0;
  const replies = post.replies ?? 0;
  return (
    <View style={[styles.feedCard, styles.post, shadow.card, fresh && styles.postFresh]}>
      <View style={styles.postHead}>
        <Avatar initials={author?.initials ?? '·'} uri={author?.avatarUrl} seed={post.authorProfileId} size={44} ring={false} />
        <View style={styles.flex}>
          <Text style={styles.who} numberOfLines={1}>
            {author?.displayName ?? ''}
          </Text>
          <View style={styles.metaRow}>
            <Icon name={post.neighbourhoodId ? 'home' : 'globe'} size={12} color={colors.mute} />
            <Text style={[text.meta, styles.f125, styles.flex]} numberOfLines={1}>
              {[post.neighbourhoodId ? nb.noticeboard.onlyNabolag(post.place) : post.place, fresh ? nb.noticeboard.justNow : postedAgo(post.createdAt, new Date(now)), post.editedAt ? nb.noticeboard.edited : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
        <IconButton icon="more" variant="ghost" iconSize={20} accessibilityLabel={nb.noticeboard.moreAria(post.title)} onPress={onMore} />
      </View>

      <View style={styles.postText}>
        <View style={styles.tags}>
          <View style={[styles.kp, { backgroundColor: k.bg }]}>
            <Icon name={k.icon} size={13} color={k.fg} />
            <Text style={[styles.kpText, { color: k.fg }]}>{nb.noticeboard.kinds[type]}</Text>
          </View>
          {post.doneAt ? <Pill label={nb.noticeboard.done} tone="ok" icon="check" size="sm" /> : null}
        </View>
        <Text style={styles.title}>{post.title}</Text>
        {post.body ? <Text style={styles.body}>{post.body}</Text> : null}
      </View>

      {post.imageUrl ? (
        <Pressable accessibilityRole="imagebutton" accessibilityLabel={nb.noticeboard.openPhoto(post.title)} onPress={onPhoto} style={styles.tile}>
          <Image source={{ uri: post.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        </Pressable>
      ) : null}

      {post.isDugnad || post.kind === 'TOOL_LEND' ? (
        <View style={styles.panels}>
          {post.isDugnad ? <DugnadPanel post={post} meId={meId} mine={mine} /> : null}
          {post.kind === 'TOOL_LEND' ? <ToolLoanPanel post={post} meId={meId} mine={mine} /> : null}
        </View>
      ) : null}

      {likes || replies ? (
        <View style={styles.counts}>
          {likes ? (
            <View style={styles.likeCount}>
              <View style={styles.heartDot}>
                <Icon name="heart" size={11} color={colors.white} filled />
              </View>
              <Text style={[text.meta, styles.f125]}>{nb.noticeboard.likes(likes)}</Text>
            </View>
          ) : (
            <View />
          )}
          {replies ? <Text style={[text.meta, styles.f125]}>{nb.noticeboard.replies(replies)}</Text> : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Action
          icon="heart"
          label={nb.noticeboard.like}
          on={!!post.likedByMe}
          onColor={colors.heart}
          a11y={nb.noticeboard.likeAria(post.title, likes)}
          onPress={onLike}
        />
        <Action icon="msg" label={nb.noticeboard.reply} a11y={nb.noticeboard.replyAria(post.title, replies)} onPress={onReply} />
        {mine ? null : <Action icon="bookmark" label={saved ? nb.noticeboard.savedLabel : nb.noticeboard.save} on={saved} onColor={colors.ink} a11y={saved ? nb.noticeboard.savedLabel : nb.noticeboard.save} onPress={onSave} />}
      </View>

      {replies ? <LatestReply postId={post.id} total={replies} now={now} onOpen={onReply} /> : null}
    </View>
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
        <Text style={styles.previewMeta}>{`${postedAgo(last.createdAt, new Date(now))}${total > 1 ? ` · ${nb.noticeboard.seeAll(total)}` : ''}`}</Text>
      </View>
    </Pressable>
  );
}

/** "Svar": public comments under one oppslag, oldest first, with a field to add your own. */
function CommentsSheet({ post, meId, onClose }: { post: NoticeboardPost | null; meId: string; onClose: () => void }) {
  return (
    <Sheet
      visible={!!post}
      onClose={onClose}
      title={nb.noticeboard.commentsTitle}
      subtitle={post?.title}
      titleSize="h2"
      scroll
      heightRatio={0.85}
    >
      {post ? (
        <Comments
          post={post}
          meId={meId}
          onReport={(c) => {
            onClose();
            safePush(`/rapporter?kommentar=${c.id}&profil=${c.authorProfileId}`);
          }}
        />
      ) : null}
    </Sheet>
  );
}

function Comments({ post, meId, onReport }: { post: NoticeboardPost; meId: string; onReport: (c: NoticeComment) => void }) {
  const { data, isLoading, isError, refetch } = useNoticeComments(post.id);
  const add = useAddNoticeComment(post.id);
  const del = useDeleteNoticeComment(post.id);
  const [draft, setDraft] = useState('');
  const [now] = useState(() => Date.now());
  const list = data ?? [];
  const mineOppslag = post.authorProfileId === meId;

  const send = () => {
    const t = draft.trim();
    if (!t || add.isPending) return;
    add.mutate(t, {
      onSuccess: () => {
        setDraft('');
        haptics.light();
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
    });
  };

  return (
    <View style={styles.cwrap}>
      {post.doneAt ? (
        <Note icon="check">{nb.noticeboard.doneNote}</Note>
      ) : (
        <View style={styles.cform}>
          <Input
            value={draft}
            onChangeText={(v) => setDraft(v.slice(0, COMMENT_MAX))}
            placeholder={nb.noticeboard.commentPh}
            multiline
            accessibilityLabel={nb.noticeboard.commentLabel}
            style={styles.cinput}
          />
          <View style={styles.cformFoot}>
            <Text style={text.hint}>{`${draft.length}/${COMMENT_MAX}`}</Text>
            <Button
              label={nb.noticeboard.commentSend}
              icon="send"
              variant="ink"
              size="sm"
              block={false}
              disabled={!draft.trim()}
              loading={add.isPending}
              onPress={send}
            />
          </View>
          <Note icon="eye">{nb.noticeboard.commentPublic}</Note>
        </View>
      )}

      {isLoading ? (
        <RowSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : list.length === 0 ? (
        <Text style={[text.meta, styles.cempty]}>{nb.noticeboard.noComments}</Text>
      ) : (
        list.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            now={now}
            byOwner={c.authorProfileId === post.authorProfileId}
            canDelete={c.authorProfileId === meId || mineOppslag}
            onDelete={() => del.mutate(c.id, { onError: () => toast.error(nb.toast.genericError) })}
            onReport={c.authorProfileId === meId ? undefined : () => onReport(c)}
          />
        ))
      )}
    </View>
  );
}

function CommentRow({
  comment: c,
  now,
  byOwner,
  canDelete,
  onDelete,
  onReport,
}: {
  comment: NoticeComment;
  now: number;
  byOwner: boolean;
  canDelete: boolean;
  onDelete: () => void;
  /** someone else's comment can be reported */
  onReport?: () => void;
}) {
  const { data: author } = useProfile(c.authorProfileId);
  return (
    <View style={styles.crow}>
      <Avatar initials={author?.initials ?? '·'} uri={author?.avatarUrl} seed={c.authorProfileId} size={36} ring={false} />
      <View style={styles.cbody}>
        <View style={styles.chead}>
          <Text style={styles.cname} numberOfLines={1}>
            {author?.displayName ?? ''}
          </Text>
          {byOwner ? <Pill label={nb.noticeboard.author} tone="neutral" size="sm" /> : null}
          <Text style={[text.meta, styles.f125]}>{postedAgo(c.createdAt, new Date(now))}</Text>
        </View>
        <Text style={styles.ctext}>{c.body}</Text>
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

function ComposeSheet({
  visible,
  editing,
  startType,
  startPhoto,
  startTitle,
  startBody,
  kommune,
  place,
  userId,
  onClose,
  onPublished,
}: {
  /** a quick action under the writing box picked the type already */
  startType?: NoticeType;
  /** «Bilde» under the writing box picked it already */
  startPhoto?: Photo;
  startTitle?: string;
  startBody?: string;
  visible: boolean;
  /** set → the sheet edits this oppslag instead of making a new one */
  editing?: NoticeboardPost;
  kommune: string;
  place: string;
  userId: string;
  onClose: () => void;
  onPublished: (post: NoticeboardPost) => void;
}) {
  const create = useCreateNoticeboardPost();
  const update = useUpdateNoticeboardPost();
  const [type, setType] = useState<NoticeType | null>(editing ? noticeType(editing) : (startType ?? (startTitle ? 'GENERAL' : null)));
  const dugnad = type === 'DUGNAD';
  const [title, setTitle] = useState(editing?.title ?? startTitle ?? '');
  const [body, setBody] = useState(editing?.body ?? startBody ?? '');
  const [eventDay, setEventDay] = useState<Date | null>(null);
  const [eventTime, setEventTime] = useState('10:00');
  const [photo, setPhoto] = useState<Photo | null>(editing?.imageUrl ? { path: editing.imageUrl, url: editing.imageUrl } : (startPhoto ?? null));
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [shake, setShake] = useState(0);
  // who can read it: null = the whole kommune, or one of my nabolag
  const myNabolag = useMyNabolag(!!userId).data ?? [];
  const [audience, setAudience] = useState<string | null>(null);
  const target = myNabolag.find((n) => n.id === audience);

  const titleBad = title.trim().length < 4;
  const textBad = body.trim().length < 10;

  const reset = () => {
    setType(null);
    setTitle('');
    setBody('');
    setPhoto(null);
    setTried(false);
    setAudience(null);
    setEventDay(null);
  };

  const addPhoto = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const res = await pickAndUpload({ bucket: 'listing-images', folder: userId, source: 'library' });
      if (res) setPhoto({ path: res.path, url: res.publicUrl });
    } catch (e) {
      toast.error(serverMessage(e, nb.toast.genericError));
    } finally {
      setBusy(false);
    }
  };

  const publish = () => {
    if (!type || titleBad || textBad || (dugnad && !eventDay && !editing)) {
      setTried(true);
      if (!type) setShake((n) => n + 1);
      haptics.warning();
      return;
    }
    // a dugnad is a GENERAL oppslag with a date, so older apps still show it (0090)
    const kind: NoticeKind = type === 'DUGNAD' ? 'GENERAL' : type;
    if (editing) {
      update.mutate(
        { id: editing.id, patch: { kind, title: title.trim(), body: body.trim(), imagePath: photo?.path ?? null } },
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
        imagePath: photo?.path,
        neighbourhoodId: target?.id,
        ...(dugnad && eventDay ? { isDugnad: true, eventAt: eventIso(eventDay, eventTime) } : {}),
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

  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? nb.noticeboard.editTitle : nb.noticeboard.newPost} titleSize="h2" scroll heightRatio={0.9}>
      <View style={styles.labelRow}>
        <Text style={text.label}>{nb.noticeboard.typeLabel}</Text>
        <Text style={text.hint}>{nb.noticeboard.typeHint}</Text>
      </View>
      <Shake shakeKey={shake} style={styles.kinds}>
        {NOTICE_TYPES.map((k) => {
          const on = type === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={nb.noticeboard.kinds[k]}
              onPress={() => setType(k)}
              style={[styles.kchip, on && styles.kchipOn]}
            >
              <Icon name={NOTICE_STYLE[k].icon} size={16} color={on ? colors.white : colors.ink2} />
              <Text style={[styles.kchipText, on && styles.white]}>{nb.noticeboard.kinds[k]}</Text>
            </Pressable>
          );
        })}
      </Shake>
      {tried && !type ? <ErrorText shakeKey={shake}>{nb.noticeboard.errKind}</ErrorText> : null}

      {!editing && dugnad ? (
        <View style={styles.dugnadBox}>
          <Text style={text.meta}>{nb.dugnad.toggleSub}</Text>
          <View style={styles.dugnadWhen}>
            <DateField label={nb.dugnad.date} value={eventDay} onChange={setEventDay} minToday />
            {tried && !eventDay ? <ErrorText>{nb.dugnad.dateMissing}</ErrorText> : null}
            <TimeField label={nb.dugnad.time} value={eventTime} onChange={setEventTime} />
          </View>
        </View>
      ) : null}

      <Field
        label={nb.noticeboard.titleLabel}
        hint={`${title.length}/${TITLE_MAX}`}
        error={tried && titleBad ? nb.noticeboard.errTitle : null}
        style={styles.mt18}
      >
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder={nb.noticeboard.titlePh}
          maxLength={TITLE_MAX}
          error={tried && titleBad}
          accessibilityLabel={nb.noticeboard.titleLabel}
        />
      </Field>
      <Field
        label={nb.noticeboard.textLabel}
        hint={`${body.length}/${TEXT_MAX}`}
        error={tried && textBad ? nb.noticeboard.errText : null}
        style={styles.mt14}
      >
        <Input
          value={body}
          onChangeText={setBody}
          placeholder={nb.noticeboard.textPh}
          maxLength={TEXT_MAX}
          multiline
          error={tried && textBad}
          accessibilityLabel={nb.noticeboard.textLabel}
        />
      </Field>

      <View style={[styles.labelRow, styles.mt16]}>
        <Text style={text.label}>{nb.noticeboard.photoLabel}</Text>
        <Text style={text.hint}>{nb.noticeboard.optional}</Text>
      </View>
      {photo ? (
        <View style={styles.photo}>
          <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          <IconButton icon="trash" variant="glass" iconSize={18} accessibilityLabel={nb.noticeboard.removePhoto} onPress={() => setPhoto(null)} style={styles.photoRm} />
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={nb.noticeboard.addPhoto} onPress={addPhoto} style={styles.photoAdd}>
          {busy ? <Spinner size={22} color={colors.mute} /> : <Icon name="camera" size={24} color={colors.mute} />}
          <Text style={styles.photoAddText}>{nb.noticeboard.addPhoto}</Text>
        </Pressable>
      )}

      {editing ? null : (
        <>
          <View style={[styles.labelRow, styles.mt16]}>
            <Text style={text.label}>{nb.noticeboard.audienceLabel}</Text>
          </View>
          <View style={styles.kinds} accessibilityRole="radiogroup" accessibilityLabel={nb.noticeboard.audienceLabel}>
            {[null, ...myNabolag].map((n) => {
              const on = (n?.id ?? null) === audience;
              const label = n ? nb.noticeboard.audienceNabolag(n.place) : nb.noticeboard.audienceAll(kommune);
              return (
                <Pressable
                  key={n?.id ?? 'all'}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={label}
                  onPress={() => setAudience(n?.id ?? null)}
                  style={[styles.kchip, on && styles.kchipOn]}
                >
                  <Icon name={n ? 'home' : 'globe'} size={16} color={on ? colors.white : colors.ink2} />
                  <Text style={[styles.kchipText, on && styles.white]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[text.hint, styles.mt8]}>{myNabolag.length ? nb.noticeboard.audienceHint : nb.noticeboard.audienceNoNabolag}</Text>
        </>
      )}

      <View style={styles.where}>
        <View style={styles.whereIcon}>
          <Icon name={target ? 'home' : 'globe'} size={16} color={colors.ink} />
        </View>
        <Text style={styles.whereText}>
          <Text style={styles.whereStrong}>{target ? nb.noticeboard.shownInNabolag(target.place) : nb.noticeboard.shownIn(kommune)}</Text>
          {`\n${nb.noticeboard.approxOnly}`}
        </Text>
      </View>

      <Button label={editing ? nb.noticeboard.saveEdit : nb.noticeboard.publish} variant="lime" size="lg" icon="send" loading={create.isPending || update.isPending} onPress={publish} style={styles.mt18} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  dugnadBox: { marginTop: 14, padding: 14, borderRadius: radius.card, backgroundColor: colors.limeSoft, gap: 12 },
  dugnadWhen: { gap: 12 },
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
  list: { gap: 10, marginTop: 8 },
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
  cinput: { minHeight: 76, textAlignVertical: 'top' },
  cformFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cempty: { textAlign: 'center', paddingVertical: 18 },
  crow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cbody: { flex: 1, minWidth: 0, gap: 3, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.m, backgroundColor: colors.bg },
  chead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
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
