import type {
  PortfolioItem,
  ReliabilityDetails,
  AppNotification,
  CompletionConfirmation,
  Listing,
  PublicProfile,
  ReliabilityStats,
  Review,
  VerificationKind,
} from '@/domain/types';
import { profiles } from './seed';
import { notificationsSeed, reviewsSeed } from './seedProfile';
import { repositories } from './repositories';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// The counterpart on the seeded agreement has already marked it done, so the
// current user can confirm once and reach the review flow.
const completionsSeed: CompletionConfirmation[] = [
  {
    agreementProposalId: 'p-martin-flytting',
    byProfileId: profiles.martin.id,
    confirmedAt: '2026-08-27T09:00:00Z',
  },
];

// A couple of seeded no-shows so the reliability score has something to show.
const noShowSeed: Record<string, number> = { 'u-sara': 1 };

let notifications: AppNotification[] = clone(notificationsSeed);
let reviews: Review[] = clone(reviewsSeed);
let portfolioItems: PortfolioItem[] = [];
let completions: CompletionConfirmation[] = clone(completionsSeed);
let noShows: Record<string, number> = clone(noShowSeed);
const editableProfile: PublicProfile = clone(profiles.mb);

const CURRENT_USER_ID = profiles.mb.id;

export const profileRepository = {
  currentUserId: CURRENT_USER_ID,

  getProfile(id: string): PublicProfile | undefined {
    if (id === CURRENT_USER_ID) return editableProfile;
    return Object.values(profiles).find((p) => p.id === id);
  },

  markVerified(kind: VerificationKind): PublicProfile {
    const explanation =
      kind === 'PHONE'
        ? 'Telefonnummeret er bekreftet med engangskode.'
        : kind === 'EMAIL'
          ? 'E-postadressen er bekreftet.'
          : 'Organisasjonsnummer og kontaktperson er kontrollert.';
    const existing = editableProfile.verifications.find((v) => v.kind === kind);
    if (existing) {
      existing.verified = true;
      existing.explanation = explanation;
      existing.verifiedAt = new Date().toISOString();
    } else {
      editableProfile.verifications.push({ kind, verified: true, explanation, verifiedAt: new Date().toISOString() });
    }
    if (kind === 'BUSINESS') editableProfile.isBusiness = true;
    return clone(editableProfile);
  },

  /** Slett konto (mock): anonymise like delete_my_account() does. */
  deletedReasons: [] as (string | undefined)[],
  deleteAccount(reason?: string): void {
    this.deletedReasons.push(reason);
    editableProfile.displayName = 'Slettet bruker';
    editableProfile.initials = '?';
    editableProfile.avatarUrl = undefined;
    editableProfile.presentation = undefined;
    editableProfile.homeNotes = undefined;
    editableProfile.portfolio = [];
    editableProfile.paused = true;
  },

  updateProfile(patch: Partial<Pick<PublicProfile, 'displayName' | 'presentation' | 'paused' | 'availableForJobs' | 'categorySlugs' | 'languages' | 'hasCar' | 'availabilityText' | 'homeNotes' | 'portfolio'>> & {
    place?: string;
    municipality?: string;
    avatarPath?: string | null;
    maxDistanceKm?: number;
  }): PublicProfile {
    if (patch.displayName !== undefined) editableProfile.displayName = patch.displayName;
    if (patch.presentation !== undefined) editableProfile.presentation = patch.presentation;
    if (patch.avatarPath !== undefined) editableProfile.avatarUrl = patch.avatarPath ?? undefined;
    if (patch.maxDistanceKm !== undefined) editableProfile.maxDistanceKm = patch.maxDistanceKm;
    if (patch.paused !== undefined) editableProfile.paused = patch.paused;
    if (patch.availableForJobs !== undefined) editableProfile.availableForJobs = patch.availableForJobs;
    if (patch.categorySlugs !== undefined) editableProfile.categorySlugs = patch.categorySlugs;
    if (patch.languages !== undefined) editableProfile.languages = patch.languages;
    if (patch.hasCar !== undefined) editableProfile.hasCar = patch.hasCar;
    if (patch.availabilityText !== undefined) editableProfile.availabilityText = patch.availabilityText.trim() || undefined;
    if (patch.homeNotes !== undefined) editableProfile.homeNotes = patch.homeNotes || undefined;
    if (patch.portfolio !== undefined) editableProfile.portfolio = patch.portfolio;
    if (patch.place !== undefined) {
      editableProfile.location = { ...editableProfile.location, place: patch.place };
    }
    if (patch.municipality !== undefined) {
      editableProfile.location = { ...editableProfile.location, municipality: patch.municipality };
    }
    return clone(editableProfile);
  },

  listNotifications(): AppNotification[] {
    return [...notifications].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  },
  unreadNotificationCount(): number {
    return notifications.filter((n) => !n.read).length;
  },
  markAllNotificationsRead(): void {
    notifications = notifications.map((n) => ({ ...n, read: true }));
  },
  markNotificationRead(id: string): void {
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  },

  reportNoShow(profileId: string): void {
    noShows = { ...noShows, [profileId]: (noShows[profileId] ?? 0) + 1 };
  },

  /**
   * Reliability = did they show up and finish, separate from the star rating.
   * `completed` uses the profile's completed-task count as the positive base;
   * `noShows` is how often the other party reported them absent. The score
   * stays undefined until there's a handful of data points.
   */
  replyToReview(reviewId: string, reply: string): Review {
    const r = reviews.find((x) => x.id === reviewId);
    if (!r || r.toProfileId !== CURRENT_USER_ID) throw new Error('Ikke tilgang.');
    const next = { ...r, reply: reply.trim(), repliedAt: new Date().toISOString() };
    reviews = reviews.map((x) => (x.id === reviewId ? next : x));
    return next;
  },

  listPortfolio(profileId: string): PortfolioItem[] {
    const own = portfolioItems.filter((i) => i.profileId === profileId);
    if (own.length) return own;
    return (profileRepository.getProfile(profileId)?.portfolio ?? []).map((url, i) => ({
      id: `pf-seed-${profileId}-${i}`,
      profileId,
      afterUrl: url,
      title: `Tidligere jobb ${i + 1}`,
      createdAt: '2026-01-01T00:00:00Z',
    }));
  },
  addPortfolioItem(input: { beforePath?: string; afterPath: string; title: string; place?: string; caption?: string; categorySlug?: string }): PortfolioItem {
    const item: PortfolioItem = {
      id: `pf-${Date.now()}-${portfolioItems.length}`,
      profileId: CURRENT_USER_ID,
      beforeUrl: input.beforePath,
      afterUrl: input.afterPath,
      title: input.title.trim(),
      place: input.place?.trim() || undefined,
      caption: input.caption?.trim() || undefined,
      categorySlug: input.categorySlug,
      doneAt: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    portfolioItems = [item, ...portfolioItems];
    return item;
  },
  removePortfolioItem(id: string): void {
    portfolioItems = portfolioItems.filter((i) => i.id !== id);
  },

  /** Last-12-months percentages; the mock has no timer or cancel history, so only "Møter opp". */
  reliabilityDetails(profileId: string): ReliabilityDetails {
    const r = profileRepository.reliabilityFor(profileId);
    return { completed: r.completed, showsUp: r.score };
  },

  reliabilityFor(profileId: string): ReliabilityStats {
    const profile = profileRepository.getProfile(profileId);
    const completed = profile?.completedTasks ?? 0;
    const ns = noShows[profileId] ?? 0;
    const total = completed + ns;
    return {
      completed,
      noShows: ns,
      score: total >= 3 ? Math.round((completed / total) * 100) : undefined,
    };
  },

  // Blind two-way reviews: a fresh review about someone stays hidden until
  // that person has also reviewed the same agreement (or the reveal window
  // passes), so neither side can hold their rating hostage.
  listReviewsForProfile(profileId: string): Review[] {
    const REVEAL_MS = 10 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return reviews
      .filter((r) => r.toProfileId === profileId)
      .filter(
        (r) =>
          now - Date.parse(r.createdAt) > REVEAL_MS ||
          reviews.some(
            (x) =>
              x.agreementProposalId === r.agreementProposalId &&
              x.fromProfileId === profileId,
          ),
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  myListings(type?: Listing['type']): Listing[] {
    return repositories.listings.ownedBy(CURRENT_USER_ID).filter((l) => !type || l.type === type);
  },

  completionsFor(agreementProposalId: string): CompletionConfirmation[] {
    return completions.filter((c) => c.agreementProposalId === agreementProposalId);
  },
  confirmCompletion(agreementProposalId: string, byProfileId: string): CompletionConfirmation[] {
    if (
      !completions.some(
        (c) => c.agreementProposalId === agreementProposalId && c.byProfileId === byProfileId,
      )
    ) {
      completions = [
        ...completions,
        { agreementProposalId, byProfileId, confirmedAt: new Date().toISOString() },
      ];
    }
    return profileRepository.completionsFor(agreementProposalId);
  },
  isFullyCompleted(agreementProposalId: string): boolean {
    return profileRepository.completionsFor(agreementProposalId).length >= 2;
  },

  submitReview(input: Omit<Review, 'id' | 'createdAt'>): Review {
    const review: Review = {
      ...input,
      id: `r-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    reviews = [review, ...reviews];
    return review;
  },
  /** Reviews the given person wrote — always visible to that person. */
  reviewsWrittenBy(fromProfileId: string): Review[] {
    return reviews
      .filter((r) => r.fromProfileId === fromProfileId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },
  hasReviewed(agreementProposalId: string, fromProfileId: string): boolean {
    return reviews.some(
      (r) => r.agreementProposalId === agreementProposalId && r.fromProfileId === fromProfileId,
    );
  },

  _reset(): void {
    portfolioItems = [];
    notifications = clone(notificationsSeed);
    reviews = clone(reviewsSeed);
    completions = clone(completionsSeed);
    noShows = clone(noShowSeed);
    Object.assign(editableProfile, clone(profiles.mb));
    delete editableProfile.paused;
    delete editableProfile.homeNotes;
    delete editableProfile.portfolio;
  },
};
