import { useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { Organisation } from '@/domain/community';
import { useOrganisations, useSupportVotes, useVoteSupport } from '@/api/communityQueries';
import { useNoticeboard } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { safePush } from '@/lib/nav';
import { formatPrice, nok } from '@/domain/price';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Image } from '@/components/ui/Image';
import { Button, GrowBar, Icon, Note, Pill } from '@/components/ui';
import { TipBusinessSheet } from '@/components/community/FellesTop';
import { FellesPage, TONES } from '@/components/community/FellesPage';

/** «Lag og foreninger»: the kommune's lag, each with its next arrangement, and the vote for the next support. */
export function OrganisationsScreen() {
  const me = useCurrentUser();
  const { municipality } = useLocationScope();
  const kommune = me.municipality || municipality || '';
  // ?vis=<id> (from «Søk i Fellesskap»): that lag comes first, marked
  const { vis } = useLocalSearchParams<{ vis?: string }>();
  const all = useOrganisations(kommune).data ?? [];
  const focus = typeof vis === 'string' ? all.find((o) => o.id === vis) : undefined;
  const orgs = focus ? [focus, ...all.filter((o) => o.id !== focus.id)] : all;
  const state = useSupportVotes(kommune).data;
  const vote = useVoteSupport(kommune);
  const postsData = useNoticeboard().data;
  const [tip, setTip] = useState(false);
  const [now] = useState(() => Date.now());
  // each lag's next arrangement on Oppslagstavla
  const nextEvent = useMemo(() => {
    const out: Record<string, { id: string; title: string; at: string }> = {};
    for (const p of postsData ?? []) {
      if (!p.organisationId || !p.eventAt || Date.parse(p.eventAt) < now || p.doneAt) continue;
      const cur = out[p.organisationId];
      if (!cur || Date.parse(p.eventAt) < Date.parse(cur.at)) out[p.organisationId] = { id: p.id, title: p.title, at: p.eventAt };
    }
    return out;
  }, [postsData, now]);
  const goal = state?.goal;

  return (
    <FellesPage title={nb.felles.orgs.title} lead={nb.felles.orgs.lead(kommune)} icon="award" tone={TONES.lime} testID="organisations">
      {goal ? (
        <View style={[styles.card, shadow.card]}>
          <Text style={styles.name}>{nb.felles.support.progressTitle}</Text>
          <GrowBar fill={Math.min(1, goal.collectedKr / goal.goalKr)} color={colors.limeDeep} height={10} />
          <Text style={text.meta}>{nb.felles.support.progress(formatPrice(nok(goal.collectedKr)), formatPrice(nok(goal.goalKr)))}</Text>
          <Text style={text.hint}>{nb.felles.support.progressNote}</Text>
        </View>
      ) : null}
      {orgs.length && state?.round ? <Text style={text.meta}>{nb.felles.support.sub(state.round)}</Text> : null}
      {orgs.length === 0 ? <Note icon="award">{nb.felles.orgs.empty(kommune)}</Note> : null}
      {orgs.map((o) => (
        <OrgCard
          key={o.id}
          org={o}
          marked={o.id === focus?.id}
          votes={state?.counts[o.id] ?? 0}
          mine={state?.mine === o.id}
          next={nextEvent[o.id]}
          onVote={() =>
            vote.mutate(o.id, {
              onSuccess: () => toast.success(nb.felles.support.votedToast),
              onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
            })
          }
        />
      ))}
      <Button label={nb.felles.orgs.tipCta} variant="ghost" icon="plus" onPress={() => setTip(true)} />
      <TipBusinessSheet visible={tip} onClose={() => setTip(false)} kommune={kommune} />
    </FellesPage>
  );
}

function OrgCard({
  org,
  votes,
  mine,
  next,
  marked,
  onVote,
}: {
  org: Organisation;
  votes: number;
  mine: boolean;
  next?: { id: string; title: string; at: string };
  marked?: boolean;
  onVote: () => void;
}) {
  return (
    <View style={[styles.card, shadow.card, marked && styles.marked]} testID={`org-${org.id}`}>
      <View style={styles.head}>
        {org.logoUrl ? (
          <Image source={{ uri: org.logoUrl }} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.logo, styles.mono]}>
            <Text style={styles.monoText}>{org.name.slice(0, 1)}</Text>
          </View>
        )}
        <View style={styles.flex}>
          <Text style={styles.name}>{org.name}</Text>
          <View style={styles.pills}>
            <Pill label={nb.felles.orgs.kinds[org.kind]} size="sm" />
            {org.verified ? <Pill label={nb.felles.orgs.verified} tone="ok" icon="check" size="sm" /> : null}
          </View>
        </View>
      </View>
      {org.about ? <Text style={[text.body, styles.ink2]}>{org.about}</Text> : null}
      <View style={styles.next}>
        <Icon name="cal" size={15} color={colors.limeDeep} />
        <Text style={[text.meta, styles.flex]} numberOfLines={1}>
          {next ? `${nb.felles.orgs.nextEvent}: ${next.title} · ${new Date(next.at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}` : nb.felles.orgs.noEvent}
        </Text>
        {next ? <Icon name="right" size={14} color={colors.faint} /> : null}
      </View>
      <View style={styles.actions}>
        <Button label={mine ? nb.felles.support.voted : nb.felles.support.vote} variant={mine ? 'ink' : 'lime'} size="sm" block={false} icon={mine ? 'check' : 'heart'} onPress={onVote} />
        <Text style={[text.hint, styles.flex]}>{nb.felles.support.votes(votes)}</Text>
        {next ? <Button label={nb.felles.orgs.nextEvent} variant="ghost" size="sm" block={false} onPress={() => safePush(`/oppslagstavle?oppslag=${next.id}`)} /> : null}
        {org.url ? <Button label={nb.felles.orgs.website} variant="ghost" size="sm" block={false} icon="arrowur" onPress={() => void Linking.openURL(org.url!)} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ink2: { color: colors.ink2 },
  card: { padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, gap: 10 },
  marked: { borderWidth: 2, borderColor: colors.lime },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.surface2 },
  mono: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.limeTint },
  monoText: { fontFamily: fonts.display, fontSize: 22, color: colors.limeDeep },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  pills: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  next: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.tile, backgroundColor: colors.surface2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
