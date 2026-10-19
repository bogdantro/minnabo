import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import type { NabolagSummary } from '@/api/ApiClient';
import { useNabolagList, useNabolagMembership, useNoticeboard } from '@/api/queries';
import { MyNabolagCards, nabolagHref } from '@/components/community/MyNabolagCards';
import { MAX_NABOLAG } from '@/domain/nabolag';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { Button, EmptyState, ErrorState, FadeUp, Icon, ListingListSkeleton, Pill, PressableScale, Screen, SectionHeader, SubHeader } from '@/components/ui';

/**
 * Fellesskap → Nabolag: the nabolag MinNabo has set up in my kommune. Pick up to three;
 * members get a varsel about new oppslag there. Not in the design – it replaces
 * "the nabolag is whatever område you wrote at sign-up".
 */
export function NabolagList() {
  const router = useRouter();
  const me = useCurrentUser();
  const scope = useLocationScope();
  const kommune = me.municipality || scope.municipality || '';
  const { data, isLoading, isError, refetch } = useNabolagList(kommune);
  const membership = useNabolagMembership();
  const posts = useNoticeboard().data ?? [];
  const [now] = useState(() => Date.now());

  const list = data ?? [];
  const joined = list.filter((n) => n.isMember);
  const mine = joined.length;
  const full = mine >= MAX_NABOLAG;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/fellesskap'));

  const toggle = (n: NabolagSummary) => {
    const join = !n.isMember;
    if (join && full) {
      haptics.warning();
      toast.error(nb.neighbourhood.full(MAX_NABOLAG));
      return;
    }
    haptics.light();
    membership.mutate(
      { id: n.id, join },
      {
        onSuccess: () =>
          toast.success(join ? nb.neighbourhood.joinedToast(n.name) : nb.neighbourhood.leftToast(n.name), { icon: join ? 'users' : 'logout' }),
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );
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

  return (
    <Screen scroll spacer="none" header={<SubHeader title={nb.neighbourhood.title} onBack={back} />}>
      <FadeUp style={[styles.px, styles.head]}>
        <Text style={text.eyebrow}>{nb.neighbourhood.listEyebrow(kommune)}</Text>
        <Text style={text.h1} accessibilityRole="header">
          {nb.neighbourhood.listHeading}
        </Text>
        <Text style={[text.body, styles.ink2]}>{nb.neighbourhood.listLead(MAX_NABOLAG)}</Text>
        {list.length ? <Pill label={nb.neighbourhood.counter(mine, MAX_NABOLAG)} tone={mine ? 'ok' : 'neutral'} icon={mine ? 'check' : 'home'} /> : null}
      </FadeUp>

      {joined.length ? (
        <>
          <SectionHeader title={nb.neighbourhood.mineTitle} icon="home" iconBg={colors.limeTint} iconColor={colors.limeDeep} style={styles.mt22} />
          <View style={styles.px}>
            <MyNabolagCards nabolag={joined} posts={posts} now={now} />
          </View>
          <SectionHeader title={nb.neighbourhood.allIn(kommune)} subtitle={nb.neighbourhood.allInSub} icon="map" style={styles.mt28} />
        </>
      ) : null}

      <View style={[styles.px, joined.length ? styles.listTight : styles.list]}>
        {isLoading ? (
          <ListingListSkeleton />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : list.length ? (
          list.map((n) => (
            <PressableScale
              key={n.id}
              accessibilityRole="link"
              accessibilityLabel={nb.neighbourhood.rowAria(n.place, n.memberCount, n.isMember)}
              onPress={() => safePush(nabolagHref(n))}
              scaleTo={0.985}
              style={[styles.row, shadow.card]}
            >
              <View style={[styles.icon, n.isMember && styles.iconOn]}>
                <Icon name="home" size={20} color={n.isMember ? colors.limeDeep : colors.ink2} />
              </View>
              <View style={styles.body}>
                <Text style={styles.name}>{n.place}</Text>
                <Text style={text.meta}>{nb.neighbourhood.rowMembers(n.memberCount)}</Text>
              </View>
              {n.isMember ? (
                <Button
                  label={nb.neighbourhood.leave}
                  variant="ghost"
                  size="sm"
                  block={false}
                  accessibilityLabel={nb.neighbourhood.leaveAria(n.place)}
                  onPress={() => toggle(n)}
                />
              ) : (
                <Button
                  label={nb.neighbourhood.join}
                  variant="lime"
                  size="sm"
                  block={false}
                  accessibilityLabel={nb.neighbourhood.joinAria(n.place)}
                  onPress={() => toggle(n)}
                />
              )}
            </PressableScale>
          ))
        ) : (
          <EmptyState icon="home" title={nb.neighbourhood.title} body={nb.neighbourhood.none(kommune)} />
        )}
      </View>
      <View style={styles.bottom} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  ink2: { color: colors.ink2 },
  head: { marginTop: 8, gap: 8, alignItems: 'flex-start' },
  list: { marginTop: 18, gap: 10 },
  listTight: { gap: 10 },
  mt22: { marginTop: 22 },
  mt28: { marginTop: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.white },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.neutralPill, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: colors.limeTint },
  body: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  bottom: { height: 60 },
});
