import type { ListingStatus, ProposalStatus } from './types';

/** An oppdrag can be edited until a tilbud is accepted (mirrors update_listing in 0034). */
const EDITABLE_LISTING: ListingStatus[] = ['DRAFT', 'PUBLISHED', 'RECEIVING_OFFERS', 'ACTIVE', 'PAUSED', 'EXPIRED'];
export const canEditListing = (s: ListingStatus) => EDITABLE_LISTING.includes(s);

/**
 * Open = looking for help: shown in the feed and in searches, and it can get tilbud.
 * Once a tilbud is accepted the oppdrag is taken (AGREED …) and leaves all of that;
 * calling the avtale off makes it RECEIVING_OFFERS again (mirrors 0047).
 */
export const OPEN_LISTING_STATUSES: ListingStatus[] = ['PUBLISHED', 'RECEIVING_OFFERS', 'ACTIVE'];
export const isOpenListing = (s: ListingStatus) => OPEN_LISTING_STATUSES.includes(s);

/** Taken: a tilbud is accepted and the job is agreed, under way or done. */
const TAKEN_LISTING: ListingStatus[] = ['OFFER_ACCEPTED', 'AGREED', 'IN_PROGRESS', 'COMPLETION_SENT', 'COMPLETED', 'REVIEWED'];
export const isTakenListing = (s: ListingStatus) => TAKEN_LISTING.includes(s);

/** A tilbud nobody answered within its 14 days: it can no longer be accepted. */
export const isExpiredProposal = (p: { status: ProposalStatus; expiresAt?: string }) =>
  (p.status === 'SENT' || p.status === 'REVISION_PENDING') && !!p.expiresAt && Date.parse(p.expiresAt) < Date.now();

/** A tilbud can be edited by its sender while it is still open (mirrors edit_proposal). */
export const canEditProposal = (s: ProposalStatus) => s === 'SENT' || s === 'REVISION_PENDING';

/** Route that opens the Legg ut wizard in edit mode. */
export const editListingHref = (id: string, back?: string) =>
  `/legg-ut?rediger=${encodeURIComponent(id)}${back ? `&tilbake=${encodeURIComponent(back)}` : ''}`;
