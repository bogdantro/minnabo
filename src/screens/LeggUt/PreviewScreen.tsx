import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { draftStore } from '@/data/draftStore';
import { useCreateListing } from '@/api/queries';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/TopBar';
import { StatusPill } from '@/components/ui/StatusPill';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { InfoCard, InfoRow } from '@/components/ui/InfoCard';
import { Gallery } from '@/components/Gallery';
import { PriceHeadline } from '@/components/PriceHeadline';

export function PreviewScreen() {
  const router = useRouter();
  const listing = draftStore.get();
  const create = useCreateListing();

  if (!listing) {
    return (
      <SafeAreaView style={styles.wrap} edges={['bottom']}>
        <PageHeader title={nb.leggUt.previewTitle} />
        <View style={styles.empty}>
          <AppText variant="body" color="navyMuted">
            Fant ikke utkastet. Start på nytt.
          </AppText>
          <Button label={nb.leggUt.toFront} variant="secondary" onPress={() => router.replace('/legg-ut')} />
        </View>
      </SafeAreaView>
    );
  }

  const isTask = listing.type === 'TASK_REQUEST';

  const publish = () => {
    create.mutate(listing, {
      onSuccess: () => router.replace(`/legg-ut/publisert?id=${listing.id}`),
    });
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.leggUt.previewTitle} />
      <View style={styles.banner}>
        <Icon name="eye" size={16} color="navy" />
        <AppText variant="meta" weight="bold">
          {nb.leggUt.previewNote}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {listing.images.length > 0 ? (
          <Gallery images={listing.images} height={200} />
        ) : (
          <View style={styles.noImage}>
            <Icon name="image" size={24} color="navyMuted" />
            <AppText variant="meta" color="navyMuted">
              Ingen bilder lagt til
            </AppText>
          </View>
        )}

        <AppText variant="h1" weight="extrabold">
          {listing.title}
        </AppText>
        <View style={styles.badges}>
          <StatusPill label={listing.category.label} tone="lime" />
          <StatusPill
            label={isTask ? nb.badge.needsHelp : nb.badge.offersHelp}
            tone={isTask ? 'lime' : 'cyan'}
            filled
          />
        </View>
        <PriceHeadline listing={listing} />

        <InfoCard>
          <InfoRow icon="map-pin" label={listing.location.place} />
          {isTask && listing.task?.scheduledText ? (
            <InfoRow icon="calendar" label={listing.task.scheduledText} />
          ) : null}
          {isTask && listing.task?.durationText ? (
            <InfoRow icon="clock" label={listing.task.durationText} last />
          ) : null}
          {!isTask && listing.offer?.availabilityText ? (
            <InfoRow icon="calendar" label={listing.offer.availabilityText} />
          ) : null}
          {!isTask && typeof listing.offer?.maxDistanceKm === 'number' ? (
            <InfoRow icon="navigation" label={`${nb.common.upTo} ${listing.offer.maxDistanceKm} ${nb.common.km}`} last />
          ) : null}
        </InfoCard>

        <View style={styles.section}>
          <SectionHeader title={isTask ? nb.listingDetail.description : nb.listingDetail.aboutOffer} />
          <AppText variant="body">
            {isTask ? listing.task?.description : listing.offer?.about}
          </AppText>
        </View>

        {!isTask && listing.offer?.services?.length ? (
          <View style={styles.section}>
            <SectionHeader title={nb.listingDetail.experienceAndServices} />
            <View style={styles.badges}>
              {listing.offer.services.map((s) => (
                <StatusPill key={s} label={s} tone="lime" />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={nb.leggUt.publish}
          onPress={publish}
          loading={create.isPending}
        />
        {create.isError ? (
          <AppText variant="meta" color="dangerText" align="center">
            {nb.state.error}
          </AppText>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.color.limeTint,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.sm,
  },
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxl },
  noImage: {
    height: 120,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  section: { gap: tokens.space.sm, marginTop: tokens.space.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.space.md, padding: tokens.space.xxl },
  footer: {
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
    gap: tokens.space.sm,
  },
});
