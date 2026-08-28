import { View, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { formatPrice, formatFromPrice } from '@/domain/price';
import { draftStore } from '@/data/draftStore';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { HomeTopBar } from '@/components/TopBar';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { InfoBox } from '@/components/ui/InfoBox';
import { safePush } from '@/lib/nav';

const CONFETTI = [
  { top: 8, left: 30, color: tokens.color.lime, rot: '20deg' },
  { top: 0, left: 90, color: tokens.color.cyan, rot: '-15deg' },
  { top: 30, left: 8, color: tokens.color.cyan, rot: '40deg' },
  { top: 46, left: 120, color: tokens.color.lime, rot: '10deg' },
  { top: 4, right: 24, color: tokens.color.lime, rot: '-30deg' },
  { top: 40, right: 8, color: tokens.color.cyan, rot: '25deg' },
];

export function PublishedScreen({ listingId }: { listingId?: string }) {
  const router = useRouter();
  const me = useCurrentUser();
  const listing = draftStore.get();
  const isTask = listing?.type !== 'SERVICE_OFFER';

  const priceLabel = listing?.price
    ? listing.priceMode === 'FROM'
      ? formatFromPrice(listing.price)
      : formatPrice(listing.price)
    : nb.common.priceByAgreement;

  const done = (path: string) => {
    draftStore.clear();
    router.replace(path);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <HomeTopBar
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        onProfilePress={() => safePush('/profil')}
        onNotificationsPress={() => safePush('/varsler')}
      />

      <View style={styles.body}>
        <View style={styles.hero}>
          {CONFETTI.map((c, i) => (
            <View
              key={i}
              style={[
                styles.confetti,
                { backgroundColor: c.color, transform: [{ rotate: c.rot }] },
                'left' in c ? { left: c.left } : { right: (c as { right: number }).right },
                { top: c.top },
              ]}
            />
          ))}
          <View style={styles.badge}>
            <Icon name="check" size={34} color="white" />
          </View>
        </View>

        <AppText variant="h1" weight="extrabold" align="center">
          {isTask ? nb.leggUt.publishedTitleTask : nb.leggUt.publishedTitleOffer}
        </AppText>
        <AppText variant="body" color="navyMuted" align="center">
          {isTask ? nb.leggUt.publishedBodyTask : nb.leggUt.publishedBodyOffer}
        </AppText>

        {listing ? (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              {listing.images[0]?.url ? (
                <Image source={{ uri: listing.images[0].url }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Icon name="image" size={20} color="navyMuted" />
                </View>
              )}
              <View style={styles.cardInfo}>
                <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
                  {listing.title}
                </AppText>
                <StatusPill label={nb.leggUt.publishedStatus} tone="lime" />
                <AppText variant="meta" weight="bold" color="lime">
                  {priceLabel}
                  {isTask && listing.priceMode === 'BUDGET' ? ` · ${nb.leggUt.priceModeBudget}` : ''}
                </AppText>
                <View style={styles.metaRow}>
                  <Icon name="map-pin" size={12} color="cyan" />
                  <AppText variant="meta" color="navyMuted">
                    {listing.location.place}
                  </AppText>
                </View>
                {listing.task?.scheduledText ? (
                  <View style={styles.metaRow}>
                    <Icon name="calendar" size={12} color="cyan" />
                    <AppText variant="meta" color="navyMuted">
                      {listing.task.scheduledText}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.rule} />
            <View style={styles.metaRow}>
              <Icon name="bell" size={14} color="navy" />
              <AppText variant="meta" color="navyMuted" style={styles.notify}>
                {nb.leggUt.publishedNotify}
              </AppText>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={isTask ? nb.leggUt.seeListing : nb.leggUt.seeOffer}
            onPress={() => done(listingId ? `/oppdrag/${listingId}` : '/')}
          />
          <Button label={nb.leggUt.shareListing} variant="secondary" onPress={() => {}} />
          <AppText
            variant="meta"
            weight="bold"
            color="cyan"
            align="center"
            onPress={() => done('/mine')}
          >
            {nb.leggUt.toMyListings}
          </AppText>
        </View>

        <InfoBox icon="shield">{nb.leggUt.publishedReminder}</InfoBox>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: { flex: 1, paddingHorizontal: tokens.space.xl, gap: tokens.space.md, alignItems: 'stretch' },
  hero: { height: 100, alignItems: 'center', justifyContent: 'center', marginTop: tokens.space.md },
  confetti: { position: 'absolute', width: 10, height: 6, borderRadius: 2 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    gap: tokens.space.sm,
    ...tokens.shadow.card,
  },
  cardTop: { flexDirection: 'row', gap: tokens.space.md },
  thumb: { width: 84, height: 84, borderRadius: tokens.radius.md, backgroundColor: tokens.color.line },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 3, justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  notify: { flex: 1 },
  rule: { height: 1, backgroundColor: tokens.color.line },
  actions: { gap: tokens.space.sm, marginTop: tokens.space.sm },
});
