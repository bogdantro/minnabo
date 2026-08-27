import { ScrollView, View, StyleSheet } from 'react-native';
import type { Listing } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsSaved } from '@/data/savedStore';
import { safePush } from '@/lib/nav';
import { DetailTopBar } from '@/components/TopBar';
import { Gallery } from '@/components/Gallery';
import { AppText } from '@/components/ui/Text';
import { StatusPill } from '@/components/ui/StatusPill';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { InfoCard, InfoRow } from '@/components/ui/InfoCard';
import { Rating } from '@/components/ui/Rating';
import { PriceHeadline } from '@/components/PriceHeadline';
import { ProfileCard } from '@/components/ProfileCard';
import { StickyActions } from '@/components/StickyActions';
import { VerificationBadge } from '@/components/VerificationBadge';

export function ServiceOfferDetailScreen({
  listing,
  onBack,
}: {
  listing: Listing;
  onBack: () => void;
}) {
  const me = useCurrentUser();
  const [saved, toggleSaved] = useIsSaved(listing.id);
  const offer = listing.offer;
  const phoneVerification = listing.owner.verifications.find((v) => v.verified);

  const area =
    typeof offer?.maxDistanceKm === 'number'
      ? `${listing.location.place} · ${nb.common.upTo} ${offer.maxDistanceKm} ${nb.common.km}`
      : listing.location.place;

  const experienceLine = [
    offer?.experienceYears ? `${offer.experienceYears} ${nb.listingDetail.yearsExperience}` : null,
    offer?.completedJobs ? `${offer.completedJobs} ${nb.listingDetail.completedJobs}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.wrap}>
      <DetailTopBar
        title={nb.listingDetail.offerTitle}
        onBack={onBack}
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        unreadNotifications
        onProfilePress={() => safePush('/profil')}
        onNotificationsPress={() => safePush('/varsler')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Gallery
          images={listing.images}
          saved={saved}
          onToggleSave={toggleSaved}
          height={260}
          badge={nb.badge.offersHelp}
        />

        <AppText variant="h1" weight="extrabold" style={styles.title}>
          {listing.title}
        </AppText>

        <StatusPill label={listing.category.label} tone="lime" />
        <PriceHeadline listing={listing} />

        <View style={styles.trustRow}>
          {listing.owner.rating ? <Rating value={listing.owner.rating} /> : null}
          {listing.owner.rating && phoneVerification ? <View style={styles.divider} /> : null}
          {phoneVerification ? <VerificationBadge verification={phoneVerification} /> : null}
        </View>

        <InfoCard>
          <InfoRow icon="map-pin" label={area} />
          {offer?.availabilityText ? <InfoRow icon="calendar" label={offer.availabilityText} /> : null}
          {offer?.equipmentText ? <InfoRow icon="tool" label={offer.equipmentText} last /> : null}
        </InfoCard>

        {offer?.about ? (
          <View style={styles.section}>
            <SectionHeader title={nb.listingDetail.aboutOffer} />
            <AppText variant="body">{offer.about}</AppText>
          </View>
        ) : null}

        {offer?.services?.length ? (
          <View style={styles.section}>
            <SectionHeader title={nb.listingDetail.experienceAndServices} />
            <View style={styles.tags}>
              {offer.services.map((s) => (
                <StatusPill key={s} label={s} tone="lime" />
              ))}
            </View>
            {experienceLine ? (
              <AppText variant="meta" color="navyMuted">
                {experienceLine}
              </AppText>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <ProfileCard
            profile={listing.owner}
            variant="about"
            onPress={() => safePush(`/profil/${listing.owner.id}`)}
          />
        </View>
      </ScrollView>

      <StickyActions
        primaryLabel={nb.listingDetail.contact}
        onPrimary={() => safePush(`/chat/ny?listing=${listing.id}`)}
        secondaryLabel={nb.listingDetail.requestOffer}
        onSecondary={() => safePush(`/tilbud/be-om?listing=${listing.id}`)}
        note={nb.listingDetail.priceNoteOffer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: {
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.xxl,
    gap: tokens.space.md,
  },
  title: { marginTop: tokens.space.xs },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  divider: { width: 1, height: 16, backgroundColor: tokens.color.line },
  section: { gap: tokens.space.sm, marginTop: tokens.space.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
});
