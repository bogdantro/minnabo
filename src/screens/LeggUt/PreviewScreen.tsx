import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { serverMessage } from '@/lib/errors';
import nb from '@/i18n/nb';
import { draftStore } from '@/data/draftStore';
import { useCreateListing, useUpdateListing } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { categoryArtId } from '@/domain/categories';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import { listingPrice } from '@/components/OppdragCard';
import {
  Avatar,
  Button,
  Card,
  CategoryArt,
  EmptyState,
  FadeUp,
  FooterRow,
  Icon,
  ListingCard,
  Note,
  PaymentNote,
  Pill,
  Screen,
  Segmented,
  SlideIn,
  StickyFooter,
  SubHeader,
} from '@/components/ui';
import { wizardDraft } from './wizardModel';

type Phase = 'idle' | 'busy';

/** Leg ut · Forhåndsvisning (design/screens/Forhandsvisning.dc.html). */
export function PreviewScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const listing = draftStore.get();
  const meta = draftStore.meta();
  const editId = meta.editId;
  const create = useCreateListing();
  const update = useUpdateListing();
  const [tab, setTab] = useState<'card' | 'detail'>('card');
  const [phase, setPhase] = useState<Phase>('idle');

  const back = () => (router.canGoBack() ? router.back() : router.replace('/legg-ut'));

  if (!listing) {
    return (
      <Screen header={<SubHeader title={nb.preview.title} onBack={back} />}>
        <EmptyState
          icon="clip"
          title={nb.preview.missingTitle}
          body={nb.preview.missingBody}
          actionLabel={nb.preview.startAgain}
          onAction={() => router.replace('/legg-ut')}
        />
      </Screen>
    );
  }

  const cat = categoryArtId(listing.category.slug);
  const price = listingPrice(listing);
  const place = listing.location.place || listing.location.municipality;
  const when = listing.task?.scheduledText;
  const photos = listing.images.length;
  const ownerName = me.displayName || nb.preview.you;
  const checks = [
    nb.preview.checks.title,
    listing.task?.intake?.length ? nb.preview.checks.descDetails : nb.preview.checks.desc,
    photos ? nb.preview.checks.photos(photos) : nb.preview.checks.noPhotos,
    nb.preview.checks.approx,
  ];

  const publish = async () => {
    setPhase('busy');
    if (editId) {
      try {
        await update.mutateAsync({ id: editId, listing, extras: meta.extras ?? { offerAudience: 'ALL' } });
        draftStore.clear();
        haptics.success();
        toast.success(nb.preview.saved, { icon: 'check' });
        router.dismissTo((meta.back ?? `/oppdrag/${editId}`) as never);
      } catch (e) {
        setPhase('idle');
        toast.error(e instanceof Error && e.message ? e.message : nb.preview.saveFailed, { bottom: 130 });
      }
      return;
    }
    try {
      const id = (await create.mutateAsync({ listing, extras: meta.extras })).id;
      await wizardDraft.clear();
      haptics.success();
      // Straight to the success page – no extra "Fortsett" tap.
      router.replace(`/legg-ut/publisert?id=${id}`);
    } catch (e) {
      setPhase('idle');
      // the word filter and the spam limit explain themselves
      toast.error(serverMessage(e, nb.preview.publishFailed), { bottom: 130 });
    }
  };

  return (
    <Screen
      scroll
      spacer="foot"
      header={<SubHeader title={nb.preview.title} onBack={back} />}
      footer={
        <StickyFooter>
          {phase === 'idle' ? (
            <FooterRow>
              <Button label={nb.preview.edit} icon="edit" variant="ghost" onPress={back} style={styles.flex} />
              <Button label={editId ? nb.preview.saveChanges : nb.preview.publish} onPress={publish} style={styles.flex14} />
            </FooterRow>
          ) : (
            <Button
              label={editId ? nb.preview.saving : nb.preview.publishing}
              loading
              loadingLabel={editId ? nb.preview.saving : nb.preview.publishing}
              onPress={() => undefined}
            />
          )}
        </StickyFooter>
      }
    >
      <FadeUp style={styles.px}>
        <Text style={[text.meta, styles.center, styles.mb14]}>{nb.preview.how}</Text>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'card', label: nb.preview.card },
            { value: 'detail', label: nb.preview.detail },
          ]}
        />
      </FadeUp>

      {tab === 'card' ? (
        <SlideIn key="card" direction="back" style={[styles.px, styles.mt20]}>
          <Text style={[text.eyebrow, styles.mb10]}>{nb.preview.inList}</Text>
          <ListingCard
            title={listing.title}
            category={cat}
            photoUri={listing.images[0]?.url}
            ownerName={ownerName}
            place={place}
            schedule={when}
            priceLabel={price.label}
            priceValue={price.value}
            saved={false}
            onToggleSave={() => undefined}
          />
          <Note style={styles.mt12}>{nb.preview.cardNote}</Note>
        </SlideIn>
      ) : (
        <SlideIn key="detail" style={[styles.px, styles.mt20]}>
          <View style={[styles.frame, shadow.medium]}>
            <CategoryArt category={cat} uri={listing.images[0]?.url} height={170} iconSize={48} />
            <View style={styles.frameBody}>
              <View style={styles.row6}>
                <Pill label={nb.preview.openTask} tone="need" dot />
                <Pill label={listing.category.label} />
              </View>
              <Text style={text.h3}>{listing.title}</Text>
              <View style={styles.grid}>
                {[
                  [nb.preview.where, place],
                  [nb.preview.when, when ?? '–'],
                  [nb.preview.duration, listing.task?.durationText ?? '–'],
                  [nb.preview.price, price.label ? `${price.label} ${price.value}` : price.value],
                ].map(([k, v]) => (
                  <Card key={k} flat style={styles.fact}>
                    <Text style={text.meta}>{k}</Text>
                    <Text style={[text.label, { fontSize: 13.5 }]}>{v}</Text>
                  </Card>
                ))}
              </View>
              <View style={styles.area} accessibilityElementsHidden>
                <View style={[styles.rd, { left: -20, right: -20, top: 38, transform: [{ rotate: '-6deg' }] }]} />
                <View style={[styles.rd, { left: 150, width: 10, top: -20, height: 180 }]} />
                <View style={styles.zone} />
              </View>
              <Text style={[text.body, { fontSize: 14, color: colors.ink2 }]}>{listing.task?.description}</Text>
              <View style={styles.owner}>
                <Avatar initials={me.initials} uri={me.avatarUrl} me size={40} />
                <View style={styles.gap2}>
                  <Text style={[text.label, { fontSize: 14 }]}>{ownerName}</Text>
                  <Text style={text.meta}>{nb.preview.verified}</Text>
                </View>
              </View>
            </View>
          </View>
        </SlideIn>
      )}

      <FadeUp delay={150} style={[styles.px, styles.mt22]}>
        <Card pad>
          <View style={styles.readyHead}>
            <Text style={text.h4}>{nb.preview.ready}</Text>
            <Pill label={nb.preview.readyCount(checks.length, checks.length)} tone="ok" />
          </View>
          {checks.map((c, i) => (
            <View key={c} style={[styles.ck, i === checks.length - 1 && styles.ckLast]}>
              <View style={styles.ok}>
                <Icon name="check" size={14} color={colors.ok} />
              </View>
              <Text style={[text.bodySemi, { fontSize: 14.5 }]}>{c}</Text>
            </View>
          ))}
        </Card>
        <PaymentNote style={styles.mt14} />
      </FadeUp>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex14: { flex: 1.4 },
  center: { textAlign: 'center' },
  px: { paddingHorizontal: screenPadding },
  mb10: { marginBottom: 10 },
  mb14: { marginBottom: 14 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  mt20: { marginTop: 20 },
  mt22: { marginTop: 22 },
  gap2: { gap: 2 },
  row6: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  frame: { borderRadius: 28, backgroundColor: colors.white, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  frameBody: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 18, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: { width: '48.5%', flexGrow: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.card },
  area: { height: 120, borderRadius: 18, backgroundColor: colors.previewMap, overflow: 'hidden' },
  rd: { position: 'absolute', height: 10, backgroundColor: colors.white, borderRadius: 5 },
  zone: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 96,
    height: 96,
    marginLeft: -48,
    marginTop: -48,
    borderRadius: 48,
    backgroundColor: colors.wizardRing,
    borderWidth: 2,
    borderColor: colors.limeDot,
  },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line2 },
  readyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ck: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line2 },
  ckLast: { borderBottomWidth: 0 },
  ok: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.okTint, alignItems: 'center', justifyContent: 'center' },
});
