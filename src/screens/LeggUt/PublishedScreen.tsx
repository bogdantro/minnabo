import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { draftStore } from '@/data/draftStore';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/TopBar';

export function PublishedScreen({ listingId }: { listingId?: string }) {
  const router = useRouter();
  const listing = draftStore.get();
  const isTask = listing?.type !== 'SERVICE_OFFER';

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader showBack={false} />
      <View style={styles.center}>
        <View style={styles.badge}>
          <Icon name="check" size={34} color="navy" />
        </View>
        <AppText variant="h1" weight="extrabold" align="center">
          {isTask ? nb.leggUt.publishedTitleTask : nb.leggUt.publishedTitleOffer}
        </AppText>
        <AppText variant="body" color="navyMuted" align="center">
          {nb.leggUt.publishedBody}
        </AppText>
      </View>

      <View style={styles.footer}>
        {listingId ? (
          <Button
            label={nb.leggUt.viewListing}
            onPress={() => {
              draftStore.clear();
              router.replace(`/oppdrag/${listingId}`);
            }}
          />
        ) : null}
        <Button
          label={nb.leggUt.toFront}
          variant="secondary"
          onPress={() => {
            draftStore.clear();
            router.replace('/');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.xxl,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tokens.color.limeTint,
    borderWidth: 2,
    borderColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.space.sm,
  },
  footer: { padding: tokens.space.xl, gap: tokens.space.sm },
});
