import { View, Pressable, StyleSheet } from 'react-native';
import type { Proposal } from '@/domain/types';
import { formatPrice } from '@/domain/price';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { profileRepository } from '@/data/profileRepository';
import { AppText } from './ui/Text';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';
import { StatusPill } from './ui/StatusPill';

const statusPill = (p: Proposal) => {
  switch (p.status) {
    case 'ACCEPTED':
      return { label: nb.tilbud.accepted, tone: 'lime' as const };
    case 'DECLINED':
      return { label: nb.tilbud.declined, tone: 'neutral' as const };
    case 'REVISION_PENDING':
      return { label: nb.tilbud.revisionPending, tone: 'cyan' as const };
    default:
      return null;
  }
};

export function ProposalCard({
  proposal,
  onPress,
  cheapest,
}: {
  proposal: Proposal;
  onPress: () => void;
  cheapest?: boolean;
}) {
  const from = profileRepository.getProfile(proposal.fromProfileId);
  const pill = statusPill(proposal);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${from?.displayName ?? 'Tilbud'}, ${formatPrice(proposal.price)}`}
      onPress={onPress}
      style={[styles.card, cheapest && styles.cheapest]}
    >
      <View style={styles.top}>
        <Avatar uri={from?.avatarUrl} initials={from?.initials ?? '?'} size={44} />
        <View style={styles.who}>
          <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
            {from?.displayName ?? 'Tilbyder'}
          </AppText>
          {from?.rating ? (
            <View style={styles.ratingRow}>
              <Icon name="star" size={12} color="star" />
              <AppText variant="meta" color="navyMuted">
                {from.rating.average.toLocaleString('nb-NO', { minimumFractionDigits: 1 })} ({from.rating.count})
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.priceCol}>
          <AppText variant="section" weight="extrabold" color="lime">
            {formatPrice(proposal.price)}
          </AppText>
          {cheapest ? <StatusPill label={nb.tilbud.lowest} tone="lime" soft /> : null}
        </View>
      </View>

      {proposal.scheduledText ? (
        <View style={styles.metaRow}>
          <Icon name="calendar" size={13} color="cyan" />
          <AppText variant="meta" color="navyMuted">
            {proposal.scheduledText}
          </AppText>
        </View>
      ) : null}

      {proposal.message ? (
        <AppText variant="meta" color="navyMuted" numberOfLines={2}>
          {proposal.message}
        </AppText>
      ) : null}

      {pill ? <StatusPill label={pill.label} tone={pill.tone} /> : null}
    </Pressable>
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
  },
  cheapest: { borderColor: tokens.color.lime, borderWidth: 1.5 },
  top: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  who: { flex: 1, gap: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  priceCol: { alignItems: 'flex-end', gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
