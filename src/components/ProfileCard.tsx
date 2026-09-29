import { View, Pressable, StyleSheet } from 'react-native';
import type { PublicProfile } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';
import { Rating } from './ui/Rating';
import { VerificationBadge } from './VerificationBadge';

export type ProfileCardProps = {
  profile: PublicProfile;
  onPress: () => void;
  /** "Om Andreas" style heading (service offer) vs plain owner card (task) */
  variant?: 'owner' | 'about';
  linkLabel?: string;
};

export function ProfileCard({ profile, onPress, variant = 'owner', linkLabel }: ProfileCardProps) {
  const link = linkLabel ?? (variant === 'about' ? nb.listingDetail.seeFullProfile : nb.listingDetail.seeProfile);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${profile.displayName} – ${link}`}
      onPress={onPress}
      style={styles.card}
    >
      <Avatar uri={profile.avatarUrl} initials={profile.initials} size={56} />
      <View style={styles.body}>
        <AppText variant="cardTitle" weight="bold">
          {variant === 'about' ? `Om ${profile.displayName}` : profile.displayName}
        </AppText>

        {variant === 'about' ? (
          <View style={styles.metaRow}>
            <Icon name="calendar" size={14} color="cyan" />
            <AppText variant="meta" color="navyMuted">
              {nb.listingDetail.memberSince} {profile.memberSince}
            </AppText>
          </View>
        ) : profile.rating ? (
          <Rating value={profile.rating} />
        ) : null}

        <View style={styles.metaRow}>
          <Icon name="map-pin" size={14} color="cyan" />
          <AppText variant="meta" color="navyMuted">
            {profile.location.place}
          </AppText>
        </View>

        {variant === 'about' && profile.rating ? <Rating value={profile.rating} /> : null}

        {variant === 'owner'
          ? profile.verifications
              .filter((v) => v.verified)
              .map((v) => <VerificationBadge key={v.kind} verification={v} interactive={false} />)
          : null}
      </View>

      <View style={styles.link}>
        <AppText variant="meta" weight="bold" color="cyan">
          {link}
        </AppText>
        <Icon name="chevron-right" size={16} color="cyan" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.lg,
    ...tokens.shadow.card,
  },
  body: { flex: 1, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { alignItems: 'center', flexDirection: 'row', gap: 2, alignSelf: 'flex-start' },
});
