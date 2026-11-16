import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NoticeboardPost, NoticeReactionEmoji } from '@/domain/types';
import nb from '@/i18n/nb';
import {
  useEventRsvps,
  useNoticePoll,
  useNoticeQueue,
  useNoticeReactions,
  useNoticeReservations,
  useProfile,
  useReserveNotice,
  useSetEventRsvp,
  useSetNoticeReaction,
  useSettleReservation,
  useVoteNoticePoll,
} from '@/api/queries';
import { formatTime, shortDate } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { REACTIONS } from '@/domain/reactions';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, text } from '@/theme/theme';
import { Avatar, Button, Icon, Pill } from '@/components/ui';

const BOTTOM = 100;
const FACES = 5;
/** «Svar på dette» shows on an oppslag nobody has answered after this long. */
export const ANSWER_PROMPT_AFTER = 24 * 60 * 60 * 1000;

const fail = (e: unknown) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: BOTTOM });

function Face({ id }: { id: string }) {
  const p = useProfile(id).data;
  return (
    <View style={styles.face}>
      <Avatar initials={p?.initials ?? '·'} uri={p?.avatarUrl} seed={id} size={30} ring={false} />
    </View>
  );
}

/** Is this oppslag an arrangement (a dugnad or any other kind)? */
export const isEvent = (p: Pick<NoticeboardPost, 'isDugnad' | 'eventType'>) => !!p.isDugnad || !!p.eventType;

// ------------------------------------------------------------------
// Arrangement: when, who comes, «Kommer» / «Kanskje», the group chat
// ------------------------------------------------------------------
export function EventPanel({
  post,
  mine,
  youth,
  now,
  showWhen = true,
  onLeave,
}: {
  post: NoticeboardPost;
  mine: boolean;
  youth: boolean;
  now: number;
  /** off where the date is already shown above (the popup in «Skjer i nærheten») */
  showWhen?: boolean;
  /** called before going to the group chat, so a popup can close first */
  onLeave?: () => void;
}) {
  const { data } = useEventRsvps(post.id);
  const set = useSetEventRsvp(post.id);
  const going = data?.going ?? 0;
  const maybe = data?.maybe ?? 0;
  const myAnswer = data?.mine ?? null;
  const over = !!post.doneAt || (!!post.eventAt && Date.parse(post.eventAt) < now);
  // the chat stays open a week after (can_use_event_chat in 0101); never for youth (rule 5)
  const chatOpen = !youth && (mine || !!myAnswer) && (!post.eventAt || Date.parse(post.eventAt) > now - 7 * 86_400_000);
  const t = nb.events;

  const answer = (status: 'GOING' | 'MAYBE') => {
    const next = myAnswer === status ? null : status;
    set.mutate(next, {
      onSuccess: () => {
        haptics.success();
        toast.success(next === 'GOING' ? t.goingToast : next === 'MAYBE' ? t.maybeToast : t.leftToast, { icon: next ? 'check' : 'x', bottom: BOTTOM });
      },
      onError: fail,
    });
  };

  return (
    <View style={styles.panel}>
      {post.eventAt && showWhen ? (
        <View style={styles.when}>
          <View style={styles.dateTile}>
            <Text style={styles.dateDay}>{new Date(post.eventAt).getDate()}</Text>
            <Text style={styles.dateMon}>{shortDate(post.eventAt).split(' ')[2] ?? ''}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={text.label}>{`${shortDate(post.eventAt)} kl. ${formatTime(post.eventAt)}`}</Text>
            <Text style={text.meta}>{post.place}</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.line}>
        {data?.goingIds.length ? (
          <View style={styles.faces}>
            {data.goingIds.slice(0, FACES).map((id) => (
              <Face key={id} id={id} />
            ))}
          </View>
        ) : null}
        <Text style={[text.meta, styles.flex]}>
          {going || maybe ? [t.goingCount(going), maybe ? t.maybeCount(maybe) : null].filter(Boolean).join(' · ') : t.nobodyYet}
        </Text>
      </View>
      {over ? (
        <Pill label={t.over} tone="neutral" icon="check" size="sm" />
      ) : !mine ? (
        <View style={styles.rsvp} accessibilityRole="radiogroup">
          {(['GOING', 'MAYBE'] as const).map((s) => {
            const on = myAnswer === s;
            const label = s === 'GOING' ? t.going : t.maybe;
            return (
              <Pressable
                key={s}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: set.isPending }}
                accessibilityLabel={t.rsvpA11y(label, on)}
                disabled={set.isPending}
                onPress={() => answer(s)}
                style={({ pressed }) => [styles.rsvpBtn, on && (s === 'GOING' ? styles.rsvpGoing : styles.rsvpMaybe), pressed && styles.pressed]}
              >
                <Icon name={s === 'GOING' ? 'check' : 'hourglass'} size={16} color={on ? (s === 'GOING' ? colors.ink : colors.white) : colors.ink2} />
                <Text style={[styles.rsvpText, on && s === 'MAYBE' && styles.white]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {chatOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.chat}, ${t.chatSub(going)}`}
          onPress={() => {
            onLeave?.();
            safePush(`/arrangement/${post.id}`);
          }}
          style={({ pressed }) => [styles.chatRow, pressed && styles.pressed]}
        >
          <View style={styles.chatIc}>
            <Icon name="msg" size={16} color={colors.lime} />
          </View>
          <View style={styles.flex}>
            <Text style={text.label}>{t.chat}</Text>
            <Text style={text.meta}>{t.chatSub(going)}</Text>
          </View>
          <Icon name="right" size={18} color={colors.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------
// Avstemning: bars with the share of votes; tap again to take it back
// ------------------------------------------------------------------
export function PollPanel({ post, now }: { post: NoticeboardPost; now: number }) {
  const { data } = useNoticePoll(post.id, !!post.pollOptions?.length);
  const vote = useVoteNoticePoll(post.id);
  const options = post.pollOptions ?? [];
  if (!options.length) return null;
  const closed = !!post.doneAt || (!!post.pollClosesAt && Date.parse(post.pollClosesAt) < now);
  const total = data?.total ?? 0;
  const mine = data?.mine ?? null;
  const t = nb.poll;
  return (
    <View style={styles.panel}>
      <View style={styles.line}>
        <Icon name="chart" size={16} color={colors.cyanDeep} />
        <Text style={[text.label, styles.flex]}>{t.title}</Text>
        <Text style={text.meta}>{t.votes(total)}</Text>
      </View>
      {options.map((label, i) => {
        const n = data?.counts[i] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const on = mine === i;
        return (
          <Pressable
            key={`${i}-${label}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: closed }}
            accessibilityLabel={t.voteA11y(label, pct, on)}
            disabled={closed || vote.isPending}
            onPress={() => {
              haptics.select();
              vote.mutate(on ? null : i, { onError: fail });
            }}
            style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && styles.pressed]}
          >
            {/* the bar shows only once someone has voted, so an empty poll doesn't look decided */}
            {total ? <View style={[styles.optionFill, on && styles.optionFillOn, { width: `${pct}%` }]} /> : null}
            <View style={[styles.radio, on && styles.radioOn]}>{on ? <Icon name="check" size={12} color={colors.white} /> : null}</View>
            <Text style={[styles.optionText, on && styles.optionTextOn]} numberOfLines={2}>
              {label}
            </Text>
            {total ? <Text style={styles.pct}>{`${pct} %`}</Text> : null}
          </Pressable>
        );
      })}
      <Text style={styles.hint}>{closed ? t.closed : mine !== null ? t.changeHint : ''}</Text>
    </View>
  );
}

// ------------------------------------------------------------------
// «Jeg vil ha den»: a queue on «Gis bort»
// ------------------------------------------------------------------
export function QueuePanel({ post, mine, authorFirst, onReply }: { post: NoticeboardPost; mine: boolean; authorFirst: string; onReply: () => void }) {
  const q = useNoticeQueue(post.id, !mine);
  const list = useNoticeReservations(post.id, mine);
  const reserve = useReserveNotice(post.id);
  const settle = useSettleReservation(post.id);
  const t = nb.queue;

  if (mine) {
    const waiting = (list.data ?? []).filter((r) => r.status === 'QUEUED' || r.status === 'OFFERED');
    const front = waiting.find((r) => r.status === 'OFFERED');
    if (post.doneAt) return null;
    return (
      <View style={styles.panel}>
        <View style={styles.line}>
          <Icon name="users" size={16} color={colors.okText} />
          <Text style={[text.label, styles.flex]}>{t.owner}</Text>
          <Text style={text.meta}>{t.waiting(waiting.length)}</Text>
        </View>
        {front ? (
          <FrontRow
            profileId={front.profileId}
            busy={settle.isPending}
            onTaken={() =>
              settle.mutate(true, {
                onSuccess: () => {
                  haptics.success();
                  toast.success(t.takenToast, { icon: 'check', bottom: BOTTOM });
                },
                onError: fail,
              })
            }
            onNoShow={() =>
              settle.mutate(false, {
                onSuccess: () => toast.info(t.nextToast, { icon: 'users', bottom: BOTTOM }),
                onError: fail,
              })
            }
          />
        ) : (
          <Text style={text.meta}>{t.ownerEmpty}</Text>
        )}
      </View>
    );
  }

  if (post.doneAt) return null;
  const myStatus = q.data?.mine ?? '';
  const inQueue = myStatus === 'QUEUED' || myStatus === 'OFFERED';
  const toggle = () =>
    reserve.mutate(!inQueue, {
      onSuccess: (place) => {
        haptics.success();
        if (inQueue) toast.info(t.leftToast, { icon: 'x', bottom: BOTTOM });
        else toast.success(t.joinedToast(place), { icon: 'gift', bottom: BOTTOM });
      },
      onError: fail,
    });
  return (
    <View style={styles.panel}>
      {myStatus === 'OFFERED' ? (
        <View style={[styles.queueMine, styles.queueFirst]}>
          <Icon name="gift" size={18} color={colors.ink} />
          <View style={styles.flex}>
            <Text style={text.label}>{t.first}</Text>
            <Text style={[text.meta, styles.ink]}>{t.firstSub(authorFirst)}</Text>
          </View>
        </View>
      ) : myStatus === 'QUEUED' ? (
        <View style={styles.queueMine}>
          <Icon name="hourglass" size={18} color={colors.okText} />
          <View style={styles.flex}>
            <Text style={text.label}>{t.place(q.data?.position ?? 0)}</Text>
            <Text style={text.meta}>{t.placeSub}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.line}>
          <Icon name="users" size={16} color={colors.okText} />
          <Text style={[text.meta, styles.flex]}>{t.waiting(q.data?.waiting ?? 0)}</Text>
        </View>
      )}
      <View style={styles.btnRow}>
        {myStatus === 'OFFERED' ? <Button label={t.write} icon="msg" variant="ink" size="sm" block={false} onPress={onReply} style={styles.grow} /> : null}
        <Button
          label={inQueue ? t.leave : t.join}
          icon={inQueue ? 'x' : 'gift'}
          variant={inQueue ? 'ghost' : 'lime'}
          size="sm"
          block={false}
          loading={reserve.isPending}
          onPress={toggle}
          style={styles.grow}
        />
      </View>
    </View>
  );
}

function FrontRow({ profileId, busy, onTaken, onNoShow }: { profileId: string; busy: boolean; onTaken: () => void; onNoShow: () => void }) {
  const who = useProfile(profileId).data;
  const t = nb.queue;
  return (
    <View style={styles.front}>
      <View style={styles.line}>
        <Avatar initials={who?.initials ?? '·'} uri={who?.avatarUrl} seed={profileId} size={34} ring={false} />
        <Text style={[text.label, styles.flex]} numberOfLines={1}>
          {t.ownerFirst(who?.displayName ?? '')}
        </Text>
      </View>
      <View style={styles.btnRow}>
        <Button label={t.noShow} icon="x" variant="ghost" size="sm" block={false} disabled={busy} onPress={onNoShow} style={styles.grow} />
        <Button label={t.taken} icon="check" size="sm" block={false} loading={busy} onPress={onTaken} style={styles.grow} />
      </View>
    </View>
  );
}

// ------------------------------------------------------------------
// Reactions: the five emoji under an oppslag
// ------------------------------------------------------------------
export function ReactionBar({ post, meId }: { post: NoticeboardPost; meId: string }) {
  const { data } = useNoticeReactions(post.id);
  const set = useSetNoticeReaction(post.id);
  const [open, setOpen] = useState(false);
  const all = data ?? [];
  const counts = REACTIONS.map((e) => ({ emoji: e, n: all.filter((r) => r.emoji === e).length, on: all.some((r) => r.emoji === e && r.profileId === meId) }));
  const shown = counts.filter((c) => c.n > 0 || open);
  const toggle = (emoji: NoticeReactionEmoji, on: boolean) => {
    haptics.light();
    set.mutate({ emoji, on: !on }, { onError: fail });
  };
  return (
    <View style={styles.reactRow}>
      {shown.map((c) => (
        <Pressable
          key={c.emoji}
          accessibilityRole="button"
          accessibilityState={{ selected: c.on }}
          accessibilityLabel={nb.reactions.a11y(c.emoji, c.n, c.on)}
          onPress={() => toggle(c.emoji, c.on)}
          style={({ pressed }) => [styles.react, c.on && styles.reactOn, pressed && styles.pressed]}
        >
          <Text style={styles.emoji}>{c.emoji}</Text>
          {c.n ? <Text style={[styles.reactN, c.on && styles.reactNOn]}>{c.n}</Text> : null}
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.reactions.pickA11y}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.react, styles.reactAdd, pressed && styles.pressed]}
      >
        <Icon name={open ? 'x' : 'smile'} size={16} color={colors.ink2} />
        {!open && !shown.length ? <Text style={styles.reactN}>{nb.reactions.pick}</Text> : null}
      </Pressable>
    </View>
  );
}

/** «Svar på dette»: an oppslag from someone else with no svar after a day. */
export function AnswerPrompt({ authorFirst, onReply }: { authorFirst: string; onReply: () => void }) {
  return (
    <View style={styles.answer}>
      <View style={styles.answerIc}>
        <Icon name="reply" size={16} color={colors.cyanDeep} />
      </View>
      <View style={styles.flex}>
        <Text style={text.label}>{nb.reactions.answerTitle}</Text>
        <Text style={text.meta}>{nb.reactions.answerBody(authorFirst)}</Text>
      </View>
      <Button label={nb.reactions.answerCta} variant="cyan" size="sm" block={false} onPress={onReply} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.m, backgroundColor: colors.surface2, padding: 12, gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.75 },
  white: { color: colors.white },
  ink: { color: colors.ink },
  faces: { flexDirection: 'row', marginRight: 8 },
  face: { marginRight: -8, borderRadius: 17, borderWidth: 2, borderColor: colors.surface2 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateTile: { width: 50, height: 54, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  dateDay: { fontFamily: fonts.display, fontSize: 21, lineHeight: 24, color: colors.ink },
  dateMon: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 13, color: colors.limeDeep, textTransform: 'uppercase' },
  rsvp: { flexDirection: 'row', gap: 8 },
  rsvpBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rsvpGoing: { backgroundColor: colors.lime, borderColor: colors.lime },
  rsvpMaybe: { backgroundColor: colors.ink, borderColor: colors.ink },
  rsvpText: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.ink },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, padding: 10, borderRadius: 16, backgroundColor: colors.white },
  chatIc: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  option: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  optionOn: { borderColor: colors.cyanDeep },
  optionFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.line2 },
  optionFillOn: { backgroundColor: colors.cyanTint },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.control, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: colors.cyanDeep, borderColor: colors.cyanDeep },
  optionText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.ink },
  optionTextOn: { color: colors.ink },
  pct: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink2 },
  hint: { ...text.meta, fontSize: 12.5 },
  queueMine: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.white },
  queueFirst: { backgroundColor: colors.lime },
  btnRow: { flexDirection: 'row', gap: 8 },
  grow: { flexGrow: 1, flexBasis: 0 },
  front: { gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.white },
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  react: {
    minHeight: 36,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.bg,
  },
  reactOn: { backgroundColor: colors.limeTint, borderColor: colors.limeDeep },
  reactAdd: { backgroundColor: colors.white, borderColor: colors.line },
  emoji: { fontSize: 16, lineHeight: 20 },
  reactN: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink2 },
  reactNOn: { color: colors.limeDeep },
  answer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.card, backgroundColor: colors.cyanTint },
  answerIc: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
});
