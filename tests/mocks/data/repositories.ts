import AsyncStorage from '@react-native-async-storage/async-storage';
import { isOpenListing } from '@/domain/editing';
import type { Listing, ListingFilter, ListingSort, ListingStatus } from '@/domain/types';
import { listings as seedListings } from './seed';
import { safetyStore } from './safetyStore';
import { profileRepository } from './profileRepository';

const USER_ADDED_KEY = 'minnabo.listings.userAdded';

let userAdded: Listing[] = [];
/** status changes from Mine oppføringer (pause / archive / soft delete) */
let statusOverrides: Record<string, ListingStatus> = {};
let replaced: Record<string, Listing> = {};
let editData: Record<string, { wizard: unknown | null; privateEstimateMinor: number | null }> = {};

const all = (): Listing[] =>
  [...userAdded, ...seedListings]
    .map((l) => replaced[l.id] ?? l)
    .map((l) => (statusOverrides[l.id] ? { ...l, status: statusOverrides[l.id] } : l));

const matchesFilter = (listing: Listing, filter?: ListingFilter): boolean => {
  if (!filter) return true;

  if (filter.type && listing.type !== filter.type) return false;

  if (filter.categorySlug && filter.categorySlug !== 'alle') {
    if (listing.category.slug !== filter.categorySlug) return false;
  }

  if (typeof filter.maxDistanceKm === 'number') {
    const d = listing.location.distanceKm;
    if (typeof d === 'number' && d > filter.maxDistanceKm) return false;
  }

  if (filter.municipalities && filter.municipalities.length > 0) {
    if (!filter.municipalities.includes(listing.location.municipality)) return false;
  }

  if (filter.verifiedOnly) {
    const hasVerified = listing.owner.verifications.some((v) => v.verified);
    if (!hasVerified) return false;
  }

  if (filter.query && filter.query.trim().length > 0) {
    // Text search matches the visible title only. It NEVER decides the
    // listing type — both a request and an offer can match "plen" (spec §7).
    const q = filter.query.trim().toLowerCase();
    const haystack = `${listing.title} ${listing.category.label}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  return true;
};

const sortListings = (items: Listing[], sort?: ListingSort): Listing[] => {
  const copy = [...items];
  switch (sort) {
    case 'NEWEST':
      return copy.sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    case 'PRICE':
      return copy.sort(
        (a, b) =>
          (a.price?.amountMinor ?? Number.POSITIVE_INFINITY) -
          (b.price?.amountMinor ?? Number.POSITIVE_INFINITY),
      );
    case 'DISTANCE':
      return copy.sort(
        (a, b) =>
          (a.location.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.location.distanceKm ?? Number.POSITIVE_INFINITY),
      );
    case 'RELEVANCE':
    default:
      return copy;
  }
};

export const repositories = {
  listings: {
    list(filter?: ListingFilter, sort?: ListingSort): Listing[] {
      return sortListings(
        all().filter(
          (l) =>
            matchesFilter(l, filter) &&
            isOpenListing(l.status) &&
            !safetyStore.isBlocked(l.owner.id) &&
            !profileRepository.getProfile(l.owner.id)?.paused,
        ),
        sort,
      );
    },
    get(id: string): Listing | undefined {
      return all().find((l) => l.id === id);
    },
    /** Everything owned by a profile, incl. paused/archived (not soft-deleted). */
    ownedBy(profileId: string): Listing[] {
      return all().filter((l) => l.owner.id === profileId && l.status !== 'REMOVED');
    },
    setStatus(id: string, status: ListingStatus): void {
      statusOverrides = { ...statusOverrides, [id]: status };
    },
    /** Edit: swap in the new version (status stays whatever setStatus says). */
    replace(listing: Listing): void {
      const { [listing.id]: _drop, ...rest } = statusOverrides;
      statusOverrides = rest;
      if (userAdded.some((l) => l.id === listing.id)) {
        userAdded = userAdded.map((l) => (l.id === listing.id ? listing : l));
        void repositories.listings.persist();
      } else {
        replaced = { ...replaced, [listing.id]: listing };
      }
    },
    setEditData(id: string, data: { wizard: unknown | null; privateEstimateMinor: number | null }): void {
      editData = { ...editData, [id]: data };
    },
    getEditData(id: string): { wizard: unknown | null; privateEstimateMinor: number | null } {
      return editData[id] ?? { wizard: null, privateEstimateMinor: null };
    },
    add(listing: Listing): void {
      userAdded = [listing, ...userAdded];
      void repositories.listings.persist();
    },
    async hydrate(): Promise<void> {
      try {
        const raw = await AsyncStorage.getItem(USER_ADDED_KEY);
        userAdded = raw ? (JSON.parse(raw) as Listing[]) : [];
      } catch {
        userAdded = [];
      }
    },
    async persist(): Promise<void> {
      try {
        await AsyncStorage.setItem(USER_ADDED_KEY, JSON.stringify(userAdded));
      } catch {
        // best effort only — mock layer
      }
    },
    _reset(): void {
      userAdded = [];
      statusOverrides = {};
      replaced = {};
      editData = {};
    },
  },
};
