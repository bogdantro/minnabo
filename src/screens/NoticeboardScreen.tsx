import { useState } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NoticeKind } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import {
  useNoticeboard,
  useCreateNoticeboardPost,
  useDeleteNoticeboardPost,
  useProfile,
} from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { formatRelative } from '@/lib/datetime';
import { toast } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { haptics } from '@/lib/haptics';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { ScreenState } from '@/components/ui/ScreenState';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { TextField } from '@/components/ui/TextField';

const KIND_ORDER: NoticeKind[] = ['GIVEAWAY', 'LOST_FOUND', 'TOOL_LEND', 'GENERAL'];
const KIND_ICON: Record<NoticeKind, IconName> = {
  GIVEAWAY: 'gift',
  LOST_FOUND: 'search',
  TOOL_LEND: 'tool',
  GENERAL: 'message-square',
};

export function NoticeboardScreen() {
  const me = useCurrentUser();
  const { municipalities, municipality } = useLocationScope();
  const [filter, setFilter] = useState<NoticeKind | 'ALL'>('ALL');
  const { data: posts, isLoading, isError, refetch } = useNoticeboard(
    filter === 'ALL' ? undefined : filter,
  );
  const scoped = municipalities.length > 0;
  const visiblePosts = (posts ?? []).filter(
    (n) => !scoped || municipalities.includes(n.municipality),
  );
  const create = useCreateNoticeboardPost();
  const del = useDeleteNoticeboardPost();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<NoticeKind>('GIVEAWAY');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [place, setPlace] = useState(me.place ?? '');

  const submit = () => {
    if (!title.trim() || !body.trim()) {
      toast.error(nb.noticeboard.missingFields);
      return;
    }
    create.mutate(
      {
        kind,
        title,
        body,
        place: place.trim() || (me.place ?? ''),
        municipality: me.municipality ?? '',
      },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(nb.noticeboard.published);
          setOpen(false);
          setTitle('');
          setBody('');
        },
        onError: () => toast.error(nb.toast.genericError),
      },
    );
  };

  const remove = async (id: string) => {
    const ok = await confirm({ title: nb.noticeboard.deleteConfirm, destructive: true, confirmLabel: nb.noticeboard.remove });
    if (ok) del.mutate(id, { onSuccess: () => toast.success(nb.noticeboard.deleted) });
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.noticeboard.title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{nb.noticeboard.title}</ScreenTitle>
        <AppText variant="body" color="navyMuted">
          {nb.noticeboard.body}
        </AppText>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {(['ALL', ...KIND_ORDER] as const).map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === k }}
              accessibilityLabel={k === 'ALL' ? nb.noticeboard.all : nb.noticeboard.kinds[k]}
              onPress={() => setFilter(k)}
              style={[styles.filter, filter === k && styles.filterActive]}
            >
              <AppText variant="meta" weight="bold" color={filter === k ? 'lime' : 'navy'}>
                {k === 'ALL' ? nb.noticeboard.all : nb.noticeboard.kinds[k]}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>

        <Button label={nb.noticeboard.newPost} iconRight="plus" onPress={() => setOpen(true)} />

        {isLoading ? (
          <ScreenState status="loading" />
        ) : isError ? (
          <ScreenState status="error" onRetry={() => refetch()} />
        ) : visiblePosts.length === 0 ? (
          <ScreenState
            status="empty"
            emptyText={scoped ? nb.location.emptyNotices(municipality ?? '') : nb.noticeboard.empty}
          />
        ) : (
          <View style={styles.list}>
            {visiblePosts.map((p) => (
              <PostCard key={p.id} post={p} canDelete={p.authorProfileId === me.id} onDelete={() => remove(p.id)} />
            ))}
          </View>
        )}
      </ScrollView>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={nb.noticeboard.newPost} heightRatio={0.78}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <AppText variant="meta" weight="bold" color="navyMuted">
            {nb.noticeboard.kindLabel}
          </AppText>
          <View style={styles.kindRow}>
            {KIND_ORDER.map((k) => (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityState={{ selected: kind === k }}
                accessibilityLabel={nb.noticeboard.kinds[k]}
                onPress={() => setKind(k)}
                style={[styles.kindChip, kind === k && styles.filterActive]}
              >
                <Icon name={KIND_ICON[k]} size={14} color={kind === k ? 'lime' : 'navy'} />
                <AppText variant="meta" weight="bold" color={kind === k ? 'lime' : 'navy'}>
                  {nb.noticeboard.kinds[k]}
                </AppText>
              </Pressable>
            ))}
          </View>
          <TextField label={nb.noticeboard.titleField} value={title} onChangeText={setTitle} />
          <TextField label={nb.noticeboard.bodyField} value={body} onChangeText={setBody} multiline />
          <TextField label={nb.noticeboard.placeField} value={place} onChangeText={setPlace} />
          <View style={styles.sheetAction}>
            <Button label={nb.noticeboard.publish} onPress={submit} loading={create.isPending} />
          </View>
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

function PostCard({
  post,
  canDelete,
  onDelete,
}: {
  post: import('@/domain/types').NoticeboardPost;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { data: author } = useProfile(post.authorProfileId);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <StatusPill label={nb.noticeboard.kinds[post.kind]} tone="lime" />
        {canDelete ? (
          <Pressable accessibilityRole="button" accessibilityLabel={nb.noticeboard.remove} hitSlop={8} onPress={onDelete}>
            <Icon name="trash-2" size={16} color="navyMuted" />
          </Pressable>
        ) : null}
      </View>
      <AppText variant="cardTitle" weight="bold">
        {post.title}
      </AppText>
      <AppText variant="body" color="navyMuted">
        {post.body}
      </AppText>
      <AppText variant="meta" color="navyMuted">
        {author?.displayName ?? 'Nabo'} · {post.place} · {formatRelative(post.createdAt)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxxl },
  filters: { gap: tokens.space.sm, paddingVertical: tokens.space.xs },
  filter: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
  },
  filterActive: { borderColor: tokens.color.lime, backgroundColor: tokens.color.limeTint },
  list: { gap: tokens.space.md, marginTop: tokens.space.sm },
  card: {
    gap: 6,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    ...tokens.shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm, marginVertical: tokens.space.sm },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
  },
  sheetAction: { marginTop: tokens.space.lg },
});
