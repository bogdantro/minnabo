import { View, Image, StyleSheet } from 'react-native';
import type { Proposal } from '@/domain/types';
import { formatPrice } from '@/domain/price';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';

export type OfferCardProps = {
  proposal: Proposal;
  listingTitle: string;
  listingImageUrl?: string;
  /** true when the current user is allowed to accept/decline */
  canRespond: boolean;
  onAccept: () => void;
  onDecline: () => void;
  pending?: boolean;
};

export function OfferCard({
  proposal,
  listingTitle,
  listingImageUrl,
  canRespond,
  onAccept,
  onDecline,
  pending = false,
}: OfferCardProps) {
  const showButtons = canRespond && proposal.status === 'SENT';

  const statusText =
    proposal.status === 'ACCEPTED'
      ? nb.chat.offerAccepted
      : proposal.status === 'DECLINED'
        ? nb.chat.offerDeclined
        : proposal.status === 'WITHDRAWN'
          ? nb.chat.offerWithdrawn
          : null;

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <View style={styles.label}>
          <AppText variant="meta" weight="extrabold" color="lime" style={styles.labelText}>
            {nb.chat.offerLabel}
          </AppText>
        </View>
      </View>

      <View style={styles.headRow}>
        {listingImageUrl ? (
          <Image source={{ uri: listingImageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Icon name="image" size={18} color="navyMuted" />
          </View>
        )}
        <View style={styles.headBody}>
          <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
            {listingTitle}
          </AppText>
          <AppText variant="section" weight="extrabold" color="lime">
            {formatPrice(proposal.price)}
          </AppText>
          {proposal.scheduledText ? (
            <View style={styles.dateRow}>
              <Icon name="calendar" size={14} color="navyMuted" />
              <AppText variant="meta" color="navyMuted">
                {proposal.scheduledText}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      {proposal.message ? (
        <AppText variant="meta" color="navyMuted">
          {proposal.message}
        </AppText>
      ) : null}

      {proposal.caveats ? (
        <AppText variant="meta" color="navyMuted">
          {proposal.caveats}
        </AppText>
      ) : null}

      {showButtons ? (
        <View style={styles.actions}>
          <Button label={nb.chat.acceptOffer} onPress={onAccept} loading={pending} style={styles.accept} />
          <Button label={nb.chat.declineOffer} variant="secondary" onPress={onDecline} style={styles.decline} />
        </View>
      ) : statusText ? (
        <View style={styles.statusRow}>
          <Icon
            name={proposal.status === 'ACCEPTED' ? 'check-circle' : 'x-circle'}
            size={16}
            color={proposal.status === 'ACCEPTED' ? 'lime' : 'navyMuted'}
          />
          <AppText variant="meta" weight="bold">
            {statusText}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    gap: tokens.space.sm,
    ...tokens.shadow.card,
    maxWidth: '86%',
  },
  labelRow: { flexDirection: 'row' },
  label: {
    borderWidth: 1,
    borderColor: tokens.color.lime,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  labelText: { fontSize: 11, letterSpacing: 0.5 },
  headRow: { flexDirection: 'row', gap: tokens.space.md },
  thumb: { width: 64, height: 64, borderRadius: tokens.radius.md, backgroundColor: tokens.color.line },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  headBody: { flex: 1, gap: 2, justifyContent: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', gap: tokens.space.sm, marginTop: 2 },
  accept: { flex: 1 },
  decline: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
