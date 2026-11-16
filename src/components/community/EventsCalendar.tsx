import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NoticeboardPost } from '@/domain/types';
import nb from '@/i18n/nb';
import { useEventRsvps, useProfile, useSetEventRsvp } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatTime, longDate } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { shareNotice } from '@/lib/share';
import { toast } from '@/lib/toast';
import { EVENT_ICON, EVENT_STYLE, eventTypeOf } from '@/components/community/noticeKinds';
import { EventPanel, isEvent } from '@/components/noticeboard/NoticePanels';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { Avatar, Button, Icon, Sheet } from '@/components/ui';
import { Image } from '@/components/ui/Image';

/** How far ahead the calendar looks. */
const AHEAD_DAYS = 45;
const DAY = 86_400_000;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
const WEEKDAYS = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];

/** The coming arrangements from Oppslagstavla, soonest first (pure, for tests). */
export function upcomingEvents(posts: NoticeboardPost[], now: number): NoticeboardPost[] {
  return posts
    .filter((p) => isEvent(p) && !p.doneAt && !!p.eventAt && Date.parse(p.eventAt) >= now - 2 * 60 * 60 * 1000 && Date.parse(p.eventAt) <= now + AHEAD_DAYS * DAY)
    .sort((a, b) => Date.parse(a.eventAt!) - Date.parse(b.eventAt!));
}

/** «I dag» / «I morgen» under the full date; nothing for a later day (it would only repeat it). */
function soon(iso: string, now: number): string | undefined {
  const label = dayLabel(iso, now);
  return label === nb.events.today || label === nb.events.tomorrow ? label : undefined;
}

/** «I dag», «I morgen» or «lør 22. nov». */
function dayLabel(iso: string, now: number): string {
  const d = new Date(iso);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - start.getTime()) / DAY);
  if (diff === 0) return nb.events.today;
  if (diff === 1) return nb.events.tomorrow;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

/**
 * «Skjer i nærheten» on Fellesskap (0101): a row of date cards. A tap opens everything about the arrangement
 * in a popup, with «Kommer» / «Kanskje» right there. Fellesskap only shows the section when there is one
 * (`upcomingEvents(...).length`).
 */
export function EventsCalendar({ posts, now }: { posts: NoticeboardPost[]; now: number }) {
  const events = useMemo(() => upcomingEvents(posts, now), [posts, now]);
  const [openId, setOpenId] = useState<string | null>(null);
  // the popup follows the live post, so «Kommer» counts and a cancelled arrangement show at once
  const open = events.find((p) => p.id === openId) ?? null;
  if (!events.length) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {events.map((p) => (
          <EventCard key={p.id} post={p} now={now} onOpen={() => setOpenId(p.id)} />
        ))}
      </ScrollView>
      <EventSheet post={open} now={now} onClose={() => setOpenId(null)} />
    </>
  );
}

/** «I dag», «I morgen», «Om 5 dager» – how soon, on the photo. */
export function countdown(iso: string, now: number): string {
  const label = dayLabel(iso, now);
  if (label === nb.events.today || label === nb.events.tomorrow) return label;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return nb.events.inDays(Math.floor((Date.parse(iso) - start.getTime()) / DAY));
}

function Face({ id, first }: { id: string; first: boolean }) {
  const p = useProfile(id).data;
  return (
    <View style={[styles.face, !first && styles.faceOver]}>
      <Avatar initials={p?.initials ?? '·'} uri={p?.avatarUrl} seed={id} size={26} ring={false} />
    </View>
  );
}

/**
 * One arrangement (2026-11-13): a band in the kind's own colour (or the photo) with the date tile and how soon,
 * then what, when and where, the faces of who is coming, and «Bli med» right on the card.
 */
function EventCard({ post, now, onOpen }: { post: NoticeboardPost; now: number; onOpen: () => void }) {
  const rsvps = useEventRsvps(post.id).data;
  const setRsvp = useSetEventRsvp(post.id);
  const going = rsvps?.going ?? 0;
  const ev = eventTypeOf(post) ?? 'ANNET';
  const st = EVENT_STYLE[ev];
  const at = new Date(post.eventAt!);
  const when = `${dayLabel(post.eventAt!, now)} kl. ${formatTime(post.eventAt!)}`;
  const photo = post.imageUrls?.[0] ?? post.imageUrl;
  const faces = (rsvps?.goingIds ?? []).slice(0, 3);
  const mineAnswer = rsvps?.mine ?? null;
  const join = () => {
    haptics.success();
    setRsvp.mutate('GOING', {
      onSuccess: () => toast.success(nb.events.goingToast, { icon: 'check' }),
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
    });
  };
  // the card opens the arrangement; «Bli med» is its own button beside it, never inside it
  return (
    <View style={[styles.card, shadow.card]}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nb.events.calA11y(post.title, when, going)}
      accessibilityHint={nb.events.openHint}
      onPress={onOpen}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={[styles.band, { backgroundColor: st.bg }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <>
            {/* the base design's ring and disc, in the kind's colour */}
            <View style={[styles.ring, { borderColor: st.fg }]} />
            <View style={[styles.disc, { borderColor: st.bg }]}>
              <Icon name={EVENT_ICON[ev]} size={26} color={st.fg} />
            </View>
            <View style={[styles.dot, styles.dotA, { backgroundColor: st.fg }]} />
            <View style={[styles.dot, styles.dotB, { backgroundColor: st.fg }]} />
          </>
        )}
        <View style={styles.date}>
          <Text style={styles.dateDay}>{at.getDate()}</Text>
          <Text style={styles.dateMon}>{MONTHS[at.getMonth()]}</Text>
        </View>
        <View style={styles.soon}>
          <Text style={styles.soonText}>{countdown(post.eventAt!, now)}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={[styles.kind, { backgroundColor: st.bg }]}>
          <Icon name={EVENT_ICON[ev]} size={12} color={st.fg} />
          <Text style={[styles.kindText, { color: st.fg }]} numberOfLines={1}>
            {nb.events.types[ev]}
          </Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {post.title}
        </Text>
        <View style={styles.metaRow}>
          <Icon name="clock" size={13} color={colors.mute} />
          <Text style={[text.meta, styles.flexText]} numberOfLines={1}>
            {when}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Icon name="pin" size={13} color={colors.mute} />
          <Text style={[text.meta, styles.flexText]} numberOfLines={1}>
            {post.place || post.municipality}
          </Text>
        </View>
      </View>
    </Pressable>

      <View style={[styles.cardBody, styles.footWrap]}>
        <View style={styles.foot}>
          {faces.length ? (
            <View style={styles.faces}>
              {faces.map((id, i) => (
                <Face key={id} id={id} first={i === 0} />
              ))}
            </View>
          ) : null}
          <Text style={[styles.footText, styles.flexText]} numberOfLines={1}>
            {going ? nb.events.goingCount(going) : nb.events.beFirst}
          </Text>
          {mineAnswer === 'GOING' ? (
            <View style={styles.youGo}>
              <Icon name="check" size={12} color={colors.okText} />
              <Text style={styles.youGoText}>{nb.events.youGoing}</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={nb.events.joinA11y(post.title)}
              onPress={join}
              disabled={setRsvp.isPending}
              hitSlop={6}
              style={({ pressed }) => [styles.join, pressed && styles.joinPressed]}
            >
              <Text style={styles.joinText}>{nb.events.join}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

/** Everything about one arrangement: what, when, where, who made it, the text, and «Kommer» / «Kanskje». */
function EventSheet({ post, now, onClose }: { post: NoticeboardPost | null; now: number; onClose: () => void }) {
  const me = useCurrentUser();
  const author = useProfile(post?.authorProfileId ?? '').data;
  const ev = post ? (eventTypeOf(post) ?? 'ANNET') : 'ANNET';
  const photo = post ? (post.imageUrls?.[0] ?? post.imageUrl) : undefined;
  const mine = !!post && post.authorProfileId === me.id;
  const t = nb.events;
  return (
    <Sheet visible={!!post} onClose={onClose} scroll heightRatio={0.88}>
      {post ? (
        <View style={styles.sheet}>
          {photo ? (
            <View style={styles.photo}>
              <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
            </View>
          ) : null}
          <View style={[styles.kind, styles.kindSheet]}>
            <Icon name={EVENT_ICON[ev]} size={13} color={colors.limeDeep} />
            <Text style={styles.kindText}>{t.types[ev]}</Text>
          </View>
          <Text style={text.h2} accessibilityRole="header">
            {post.title}
          </Text>

          <View style={styles.facts}>
            <Fact icon="cal" label={t.when} value={`${longDate(post.eventAt!)} · kl. ${formatTime(post.eventAt!)}`} sub={soon(post.eventAt!, now)} />
            <Fact icon="pin" label={t.where} value={post.place || post.municipality} sub={t.whereNote} />
            <View style={styles.fact}>
              <Avatar initials={author?.initials ?? '·'} uri={author?.avatarUrl} seed={post.authorProfileId} size={36} ring={false} />
              <View style={styles.flex}>
                <Text style={styles.factLabel}>{t.by}</Text>
                <Text style={styles.factValue}>{mine ? t.byYou : (author?.displayName ?? '')}</Text>
              </View>
              {!mine ? (
                <Pressable accessibilityRole="link" onPress={() => { onClose(); safePush(`/profil/${post.authorProfileId}`); }} hitSlop={8} style={styles.link}>
                  <Text style={text.link}>{t.seeProfile}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {post.body ? <Text style={[text.body, styles.body]}>{post.body}</Text> : null}

          {/* «Kommer» / «Kanskje», who is coming, and the group chat for those who answered */}
          <EventPanel post={post} mine={mine} youth={me.isYouth} now={now} showWhen={false} onLeave={onClose} />

          <View style={styles.actions}>
            <Button
              label={t.openBoard}
              icon="pinned"
              variant="ghost"
              size="sm"
              block={false}
              onPress={() => {
                onClose();
                safePush(`/oppslagstavle?oppslag=${post.id}`);
              }}
              style={styles.grow}
            />
            <Button
              label={t.share}
              icon="share"
              variant="ghost"
              size="sm"
              block={false}
              onPress={() => void shareNotice(post.id, `${post.title} – ${dayLabel(post.eventAt!, now)} kl. ${formatTime(post.eventAt!)}`)}
              style={styles.grow}
            />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

function Fact({ icon, label, value, sub }: { icon: 'cal' | 'pin'; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.factIc}>
        <Icon name={icon} size={18} color={colors.limeDeep} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
        {sub ? <Text style={text.meta}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 1 },
  pressed: { transform: [{ scale: 0.98 }] },
  row: { paddingHorizontal: screenPadding, gap: 12, paddingBottom: 6 },
  card: { width: 262, borderRadius: radius.listingCard, backgroundColor: colors.white, overflow: 'hidden', borderWidth: 1, borderColor: colors.hairline },
  band: { height: 118, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  ring: { position: 'absolute', right: -26, top: -30, width: 150, height: 150, borderRadius: 75, borderWidth: 1.5, borderStyle: 'dashed', opacity: 0.45 },
  disc: { position: 'absolute', right: 30, top: 26, width: 64, height: 64, borderRadius: 32, backgroundColor: colors.white, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, opacity: 0.6 },
  dotA: { left: 92, top: 22 },
  dotB: { left: 118, bottom: 18, width: 6, height: 6, borderRadius: 3 },
  date: { position: 'absolute', left: 14, top: 14, width: 54, height: 58, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  soon: { position: 'absolute', left: 14, bottom: 12, height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.white, justifyContent: 'center' },
  soonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  cardBody: { padding: 14, gap: 6 },
  footWrap: { paddingTop: 0, marginTop: -6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flexText: { flexShrink: 1, flexGrow: 1 },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 15, borderWidth: 2, borderColor: colors.white },
  faceOver: { marginLeft: -9 },
  youGo: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.okTint },
  youGoText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.okText },
  join: { height: 34, minWidth: 44, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  joinPressed: { opacity: 0.8 },
  joinText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lime },
  dateDay: { fontFamily: fonts.display, fontSize: 23, lineHeight: 26, color: colors.white },
  dateMon: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 13, color: colors.lime, textTransform: 'uppercase' },
  kind: { alignSelf: 'flex-start', flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.limeTint },
  kindSheet: { alignSelf: 'flex-start' },
  kindText: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.limeDeep },
  title: { fontFamily: text.h3.fontFamily, fontSize: 17, lineHeight: 21, color: colors.ink, marginTop: 2 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line2 },
  footText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink2 },
  sheet: { gap: 14 },
  photo: { height: 180, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.limeTint },
  facts: { gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.surface2 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  factIc: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  factLabel: { ...text.meta, fontSize: 12 },
  factValue: { ...text.label, fontSize: 15 },
  link: { minHeight: 44, justifyContent: 'center' },
  body: { color: colors.ink2 },
  actions: { flexDirection: 'row', gap: 10 },
  grow: { flexGrow: 1, flexBasis: 0 },
});
