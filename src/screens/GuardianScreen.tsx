import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { GuardianYouth } from '@/domain/types';
import nb from '@/i18n/nb';
import { useGuardianOverview } from '@/api/queries';
import { formatTime, shortDate } from '@/lib/datetime';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { Avatar, EmptyState, ErrorState, FadeUp, Icon, Note, Pill, RowSkeleton, Screen, SubHeader, usePullRefresh, pullRefreshControl } from '@/components/ui';

type TripState = 'none' | 'active' | 'late' | 'done';

/** What a foresatt sees of a «Trygg tur» (pure, for tests). */
export function tripState(trip: GuardianYouth['trip'], now: number): TripState {
  if (!trip) return 'none';
  if (trip.checkedInAt) return 'done';
  if (trip.alertedAt || Date.parse(trip.dueAt) < now) return 'late';
  return 'active';
}

/**
 * Foresatt i appen (0101): the youths I follow, the jobs they have agreed and whether a «Trygg tur»
 * is on. Read only; the area of a job, never an address (rule 6).
 */
export function GuardianScreen() {
  const router = useRouter();
  const pull = usePullRefresh();
  const { data, isLoading, isError, refetch } = useGuardianOverview();
  const [now] = useState(() => Date.now());
  const t = nb.guardianView;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen scroll scrollProps={{ refreshControl: pullRefreshControl(pull) }} header={<SubHeader title={t.title} onBack={back} />}>
      <View style={styles.body}>
        <Text style={[text.body, styles.ink2]}>{t.intro}</Text>
        {isLoading ? (
          <RowSkeleton />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : !data?.length ? (
          <EmptyState icon="users" title={t.empty} />
        ) : (
          data.map((y, i) => <YouthCard key={y.id} youth={y} now={now} delay={i * 60} />)
        )}
        <Note icon="shield">{t.privacy}</Note>
      </View>
    </Screen>
  );
}

function YouthCard({ youth: y, now, delay }: { youth: GuardianYouth; now: number; delay: number }) {
  const t = nb.guardianView;
  const trip = tripState(y.trip, now);
  const tripTone = trip === 'late' ? styles.tripLate : trip === 'active' ? styles.tripActive : trip === 'done' ? styles.tripDone : styles.tripNone;
  const tripText =
    trip === 'late'
      ? t.tripLate
      : trip === 'active'
        ? `${t.tripActive} · ${t.tripDue(formatTime(y.trip!.dueAt))}`
        : trip === 'done'
          ? t.tripDone(formatTime(y.trip!.checkedInAt!))
          : t.tripNone;
  return (
    <FadeUp delay={delay} style={[styles.card, shadow.card]}>
      <View style={styles.head}>
        <Avatar initials={y.name.slice(0, 1)} seed={y.id} size={48} />
        <View style={styles.flex}>
          <Text style={styles.name}>{y.name}</Text>
          {y.age ? <Text style={text.meta}>{t.age(y.age)}</Text> : null}
        </View>
      </View>
      <View style={[styles.trip, tripTone]} accessibilityLiveRegion={trip === 'late' ? 'assertive' : 'none'}>
        <Icon name={trip === 'late' ? 'alert' : trip === 'done' ? 'check' : 'shield'} size={16} color={trip === 'late' ? colors.danger : trip === 'none' ? colors.ink2 : colors.ink} />
        <Text style={[styles.tripText, trip === 'late' && styles.danger]}>{tripText}</Text>
      </View>
      <Text style={styles.h}>{t.coming}</Text>
      {y.agreements.length ? (
        y.agreements.map((a, i) => (
          <View key={`${a.title}-${i}`} style={styles.job}>
            <View style={styles.dateTile}>
              {a.scheduledAt ? (
                <>
                  <Text style={styles.dateDay}>{new Date(a.scheduledAt).getDate()}</Text>
                  <Text style={styles.dateMon}>{shortDate(a.scheduledAt).split(' ')[2] ?? ''}</Text>
                </>
              ) : (
                <Icon name="cal" size={18} color={colors.limeDeep} />
              )}
            </View>
            <View style={styles.flex}>
              <Text style={text.label} numberOfLines={2}>
                {a.title}
              </Text>
              <Text style={text.meta} numberOfLines={2}>
                {[a.scheduledAt ? `${shortDate(a.scheduledAt)} kl. ${formatTime(a.scheduledAt)}` : a.scheduledText, a.place, t.with(a.with)].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Pill label={t.noJobs} tone="neutral" size="sm" />
      )}
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: screenPadding, paddingTop: 8, paddingBottom: 60, gap: 14 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  ink2: { color: colors.ink2 },
  danger: { color: colors.danger },
  card: { gap: 12, padding: 16, borderRadius: radius.card, backgroundColor: colors.white },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  trip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.m },
  tripNone: { backgroundColor: colors.bg },
  tripActive: { backgroundColor: colors.limeTint },
  tripDone: { backgroundColor: colors.okTint },
  tripLate: { backgroundColor: colors.dangerTint },
  tripText: { ...text.label, fontSize: 14, flex: 1 },
  h: { ...text.eyebrow, marginTop: 4 },
  job: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateTile: { width: 46, height: 50, borderRadius: 14, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontFamily: fonts.display, fontSize: 19, lineHeight: 22, color: colors.ink },
  dateMon: { fontFamily: fonts.bodySemi, fontSize: 10.5, lineHeight: 12, color: colors.limeDeep, textTransform: 'uppercase' },
});
