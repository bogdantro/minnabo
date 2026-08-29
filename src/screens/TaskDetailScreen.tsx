import { ScrollView, View, StyleSheet } from 'react-native';
import type { Listing } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useIsSaved } from '@/api/queries';
import { safePush } from '@/lib/nav';
import { PageHeader } from '@/components/TopBar';
import { Gallery } from '@/components/Gallery';
import { AppText } from '@/components/ui/Text';
import { StatusPill } from '@/components/ui/StatusPill';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { InfoCard, InfoRow } from '@/components/ui/InfoCard';
import { PriceHeadline } from '@/components/PriceHeadline';
import { ProfileCard } from '@/components/ProfileCard';
import { StickyActions } from '@/components/StickyActions';

export function TaskDetailScreen({ listing, onBack }: { listing: Listing; onBack: () => void }) {
  const [saved, toggleSaved] = useIsSaved(listing.id);
  const task = listing.task;

  const distance =
    typeof listing.location.distanceKm === 'number'
      ? `${listing.location.place} · ${listing.location.distanceKm.toLocaleString('nb-NO')} ${nb.common.km} ${nb.common.away}`
      : listing.location.place;

  return (
    <View style={styles.wrap}>
      <PageHeader title={nb.listingDetail.taskTitle} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Gallery images={listing.images} saved={saved} onToggleSave={toggleSaved} height={240} />

        <View style={styles.titleRow}>
          <AppText variant="h1" weight="extrabold" style={styles.title}>
            {listing.title}
          </AppText>
          <StatusPill label={nb.badge.openTask} tone="cyan" />
        </View>

        <StatusPill label={listing.category.label} tone="lime" />
        <PriceHeadline listing={listing} />

        <InfoCard>
          <InfoRow icon="map-pin" label={distance} />
          {task?.scheduledText ? <InfoRow icon="calendar" label={task.scheduledText} /> : null}
          {task?.durationText ? <InfoRow icon="clock" label={task.durationText} last /> : null}
        </InfoCard>

        {task?.description ? (
          <View style={styles.section}>
            <SectionHeader title={nb.listingDetail.description} />
            <AppText variant="body">{task.description}</AppText>
          </View>
        ) : null}

        {task?.equipment || task?.meetingNote ? (
          <View style={styles.section}>
            <SectionHeader title={nb.listingDetail.practicalInfo} />
            <InfoCard>
              {task?.equipment ? (
                <InfoRow icon="feather" label={nb.listingDetail.equipment} value={task.equipment} last={!task?.meetingNote} />
              ) : null}
              {task?.meetingNote ? (
                <InfoRow icon="users" label={nb.listingDetail.meeting} value={task.meetingNote} last />
              ) : null}
            </InfoCard>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title={nb.listingDetail.taskOwner} />
          <ProfileCard
            profile={listing.owner}
            variant="owner"
            onPress={() => safePush(`/profil/${listing.owner.id}`)}
          />
        </View>
      </ScrollView>

      <StickyActions
        primaryLabel={nb.listingDetail.giveOffer}
        onPrimary={() => safePush(`/tilbud/ny?listing=${listing.id}`)}
        secondaryLabel={nb.listingDetail.sendMessage}
        onSecondary={() => safePush(`/chat/start?listing=${listing.id}`)}
        note={nb.listingDetail.priceNoteTask}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    marginTop: tokens.space.xs,
  },
  title: { flex: 1 },
  section: { gap: tokens.space.sm, marginTop: tokens.space.sm },
});
