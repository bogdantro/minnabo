import { useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { WEBSITE } from '@/config/links';
import nb from '@/i18n/nb';
import { draftStore } from '@/data/draftStore';
import { useListing } from '@/api/queries';
import { toast } from '@/lib/toast';
import { colors, radius, screenPadding, text } from '@/theme/theme';
import { listingPlace, listingPrice, listingSchedule } from '@/components/OppdragCard';
import { categoryArtId } from '@/domain/categories';
import {
  Button,
  Card,
  Confetti,
  DrawnCheck,
  FadeUp,
  Icon,
  ListingCard,
  Note,
  Screen,
  Sheet,
  SubHeader,
  type IconKey,
} from '@/components/ui';

/** Legg ut · Publisert (design/screens/Publisert.dc.html). `id = 'lokal'` = mock publish (nothing saved). */
export function PublishedScreen({ listingId }: { listingId?: string }) {
  const router = useRouter();
  const local = listingId === 'lokal';
  const remote = useListing(local ? '' : (listingId ?? ''));
  const listing = local ? draftStore.get() : remote.data;
  const [shareOpen, setShareOpen] = useState(false);

  const home = () => {
    draftStore.clear();
    router.replace('/');
  };
  // the website has no page per oppdrag yet – share the title with a link to the front page
  const link = WEBSITE.home;
  const title = listing?.title ?? '';

  const share: { icon: IconKey; label: string; run: () => Promise<unknown> | void; done: string }[] = [
    { icon: 'copy', label: nb.published.copy, run: () => Clipboard.setStringAsync(link), done: nb.published.copied },
    { icon: 'msg', label: nb.published.sms, run: () => Linking.openURL(`sms:?&body=${encodeURIComponent(`${title} ${link}`)}`), done: nb.published.openingSms },
    { icon: 'mail', label: nb.published.mail, run: () => Linking.openURL(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(link)}`), done: nb.published.openingMail },
    { icon: 'more', label: nb.published.more, run: () => Share.share({ message: `${title} ${link}` }), done: nb.published.openingMore },
  ];

  const price = listing ? listingPrice(listing) : null;

  return (
    <Screen
      white
      scroll
      header={<SubHeader onBack={home} close />}
      contentStyle={styles.content}
    >
      <Confetti count={7} />
      <View style={styles.center}>
        <DrawnCheck size={120} />
      </View>
      <FadeUp delay={150} style={styles.headBlock}>
        <Text style={[text.h1, styles.textCenter]} accessibilityRole="header">
          {nb.published.title}
        </Text>
        <Text style={[text.body, styles.lead]}>
          {nb.published.body(listing?.category.label ?? nb.published.yourCategory)}
        </Text>
      </FadeUp>
      {listing && price ? (
        <FadeUp delay={200}>
          <ListingCard
            title={listing.title}
            category={categoryArtId(listing.category.slug)}
            photoUri={listing.images[0]?.url}
            place={listingPlace(listing)}
            schedule={listingSchedule(listing)}
            priceLabel={price.label}
            priceValue={price.value}
            extraBadge={{ label: nb.published.active }}
            onPress={local ? undefined : () => router.push(`/oppdrag/${listingId}`)}
          />
        </FadeUp>
      ) : null}
      <FadeUp delay={250} style={styles.actions}>
        <Button label={nb.published.share} icon="share" variant="ghost" onPress={() => setShareOpen(true)} />
        <Button
          label={nb.published.see}
          variant="ink"
          disabled={local}
          onPress={() => router.replace(`/oppdrag/${listingId}`)}
        />
        <Button label={nb.published.home} variant="text" block={false} onPress={home} style={styles.selfCenter} />
      </FadeUp>
      <FadeUp delay={300}>
        <Card flat style={styles.tip}>
          <View style={styles.tipIcon}>
            <Icon name="zap" size={16} color={colors.limeDeep} />
          </View>
          <View style={styles.tipText}>
            <Text style={[text.label, { fontSize: 14.5 }]}>{nb.published.tipTitle}</Text>
            <Text style={[text.meta, { color: colors.ink2 }]}>{nb.published.tip}</Text>
          </View>
        </Card>
      </FadeUp>

      <Sheet visible={shareOpen} onClose={() => setShareOpen(false)} title={nb.published.share}>
        <View style={styles.shareRow}>
          {share.map((s) => (
            <Pressable
              key={s.label}
              accessibilityRole="button"
              accessibilityLabel={s.label}
              style={styles.shr}
              onPress={async () => {
                setShareOpen(false);
                try {
                  await s.run();
                  toast.success(s.done);
                } catch {
                  toast.error(nb.published.shareFailed);
                }
              }}
            >
              <View style={styles.shrIcon}>
                <Icon name={s.icon} size={22} />
              </View>
              <Text style={[text.chipSm, styles.textCenter, { fontSize: 12.5 }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
        <Note style={styles.mt8}>{nb.published.noAddress}</Note>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: 18, gap: 22, paddingBottom: 30 },
  center: { alignItems: 'center' },
  selfCenter: { alignSelf: 'center' },
  textCenter: { textAlign: 'center' },
  headBlock: { gap: 8, alignItems: 'center' },
  lead: { color: colors.mute, textAlign: 'center', maxWidth: 300 },
  actions: { gap: 10 },
  tip: { padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.surface2, borderRadius: radius.card },
  tipIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, gap: 3 },
  shareRow: { flexDirection: 'row', gap: 8, paddingTop: 6, paddingBottom: 10 },
  shr: { flex: 1, alignItems: 'center', gap: 8 },
  shrIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  mt8: { marginTop: 8 },
});
