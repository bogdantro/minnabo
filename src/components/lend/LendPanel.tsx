import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LendItem, NoticeboardPost } from '@/domain/types';
import nb from '@/i18n/nb';
import { useLendBusyDays, useLendItem, useLendRequests } from '@/api/queries';
import { busyToday, dateOf, dayStrip } from '@/domain/lend';
import { shortDate } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { colors, fonts, radius, text } from '@/theme/theme';
import { Button, Icon, Pill } from '@/components/ui';
import { LendItemSheet } from './LendItemSheet';

const DAYS = 7;
const WEEKDAY = ['S', 'M', 'T', 'O', 'T', 'F', 'L'];
const label = (day: string) => shortDate(dateOf(day).toISOString());

/**
 * A «Lån ut» oppslag is a thing on Utlån (0107), so the board shows the same loan: the next week free or taken,
 * my own request if I have one, and «Spør om lån» opening the very same popup as on Utlån.
 * The owner sees how many want to borrow it and goes to «Forespørsler».
 */
export function LendPanel({ post, meId, mine }: { post: NoticeboardPost; meId: string; mine: boolean }) {
  const item = useLendItem(post.lendItemId).data ?? null;
  const busyData = useLendBusyDays(post.lendItemId ?? '', !!post.lendItemId).data;
  const busy = useMemo(() => busyData ?? [], [busyData]);
  const requests = useLendRequests(!!post.lendItemId).data ?? [];
  const [today] = useState(() => new Date());
  const strip = useMemo(() => dayStrip(busy, today, DAYS), [busy, today]);
  const [open, setOpen] = useState<LendItem | null>(null);

  // before 0107 is on the server there is no thing behind the oppslag yet: show nothing rather than a dead button
  if (!post.lendItemId || !item) return null;

  const out = busyToday(busy, today);
  const mineOpen = requests.find((r) => r.itemId === item.id && r.borrowerId === meId && (r.status === 'PENDING' || r.status === 'ACCEPTED'));
  const waiting = mine ? requests.filter((r) => r.itemId === item.id && r.status === 'PENDING').length : 0;
  const closed = !!post.doneAt || !item.active;
  const free = strip.filter((d) => !d.busy).length;

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <View style={[styles.state, out ? styles.stateOut : styles.stateFree]}>
          <View style={[styles.dot, { backgroundColor: out ? colors.warn : colors.ok }]} />
          <Text style={[styles.stateText, { color: out ? colors.warn : colors.okText }]}>
            {out ? nb.lend.busyUntil(label(out.toDate)) : nb.lend.freeToday}
          </Text>
        </View>
        <Text style={styles.week}>{nb.lend.nextWeek}</Text>
      </View>

      <View style={styles.strip} accessible accessibilityLabel={nb.lend.weekA11y(free, DAYS)}>
        {strip.map((d) => {
          const date = dateOf(d.day);
          return (
            <View key={d.day} style={[styles.day, d.busy ? styles.dayBusy : styles.dayFree]}>
              <Text style={[styles.dayW, d.busy && styles.dayTextBusy]}>{WEEKDAY[date.getDay()]}</Text>
              <Text style={[styles.dayN, d.busy && styles.dayTextBusy]}>{date.getDate()}</Text>
            </View>
          );
        })}
      </View>

      {mine ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={waiting ? nb.lend.wantCount(waiting) : nb.lend.seeAsks}
          onPress={() => safePush('/utlan?fane=foresporsler')}
          style={({ pressed }) => [styles.ownerRow, pressed && styles.pressed]}
        >
          <View style={[styles.ownerIcon, waiting ? styles.ownerIconOn : null]}>
            <Icon name="inbox" size={16} color={waiting ? colors.ink : colors.ink2} />
          </View>
          <Text style={[styles.ownerText, styles.flex]} numberOfLines={1}>
            {waiting ? nb.lend.wantCount(waiting) : nb.lend.noAsksYet}
          </Text>
          <Text style={text.link}>{nb.lend.seeAsks}</Text>
        </Pressable>
      ) : mineOpen ? (
        <Pressable accessibilityRole="button" onPress={() => safePush('/utlan?fane=foresporsler')} style={({ pressed }) => [styles.ownerRow, pressed && styles.pressed]}>
          <Pill label={nb.lend.status[mineOpen.status]} tone={mineOpen.status === 'ACCEPTED' ? 'ok' : 'warn'} size="sm" />
          <Text style={[text.meta, styles.flex]} numberOfLines={1}>
            {nb.lend.period(label(mineOpen.fromDate), label(mineOpen.toDate))}
          </Text>
          <Icon name="right" size={16} color={colors.ink2} />
        </Pressable>
      ) : !closed ? (
        <Button
          label={nb.lend.ask}
          icon="cal"
          variant="lime"
          size="sm"
          onPress={() => {
            haptics.light();
            setOpen(item);
          }}
        />
      ) : null}

      <LendItemSheet item={open} onClose={() => setOpen(null)} onOpenItem={setOpen} onSeeRequests={() => safePush('/utlan?fane=foresporsler')} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.m, backgroundColor: colors.surface2, padding: 12, gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: radius.pill },
  stateFree: { backgroundColor: colors.okTint },
  stateOut: { backgroundColor: colors.warnTint },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stateText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  week: { ...text.small, color: colors.mute },
  strip: { flexDirection: 'row', gap: 5 },
  day: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 1 },
  dayFree: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  dayBusy: { backgroundColor: colors.warnTint },
  dayW: { fontFamily: fonts.bodySemi, fontSize: 10.5, color: colors.mute },
  dayN: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  dayTextBusy: { color: colors.warn },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 10, borderRadius: radius.m, backgroundColor: colors.white },
  ownerIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  ownerIconOn: { backgroundColor: colors.lime },
  ownerText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
});
