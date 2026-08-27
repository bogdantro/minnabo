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
  const accepted = proposal.status === 'ACCEPTED';

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <View style={styles.label}>
          <AppText weight="extrabold" color="lime" style={styles.labelText}>
            {nb.chat.offerLabel}
          </AppText>
        </View>
      </View>

      <View style={styles.headRow}>
        {listingImageUrl ? (
          <Image source={{ uri: listingImageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Icon name="image" size={20} color="navyMuted" />
          </View>
        )}
        <View style={styles.headBody}>
          <AppText variant="cardTitle" weight="bold" numberOfLines={2}>
            {listingTitle}
          </AppText>
          <AppText variant="section" weight="extrabold" color="lime">
            {formatPrice(proposal.price)}
          </AppText>
          {proposal.scheduledText ? (
            <View style={styles.dateRow}>
              <Icon name="calendar" size={14} color="navyMuted" />
              <AppText variant="meta" color="navyMuted" numberOfLines={1}>
                {proposal.scheduledText}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      {proposal.message ? (
        <AppText variant="body" color="navyMuted">
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
          <Button
            label={nb.chat.acceptOffer}
            onPress={onAccept}
            loading={pending}
            style={styles.actionBtn}
          />
          <Button
            label={nb.chat.declineOffer}
            variant="secondary"
            onPress={onDecline}
            style={styles.actionBtn}
          />
        </View>
      ) : statusText ? (
        <View style={[styles.statusBar, accepted ? styles.statusAccepted : styles.statusNeutral]}>
          <Icon
            name={accepted ? 'check-circle' : 'x-circle'}
            size={16}
            color={accepted ? 'lime' : 'navyMuted'}
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
    width: '100%',
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.lg,
    gap: tokens.space.md,
    ...tokens.shadow.card,
  },
  labelRow: { flexDirection: 'row' },
  label: {
    borderWidth: 1,
    borderColor: tokens.color.lime,
    backgroundColor: tokens.color.limeTint,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 3,
  },
  labelText: { fontSize: 11, lineHeight: 14, letterSpacing: 1 },
  headRow: { flexDirection: 'row', gap: tokens.space.md, alignItems: 'center' },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.line,
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  headBody: { flex: 1, gap: 4, justifyContent: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actions: { flexDirection: 'row', gap: tokens.space.md },
  actionBtn: { flex: 1, height: 50 },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: tokens.radius.tile,
    paddingVertical: tokens.space.sm,
  },
  statusAccepted: { backgroundColor: tokens.color.limeTint },
  statusNeutral: { backgroundColor: tokens.color.bg },
});
