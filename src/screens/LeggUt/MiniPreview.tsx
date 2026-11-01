import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { Listing } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import { colors, radius, shadow, text } from '@/theme/theme';
import { listingPlace, listingPrice, listingSchedule } from '@/components/OppdragCard';
import { CategoryArt, Pill } from '@/components/ui';

/**
 * The live preview in Legg ut: a small version of the card naboene will see, updating as the
 * form fills in – so nobody has to wait for «Forhåndsvis» to know how it looks.
 */
export function MiniPreview({ listing }: { listing: Listing }) {
  const price = listingPrice(listing);
  const meta = [listing.location.place || listing.location.municipality ? listingPlace(listing) : null, listingSchedule(listing)]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[styles.card, shadow.card]} accessibilityLabel={`${nb.wizard.livePreview}: ${listing.title || nb.wizard.liveTitlePh}`} testID="live-preview">
      <CategoryArt category={categoryArtId(listing.category.slug)} uri={listing.images[0]?.url} width={52} height={52} radius={14} iconSize={22} />
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.eyebrow}>{nb.wizard.livePreview}</Text>
          <Pill label="Trenger hjelp" tone="need" dot size="sm" />
        </View>
        <Text style={[text.label, styles.title, !listing.title && styles.ph]} numberOfLines={1}>
          {listing.title || nb.wizard.liveTitlePh}
        </Text>
        <Text style={text.meta} numberOfLines={1}>
          {[meta, price.label ? `${price.label} ${price.value}` : price.value].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line2,
    marginTop: 4,
    marginBottom: 14,
  },
  body: { flex: 1, minWidth: 0, gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  eyebrow: { ...text.eyebrow, fontSize: 10.5 },
  title: { fontSize: 14.5 },
  ph: { color: colors.faint },
});
