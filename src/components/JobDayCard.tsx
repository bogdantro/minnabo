import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useAgreementByProposal, useMyAgreements, useProfile } from '@/api/queries';
import { attendanceOf } from '@/domain/noShow';
import type { AgendaItem } from '@/domain/types';
import { formatTime } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { colors, screenPadding, text } from '@/theme/theme';
import { Icon } from './ui';

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Today's next avtale that isn't done or called off (earliest first), or null. */
export function todaysJob(items: AgendaItem[] | undefined, now: Date): AgendaItem | null {
  const today = (items ?? [])
    .filter((a) => !a.cancelled && !a.fullyCompleted && a.scheduledAt && sameDay(new Date(a.scheduledAt), now))
    .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
  return today[0] ?? null;
}

/**
 * On the job day, pinned under the top bar on Oppdrag: «I dag kl. 14:00 · Klippe plen» and how it
 * stands (Ola kommer / er på vei / er framme). One tap opens the avtale.
 */
export function JobDayCard() {
  const [now] = useState(() => new Date());
  const { data } = useMyAgreements();
  const job = todaysJob(data, now);
  if (!job) return null;
  return <JobDayCardFor job={job} />;
}

function JobDayCardFor({ job }: { job: AgendaItem }) {
  const { data: other } = useProfile(job.counterpartId);
  const { data: agreement } = useAgreementByProposal(job.proposalId);
  const first = (other?.displayName ?? '').split(' ')[0];
  const state = attendanceOf(agreement);
  const status =
    job.role === 'HELPER'
      ? nb.jobDay.youHelp(first)
      : state === 'arrived'
        ? agreement?.helperStatusPlace
          ? nb.jobDay.arrivedAt(first, agreement.helperStatusPlace)
          : nb.jobDay.arrived(first)
        : state === 'onTheWay'
          ? nb.jobDay.onTheWay(first)
          : state === 'confirmed'
            ? nb.jobDay.coming(first)
            : nb.jobDay.notConfirmed(first);
  const time = job.scheduledAt ? formatTime(job.scheduledAt) : '';
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${nb.jobDay.today(time)}, ${job.listingTitle}. ${status}`}
        onPress={() => safePush(`/avtale/${job.proposalId}`)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        testID="job-day-card"
      >
        <View style={styles.ic}>
          <Icon name="cal" size={18} color={colors.ink} />
        </View>
        <View style={styles.body}>
          <Text style={styles.top} numberOfLines={1}>
            {`${nb.jobDay.today(time)} · ${job.listingTitle}`}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {status}
          </Text>
        </View>
        <Icon name="arrow" size={18} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: screenPadding, paddingBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.ink },
  pressed: { opacity: 0.9 },
  ic: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 2 },
  top: { ...text.label, fontSize: 14.5, color: colors.white },
  sub: { ...text.meta, color: colors.onInk78 },
});
