import { useEffect, useState } from 'react';
import { serverMessage } from '@/lib/errors';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { NOTICE_KINDS, NOTICE_STYLE } from '@/components/community/noticeKinds';
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

type Filter = NoticeKind | 'ALL';
const TITLE_MAX = 60;
const TEXT_MAX = 400;
const COMMENT_MAX = 500;

/** Oppslagstavle (design/screens/Oppslagstavle.dc.html) – oppslag in your kommune. */
export function NoticeboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const scope = useLocationScope();
  const kommune = me.municipality || scope.municipality || '';
  const { data, isLoading, isError, refetch } = useNoticeboard();
  const del = useDeleteNoticeboardPost();
  const savedIds = useSavedNoticeIds().data ?? [];
  const toggleSaved = useToggleSavedNotice();
  const update = useUpdateNoticeboardPost();
  // "Svar" opens the public comments under the oppslag
  const { oppslag } = useLocalSearchParams<{ oppslag?: string }>();
  const [commentsFor, setCommentsFor] = useState<string | null>(typeof oppslag === 'string' ? oppslag : null);
  const [editing, setEditing] = useState<NoticeboardPost | null>(null);
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

  const [filter, setFilter] = useState<Filter>('ALL');
  const myNabolag = useMyNabolag(!!me.id).data ?? [];
  const [mineOnly, setMineOnly] = useState(false);
  const [compose, setCompose] = useState(false);
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
  const shown = filter === 'ALL' ? all : all.filter((p) => p.kind === filter);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/fellesskap'));
  const remove = async (id: string) => {
    const ok = await confirm({ title: nb.noticeboard.deleteConfirm, destructive: true, confirmLabel: nb.noticeboard.remove });
    if (ok) del.mutate(id, { onSuccess: () => toast.success(nb.noticeboard.deleted, { bottom: 100 }) });
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
            right={<IconButton icon="edit" iconSize={18} accessibilityLabel={nb.noticeboard.newPost} onPress={() => setCompose(true)} />}
          />
        }
      >
        <FadeUp style={[styles.px, styles.head]}>
          {kommune ? <Text style={text.eyebrow}>{nb.noticeboard.eyebrow(kommune)}</Text> : null}
          <Text style={text.h1} accessibilityRole="header">
            {nb.noticeboard.heading}
          </Text>
          <Text style={[text.body, styles.ink2]}>{nb.noticeboard.lead}</Text>
        </FadeUp>

        <FadeUp delay={80} style={styles.mt16}>
          <View accessibilityRole="tablist" accessibilityLabel={nb.noticeboard.kindLabel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {(['ALL', ...NOTICE_KINDS] as Filter[]).map((k) => {
                const on = filter === k;
                const st = k === 'ALL' ? { icon: 'pinned' as IconName, bg: colors.neutralPill, fg: colors.ink2 } : NOTICE_STYLE[k];
                const label = k === 'ALL' ? nb.noticeboard.all : nb.noticeboard.kinds[k];
                const n = k === 'ALL' ? all.length : all.filter((p) => p.kind === k).length;
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

        <View style={[styles.px, styles.list]}>
          {isLoading ? (
            <>
              <RowSkeleton />
              <RowSkeleton />
            </>
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
                  saved={savedIds.includes(p.id)}
                  onReply={() => setCommentsFor(p.id)}
                  onSave={() => save(p.id)}
                  onEdit={() => setEditing(p)}
                  onToggleDone={() => toggleDone(p)}
                  onDelete={() => remove(p.id)}
                />
              </Animated.View>
            ))
          ) : (
            <FadeUp style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="pinned" size={22} color={colors.cyanDeep} />
              </View>
              <Text style={styles.emptyTitle}>{nb.noticeboard.emptyTitle}</Text>
              {kommune ? <Text style={text.meta}>{nb.noticeboard.emptyText(kommune)}</Text> : null}
              <Button label={nb.noticeboard.write} variant="ghost" size="sm" block={false} align="center" onPress={() => setCompose(true)} />
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

      <View style={[styles.fab, { bottom: Math.max(30, insets.bottom + 14) }]} pointerEvents="box-none">
        <Button label={nb.noticeboard.newPost} variant="ink" size="lg" icon="plus" block={false} onPress={() => setCompose(true)} />
      </View>

      <ComposeSheet
        visible={compose}
        kommune={kommune}
        place={me.place || kommune}
        userId={me.id}
        onClose={() => setCompose(false)}
        onPublished={(post) => {
          setCompose(false);
          if (filter !== 'ALL' && filter !== post.kind) setFilter('ALL');
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
    </>
  );
}

function PostCard({
  post,
  now,
  fresh,
  mine,
  saved,
  onReply,
  onSave,
  onEdit,
  onToggleDone,
  onDelete,
}: {
  post: NoticeboardPost;
  now: number;
  fresh: boolean;
  mine: boolean;
  saved: boolean;
  onReply: () => void;
  onSave: () => void;
  onEdit: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
}) {
  const { data: author } = useProfile(post.authorProfileId);
  const k = NOTICE_STYLE[post.kind];
  return (
    <View style={[styles.post, shadow.card, fresh && styles.postFresh, !!post.doneAt && styles.postDone]}>
      <View style={styles.postHead}>
        <Avatar initials={author?.initials ?? '·'} uri={author?.avatarUrl} seed={post.authorProfileId} size={40} ring={false} />
        <View style={styles.flex}>
          <Text style={styles.who} numberOfLines={1}>
            {author?.displayName ?? ''}
          </Text>
          <Text style={[text.meta, styles.f125]}>
            {[post.neighbourhoodId ? nb.noticeboard.onlyNabolag(post.place) : post.place, fresh ? nb.noticeboard.justNow : postedAgo(post.createdAt, new Date(now)), post.editedAt ? nb.noticeboard.edited : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <View style={[styles.kp, { backgroundColor: k.bg }]}>
          <Icon name={k.icon} size={14} color={k.fg} />
          <Text style={[styles.kpText, { color: k.fg }]}>{nb.noticeboard.kinds[post.kind]}</Text>
        </View>
      </View>
      <View style={styles.gap6}>
        {post.doneAt ? <Pill label={nb.noticeboard.done} tone="ok" icon="check" size="sm" style={styles.selfStart} /> : null}
        <Text style={styles.title}>{post.title}</Text>
        {post.body ? <Text style={styles.body}>{post.body}</Text> : null}
      </View>
      {post.imageUrl ? (
        <View style={styles.tile}>
          <Image source={{ uri: post.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        </View>
      ) : null}
      <View style={styles.pact}>
        <Button
          label={post.replies ? nb.noticeboard.replies(post.replies) : nb.noticeboard.reply}
          icon="reply"
          variant="ink"
          size="sm"
          block={false}
          accessibilityLabel={nb.noticeboard.replyAria(post.title, post.replies ?? 0)}
          onPress={onReply}
        />
        {mine ? (
          <View style={styles.own}>
            <IconButton icon="edit" variant="ghost" iconSize={18} accessibilityLabel={nb.noticeboard.editAria(post.title)} onPress={onEdit} />
            <IconButton
              icon={post.doneAt ? 'undo' : 'check'}
              variant="ghost"
              iconSize={18}
              iconColor={post.doneAt ? colors.ink2 : colors.ok}
              accessibilityLabel={post.doneAt ? nb.noticeboard.reopenAria(post.title) : nb.noticeboard.doneAria(post.title)}
              onPress={onToggleDone}
            />
            <IconButton icon="trash" variant="ghost" iconSize={18} iconColor={colors.danger} accessibilityLabel={nb.noticeboard.remove} onPress={onDelete} />
          </View>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: saved }}
              accessibilityLabel={saved ? nb.noticeboard.savedLabel : nb.noticeboard.save}
              onPress={onSave}
              style={[styles.savebtn, saved && styles.savebtnOn]}
            >
              <Icon name="bookmark" size={16} color={saved ? colors.white : colors.ink2} filled={saved} />
              <Text style={[styles.savebtnText, saved && styles.white]}>{saved ? nb.noticeboard.savedLabel : nb.noticeboard.save}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
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
  kommune,
  place,
  userId,
  onClose,
  onPublished,
}: {
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
  const [kind, setKind] = useState<NoticeKind | null>(editing?.kind ?? null);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [photo, setPhoto] = useState<{ path: string; url: string } | null>(
    editing?.imageUrl ? { path: editing.imageUrl, url: editing.imageUrl } : null,
  );
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
    setKind(null);
    setTitle('');
    setBody('');
    setPhoto(null);
    setTried(false);
    setAudience(null);
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
    if (!kind || titleBad || textBad) {
      setTried(true);
      if (!kind) setShake((n) => n + 1);
      haptics.warning();
      return;
    }
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
      { kind, title: title.trim(), body: body.trim(), place, municipality: kommune, imagePath: photo?.path, neighbourhoodId: target?.id },
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
        {NOTICE_KINDS.map((k) => {
          const on = kind === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={nb.noticeboard.kinds[k]}
              onPress={() => setKind(k)}
              style={[styles.kchip, on && styles.kchipOn]}
            >
              <Icon name={NOTICE_STYLE[k].icon} size={16} color={on ? colors.white : colors.ink2} />
              <Text style={[styles.kchipText, on && styles.white]}>{nb.noticeboard.kinds[k]}</Text>
            </Pressable>
          );
        })}
      </Shake>
      {tried && !kind ? <ErrorText shakeKey={shake}>{nb.noticeboard.errKind}</ErrorText> : null}

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
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  head: { marginTop: 8, gap: 8 },
  ink2: { color: colors.ink2 },
  white: { color: colors.white },
  mt8: { marginTop: 8 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  scope: { flexDirection: 'row', gap: 8, marginTop: 6 },
  mt18: { marginTop: 18 },
  f125: { fontSize: 12.5 },
  gap6: { gap: 6 },
  center: { justifyContent: 'center', marginTop: 4 },
  bottom: { height: 120 },
  chips: { gap: 8, paddingHorizontal: screenPadding, paddingTop: 2, paddingBottom: 6 },
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
  list: { gap: 14, marginTop: 12 },
  post: { backgroundColor: colors.surface, borderRadius: 26, padding: 16, gap: 12 },
  postFresh: { borderWidth: 2, borderColor: colors.lime },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },
  kp: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: radius.pill },
  kpText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  title: { fontFamily: fonts.display, fontSize: 17, lineHeight: 21, letterSpacing: -0.2, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21.75, color: colors.ink2 },
  tile: { height: 150, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.track },
  pact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savebtn: {
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
  savebtnOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  savebtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink2 },
  own: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  postDone: { opacity: 0.72 },
  selfStart: { alignSelf: 'flex-start' },
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
  empty: {
    padding: 26,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: 20,
  },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, textAlign: 'center' },
  fab: { position: 'absolute', right: screenPadding, zIndex: 20 },
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
