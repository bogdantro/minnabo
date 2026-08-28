import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { draftStore } from '@/data/draftStore';
import { useCreateListing } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { DetailTopBar } from '@/components/TopBar';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { InfoCard, InfoRow } from '@/components/ui/InfoCard';
import { Gallery } from '@/components/Gallery';
import { PriceHeadline } from '@/components/PriceHeadline';
import { ConfirmRow } from './TaskRequestForm';

export function PreviewScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const listing = draftStore.get();
  const create = useCreateListing();
  const [confirmed, setConfirmed] = useState(false);
  const [showErr, setShowErr] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/legg-ut'));

  if (!listing) {
    return (
      <SafeAreaView style={styles.wrap} edges={['bottom']}>
        <DetailTopBar
          title={nb.leggUt.previewTitle}
          onBack={goBack}
          avatar={{ uri: me.avatarUrl, initials: me.initials }}
          onProfilePress={() => {}}
          onNotificationsPress={() => {}}
        />
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
    if (!confirmed) {
      setShowErr(true);
      return;
    }
    create.mutate(listing, {
      onSuccess: () => router.replace(`/legg-ut/publisert?id=${listing.id}`),
    });
  };

  const editStep = () => goBack();

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <DetailTopBar
        title={nb.leggUt.previewTitle}
        onBack={goBack}
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        unreadNotifications
        onProfilePress={() => {}}
        onNotificationsPress={() => {}}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <View style={styles.checkCircle}>
            <Icon name="check" size={16} color="white" />
          </View>
          <View style={styles.headingText}>
            <AppText variant="cardTitle" weight="bold">
              {isTask ? nb.leggUt.previewHeading : nb.leggUt.previewHeadingOffer}
            </AppText>
            <AppText variant="meta" color="navyMuted">
              {nb.leggUt.previewSub}
            </AppText>
          </View>
        </View>

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

        <View style={styles.card}>
          <EditableRow title={listing.title} onEdit={editStep} big />
          <View style={styles.badges}>
            <StatusPill label={listing.category.label} tone="lime" />
            <StatusPill label={nb.leggUt.notPublished} tone="neutral" filled />
          </View>
          <PriceHeadline listing={listing} />
          <View style={styles.rule} />
          <InfoCard>
            <InfoRow icon="map-pin" label={listing.location.place} />
            {isTask && listing.task?.scheduledText ? (
              <InfoRow icon="calendar" label={listing.task.scheduledText} />
            ) : null}
            {isTask && listing.task?.durationText ? (
              <InfoRow icon="clock" label={listing.task.durationText} last />
            ) : null}
            {!isTask && listing.offer?.availabilityText ? (
              <InfoRow icon="calendar" label={listing.offer.availabilityText} last />
            ) : null}
          </InfoCard>

          <EditableRow title={isTask ? nb.listingDetail.description : nb.listingDetail.aboutOffer} onEdit={editStep} />
          <AppText variant="body" color="navyMuted">
            {isTask ? listing.task?.description : listing.offer?.about}
          </AppText>

          {isTask ? (
            <>
              <EditableRow title={nb.listingDetail.practicalInfo} onEdit={editStep} />
              <InfoCard>
                {listing.task?.equipment ? (
                  <InfoRow icon="feather" label={listing.task.equipment} last={!listing.task?.meetingNote} />
                ) : null}
                {listing.task?.meetingNote ? (
                  <InfoRow icon="users" label={listing.task.meetingNote} last />
                ) : null}
              </InfoCard>
            </>
          ) : listing.offer?.services?.length ? (
            <>
              <EditableRow title={nb.listingDetail.experienceAndServices} onEdit={editStep} />
              <View style={styles.badges}>
                {listing.offer.services.map((s) => (
                  <StatusPill key={s} label={s} tone="lime" />
                ))}
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.checklist}>
          <ChecklistRow text={nb.leggUt.checkAddressPrivate} />
          <ChecklistRow text={nb.leggUt.checkPayment} />
        </View>

        <ConfirmRow value={confirmed} onChange={setConfirmed} />
        {showErr && !confirmed ? (
          <AppText variant="meta" color="dangerText">
            {nb.leggUt.errConfirm}
          </AppText>
        ) : null}
        {create.isError ? (
          <AppText variant="meta" color="dangerText" align="center">
            {nb.state.error}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={isTask ? nb.leggUt.publish : nb.leggUt.publishOffer}
          onPress={publish}
          loading={create.isPending}
        />
        <Button label={nb.leggUt.backAndEdit} variant="secondary" onPress={goBack} />
      </View>
    </SafeAreaView>
  );
}

function EditableRow({ title, onEdit, big }: { title: string; onEdit: () => void; big?: boolean }) {
  return (
    <View style={styles.editRow}>
      <AppText variant={big ? 'section' : 'cardTitle'} weight={big ? 'extrabold' : 'bold'}>
        {title}
      </AppText>
      <AppText variant="meta" weight="bold" color="cyan" onPress={onEdit}>
        ✎ {nb.leggUt.edit}
      </AppText>
    </View>
  );
}

function ChecklistRow({ text }: { text: string }) {
  return (
    <View style={styles.checkRow}>
      <Icon name="check-circle" size={16} color="lime" />
      <AppText variant="meta" color="navyMuted" style={styles.checkText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxl },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: { flex: 1 },
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
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    ...tokens.shadow.card,
  },
  editRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: tokens.space.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  rule: { height: 1, backgroundColor: tokens.color.line, marginVertical: tokens.space.xs },
  checklist: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    gap: tokens.space.sm,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  checkText: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.space.md, padding: tokens.space.xxl },
  footer: {
    gap: tokens.space.sm,
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
