import type { StyleProp, ViewStyle } from 'react-native';
import type { Listing } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import { formatHourly, formatPrice } from '@/domain/price';
import { useIsSaved, usePriceGuidance } from '@/api/queries';
import { isUrgent } from '@/domain/urgent';
import { isOffer, offerAvailability } from '@/domain/offer';
import { useAlwaysShowsUp } from './ReliableBadge';
import { postedAgo } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import nb from '@/i18n/nb';
import { ListingCard, type ListingCardProps } from './ui/ListingCard';
import { useFeedInfo } from './oppdrag/feed';

/** Price row of the card: "Budsjett 400 kr", "Fra 300 kr", "Ønsker tilbud", "Frivillig". */
export function listingPrice(l: Listing): { label: string; value: string } {
  if (l.task?.isDugnad) return { label: '', value: nb.card.volunteer };
  // an offer without a price is agreed in the chat; an oppdrag without one wants tilbud
  if (!l.price || l.priceMode === 'BY_AGREEMENT') return { label: '', value: isOffer(l) ? nb.card.byAgreement : nb.card.wantsOffers };
  if (l.priceMode === 'FROM') return { label: nb.card.from, value: formatPrice(l.price) };
  if (l.priceMode === 'HOURLY') return { label: nb.card.hourly, value: formatHourly(l.price) };
  // an oppdrag's fixed amount is the owner's budget; a «Tilbyr hjelp» post's is the helper's own price
  return { label: isOffer(l) ? nb.card.fixed : nb.card.budget, value: formatPrice(l.price) };
}

/** "Nordre Ål · 1,2 km" – approximate area only (product rule 6). */
export function listingPlace(l: Listing): string {
  const d = l.location.distanceKm;
  const km = typeof d === 'number' ? ` · ${d.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} km` : '';
  return `${l.location.place || l.location.municipality}${km}`;
}

export function listingSchedule(l: Listing): string | undefined {
  if (isOffer(l)) return offerAvailability(l);
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
  // on «Tilbyr hjelp» the owner is the helper, so their track record belongs on the card
  const reliable = useAlwaysShowsUp(isOffer(listing) ? listing.owner.id : undefined);
  // on the Oppdrag tab (0110): small facts, the paler look once opened, the card menu
  const feed = useFeedInfo();
  const guide = usePriceGuidance(feed && !isOffer(listing) ? listing.category.slug : undefined).data;
  const tags: NonNullable<ListingCardProps['tags']> = [];
  if (feed && !isOffer(listing)) {
    if (feed.offerCounts[listing.id] === 0) tags.push({ label: nb.op.tags.noOffers, icon: 'sparkle', tone: 'lime' });
    if (listing.fromSenior) tags.push({ label: nb.op.tags.senior, icon: 'heart', tone: 'warn' });
    if (feed.nabolagPlaces.has(listing.location.place)) tags.push({ label: nb.op.tags.nabolag, icon: 'home', tone: 'cyan' });
    else if (feed.kommune && listing.location.municipality && listing.location.municipality !== feed.kommune) {
      tags.push({ label: listing.location.municipality, icon: 'pin' });
    }
    if (feed.fast.has(listing.owner.id)) tags.push({ label: nb.op.tags.fast, icon: 'zap' });
    if (listing.estimatedMinutes) tags.push({ label: nb.op.tags.duration(listing.estimatedMinutes), icon: 'clock' });
    if (listing.task?.equipment) tags.push({ label: nb.op.tags.equipment(listing.task.equipment.slice(0, 24)), icon: 'montering' });
    // a price is never shown without the payment note on the tab (rule 4)
    if (guide && !listing.price) tags.push({ label: nb.op.tags.price(formatPrice({ amountMinor: guide.low * 100, currency: 'NOK' }), formatPrice({ amountMinor: guide.high * 100, currency: 'NOK' })), icon: 'tag' });
  }

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
      photoTop
      ownerName={listing.owner.displayName}
      ownerRating={listing.owner.rating?.count ? listing.owner.rating.average : null}
      owner={{ id: listing.owner.id, initials: listing.owner.initials, avatarUrl: listing.owner.avatarUrl }}
      posted={postedAgo(listing.createdAt).replace(/^for /, '')}
      verified={showVerified && listing.owner.verifications.some((v) => v.verified)}
      place={listingPlace(listing)}
      schedule={listingSchedule(listing)}
      priceLabel={price.label}
      priceValue={price.value}
      extraBadge={extraBadge(listing) ?? (isNew ? { label: nb.seAlle.isNew } : undefined)}
      kind={isOffer(listing) ? 'offer' : 'need'}
      urgent={isUrgent(listing)}
      reliable={reliable}
      statusBadge={statusBadge}
      saved={saved}
      onToggleSave={onToggleSave}
      heroId={onPress ? undefined : listing.id}
      tags={tags}
      compact={!!feed?.compact}
      onLongPress={feed?.onMenu ? () => feed.onMenu!(listing) : undefined}
      onPress={onPress ?? (() => safePush(`/oppdrag/${listing.id}`))}
    />
  );
}
