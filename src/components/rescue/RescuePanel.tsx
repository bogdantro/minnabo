import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import nb from '@/i18n/nb';
import { useMakeRescueUrgent, useProfile, useProposalsForListing, useRespondToProposal } from '@/api/queries';
import { formatPrice } from '@/domain/price';
import { isUrgent } from '@/domain/urgent';
import type { Listing, Proposal } from '@/domain/types';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Avatar, Button, Dialog, FadeUp, Icon, Pill, ScaleIn, Spinner, Stars } from '@/components/ui';

const open = (p: Proposal) => p.status === 'SENT' || p.status === 'REVISION_PENDING';

/**
 * «Velg en annen nabo» – on a cancelled avtale, for the owner: the other open tilbud,
 * the ones who said «Kan i dag» first, each with one-tap «Godta». Plus the haste state.
 */
export function RescuePanel({ cancelledId, listing }: { cancelledId: string; listing: Listing }) {
  const offers = useProposalsForListing(listing.id);
  const urgentNow = isUrgent(listing);
  const makeUrgent = useMakeRescueUrgent(cancelledId);
  const others = (offers.data ?? [])
    .filter((p) => p.id !== cancelledId && open(p))
    .sort((a, b) => Number(!!b.availableTodayAt) - Number(!!a.availableTodayAt) || a.price.amountMinor - b.price.amountMinor);

  const urgentNowPress = () =>
    makeUrgent.mutate(undefined, {
      onSuccess: () => {
        haptics.success();
        toast.success(nb.rescue.madeUrgent, { icon: 'zap', bottom: 150 });
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }),
    });

  return (
    <FadeUp style={styles.wrap}>
      <View testID="rescue-panel" style={styles.wrap}>
      <View style={[styles.hero, shadow.hero]}>
        <View style={styles.glow} />
        <Text style={[text.eyebrow, styles.eyebrow]}>{nb.rescue.panelEyebrow}</Text>
        <Text style={[text.h2, styles.heroTitle]} accessibilityRole="header">
          {nb.rescue.panelTitle}
        </Text>
        <Text style={styles.heroSub}>{nb.rescue.panelSub(others.length)}</Text>
        {urgentNow ? (
          <Pill label={nb.rescue.isUrgent} icon="zap" tone="warn" style={styles.heroPill} />
        ) : (
          <Button
            label={nb.rescue.makeUrgent}
            icon="zap"
            variant="lime"
            size="sm"
            block={false}
            loading={makeUrgent.isPending}
            onPress={urgentNowPress}
            style={styles.heroBtn}
          />
        )}
      </View>

      {offers.isLoading ? (
        <View style={styles.loading}>
          <Spinner />
        </View>
      ) : others.length ? (
        <View style={styles.list}>
          {others.map((p, i) => (
            <FadeUp key={p.id} delay={80 + i * 60}>
              <OfferRow proposal={p} />
            </FadeUp>
          ))}
        </View>
      ) : (
        <ScaleIn style={[styles.empty, shadow.card]}>
          <View style={styles.emptyIc}>
            <Icon name="hourglass" size={24} color={colors.limeDeep} />
          </View>
          <Text style={[text.h4, styles.center]}>{nb.rescue.emptyTitle}</Text>
          <Text style={[text.meta, styles.center]}>{urgentNow ? nb.rescue.emptyUrgentBody : nb.rescue.emptyBody}</Text>
          <Button label={nb.rescue.seeOppdrag} variant="ghost" size="sm" block={false} iconRight="arrow" onPress={() => safePush(`/oppdrag/${listing.id}`)} />
        </ScaleIn>
      )}
      </View>
    </FadeUp>
  );
}

function OfferRow({ proposal }: { proposal: Proposal }) {
  const { data: who } = useProfile(proposal.fromProfileId);
  const respond = useRespondToProposal(proposal.conversationId);
  const [ask, setAsk] = useState(false);
  const first = (who?.displayName ?? '').split(' ')[0];
  const today = !!proposal.availableTodayAt;
  const price = formatPrice(proposal.price);

  const accept = async () => {
    try {
      await respond.mutateAsync({ proposalId: proposal.id, event: 'ACCEPT', actor: 'RECIPIENT' });
      haptics.success();
      setAsk(false);
      toast.success(nb.rescue.accepted(first), { icon: 'check', bottom: 150 });
      router.replace(`/avtale/${proposal.id}`);
    } catch (e) {
      toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 });
    }
  };

  return (
    <View style={[styles.row, today && styles.rowToday, shadow.card]} testID={`rescue-offer-${proposal.id}`}>
      <View style={styles.rowTop}>
        <Avatar initials={who?.initials ?? '·'} uri={who?.avatarUrl} seed={proposal.fromProfileId} size={46} ring={false} />
        <View style={styles.flex}>
          <Text style={[text.label, styles.name]} numberOfLines={1}>
            {who?.displayName ?? ''}
          </Text>
          {who?.rating?.count ? <Stars rating={who.rating.average} count={who.rating.count} /> : null}
        </View>
        <View style={styles.priceCol}>
          <Text style={[text.num, styles.price]}>{price}</Text>
          {today ? (
            <Pill label={nb.rescue.canToday} icon="check" tone="ok" size="sm" />
          ) : proposal.rescueFrom ? (
            <Pill label={nb.rescue.waiting} icon="hourglass" tone="neutral" size="sm" />
          ) : null}
        </View>
      </View>
      {proposal.scheduledText ? (
        <View style={styles.when}>
          <Icon name="cal" size={14} color={colors.mute} />
          <Text style={text.meta} numberOfLines={1}>
            {proposal.scheduledText}
          </Text>
        </View>
      ) : null}
      <View style={styles.btns}>
        <Button label={nb.rescue.seeOffer} variant="ghost" size="sm" block={false} onPress={() => safePush(`/tilbud/${proposal.id}`)} style={styles.grow1} />
        <Button
          label={nb.rescue.accept}
          icon="check"
          variant={today ? 'lime' : 'ink'}
          size="sm"
          block={false}
          accessibilityLabel={`${nb.rescue.accept} ${first}, ${price}`}
          onPress={() => setAsk(true)}
          style={styles.grow15}
        />
      </View>
      <Dialog
        visible={ask}
        onClose={() => !respond.isPending && setAsk(false)}
        icon="check"
        tone="ok"
        title={nb.rescue.acceptTitle(first)}
        body={`${nb.rescue.acceptBody(price)} ${nb.giTilbud.payNote}`}
        confirmLabel={nb.rescue.accept}
        confirmVariant="lime"
        loading={respond.isPending}
        onConfirm={accept}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flex: { flex: 1, minWidth: 0, gap: 3 },
  center: { textAlign: 'center' },
  hero: { borderRadius: 26, backgroundColor: colors.ink, padding: 20, gap: 6, overflow: 'hidden' },
  glow: { position: 'absolute', right: -50, top: -70, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.lime, opacity: 0.22 },
  eyebrow: { color: colors.onInk62 },
  heroTitle: { color: colors.white },
  heroSub: { ...text.body, fontSize: 14, lineHeight: 20, color: colors.onInk78 },
  heroPill: { marginTop: 8 },
  heroBtn: { marginTop: 10, alignSelf: 'flex-start' },
  loading: { height: 120, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 10 },
  row: { borderRadius: radius.card, backgroundColor: colors.white, padding: 14, gap: 10, borderWidth: 1.5, borderColor: colors.white },
  rowToday: { borderColor: colors.ok },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 15.5 },
  priceCol: { alignItems: 'flex-end', gap: 4 },
  price: { fontSize: 18 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btns: { flexDirection: 'row', gap: 8 },
  grow1: { flex: 1 },
  grow15: { flex: 1.5 },
  empty: { borderRadius: radius.card, backgroundColor: colors.white, padding: 20, alignItems: 'center', gap: 8 },
  emptyIc: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
