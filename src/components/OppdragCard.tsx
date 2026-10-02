import type { StyleProp, ViewStyle } from 'react-native';
import type { Listing } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import { formatPrice } from '@/domain/price';
import { useIsSaved } from '@/api/queries';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import nb from '@/i18n/nb';
import { ListingCard, type ListingCardProps } from './ui/ListingCard';

/** Price row of the card: "Budsjett 400 kr", "Fra 300 kr", "Ønsker tilbud", "Frivillig". */
export function listingPrice(l: Listing): { label: string; value: string } {
  if (l.task?.isDugnad) return { label: '', value: nb.card.volunteer };
  if (!l.price || l.priceMode === 'BY_AGREEMENT') return { label: '', value: nb.card.wantsOffers };
  if (l.priceMode === 'FROM') return { label: nb.card.from, value: formatPrice(l.price) };
  return { label: nb.card.budget, value: formatPrice(l.price) };
}

/** "Nordre Ål · 1,2 km" – approximate area only (product rule 6). */
export function listingPlace(l: Listing): string {
  const d = l.location.distanceKm;
  const km = typeof d === 'number' ? ` · ${d.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} km` : '';
  return `${l.location.place || l.location.municipality}${km}`;
}

export function listingSchedule(l: Listing): string | undefined {
  const parts = [l.task?.scheduledText, l.task?.durationText].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

function extraBadge(l: Listing): ListingCardProps['extraBadge'] {
  if (l.task?.isDugnad) return { label: nb.card.dugnad, icon: 'users' };
  if (l.task?.recurrence) return { label: nb.card.recurring, icon: 'repeat' };
  return undefined;
}

export type OppdragCardProps = {
  listing: Listing;
  onPress?: () => void;
  statusBadge?: ListingCardProps['statusBadge'];
  /** Show "Verifisert" when the owner has a verification (Søk). */
  showVerified?: boolean;
  /** Show the "Ny" pill (Se alle: posted in the last day). */
  isNew?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * An oppdrag as a `.lcard`: real listing data, save heart with
 * "Lagret i Lagrede · Angre" toast. Tapping opens Oppdragsdetaljer.
 */
export function OppdragCard({ listing, onPress, statusBadge, showVerified, isNew, style, testID }: OppdragCardProps) {
  const [saved, toggle] = useIsSaved(listing.id);
  const price = listingPrice(listing);

  const onToggleSave = () => {
    toggle();
    if (!saved) {
      toast.success(nb.card.saved, { icon: 'heart', action: { label: nb.card.undo, onPress: toggle } });
    } else {
      toast.success(nb.card.unsaved, { icon: 'x' });
    }
  };

  return (
    <ListingCard
      testID={testID}
      style={style}
      title={listing.title}
      category={categoryArtId(listing.category.slug)}
      photoUri={listing.images[0]?.url}
      ownerName={listing.owner.displayName}
      ownerRating={listing.owner.rating?.count ? listing.owner.rating.average : null}
      verified={showVerified && listing.owner.verifications.some((v) => v.verified)}
      place={listingPlace(listing)}
      schedule={listingSchedule(listing)}
      priceLabel={price.label}
      priceValue={price.value}
      extraBadge={extraBadge(listing) ?? (isNew ? { label: nb.seAlle.isNew } : undefined)}
      statusBadge={statusBadge}
      saved={saved}
      onToggleSave={onToggleSave}
      onPress={onPress ?? (() => safePush(`/oppdrag/${listing.id}`))}
    />
  );
}
