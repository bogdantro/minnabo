import type {
  AreaPhoto,
  AvailableToday,
  BuddyProgram,
  BuddyRole,
  BuddySignup,
  CommentLikes,
  CommunityBadges,
  CommunityProject,
  CommunitySummary,
  CommunityYear,
  EventItem,
  EventPhoto,
  MetooState,
  NabolagDetails,
  Organisation,
  PartnerQuestion,
  ProjectInput,
  ProjectSupport,
  SharedJoiners,
  SupportVoteState,
} from '@/domain/community';

/**
 * The Fellesskap part of the API (migration 0108). `ApiClient` extends it; SupabaseCommunity and
 * the tests' MockCommunity implement it.
 */
export interface CommunityApi {
  // shared helper for one street
  /** «Ta med min innkjørsel»; returns how many have joined. */
  joinSharedListing(listingId: string, join: boolean, note?: string): Promise<number>;
  sharedListingJoiners(listingId: string): Promise<SharedJoiners>;

  // oppslag topics
  /** «Hos meg også» on a strømbrudd; returns the count. */
  setNoticeMetoo(noticeId: string, on: boolean): Promise<number>;
  noticeMetoo(noticeId: string): Promise<MetooState>;
  /** A like on an answer («Anbefalinger» sorts by them); returns the count. */
  toggleCommentLike(commentId: string): Promise<number>;
  noticeCommentLikes(noticeId: string): Promise<CommentLikes>;

  // nabolag
  nabolagDetails(nabolagId: string): Promise<NabolagDetails>;
  /** Verter only. */
  setNabolagRules(nabolagId: string, rules: string): Promise<void>;
  /** Verter only; at most 3 pinned per nabolag. */
  pinNotice(noticeId: string, pin: boolean): Promise<void>;
  setNabolagIntro(nabolagId: string, intro: string, showAsNew: boolean): Promise<void>;
  /** «Si hei» to a new neighbour (once per person). */
  waveNeighbour(nabolagId: string, profileId: string): Promise<void>;
  /** The neighbours I have said hei to. */
  myWaves(): Promise<string[]>;

  // lag og foreninger, support
  listOrganisations(municipality: string): Promise<Organisation[]>;
  /** The lag / foreninger I may post arrangementer for (set in Admin). */
  myOrganisations(): Promise<Organisation[]>;
  supportVoteState(municipality: string): Promise<SupportVoteState>;
  voteSupport(organisationId: string): Promise<void>;

  // partners
  listFollowedPartnerIds(): Promise<string[]>;
  toggleFollowPartner(partnerId: string): Promise<string[]>;
  /** Answered questions, and mine before they are answered. */
  listPartnerQuestions(partnerId: string): Promise<PartnerQuestion[]>;
  askPartner(partnerId: string, body: string): Promise<void>;
  tipBusiness(input: { name: string; why: string; municipality: string }): Promise<void>;

  // helping today, buddies
  setAvailableToday(on: boolean): Promise<void>;
  helpersAvailableToday(municipality: string): Promise<AvailableToday>;
  myBuddySignups(): Promise<BuddySignup[]>;
  buddySignup(program: BuddyProgram, role: BuddyRole, note: string): Promise<void>;
  leaveBuddy(program: BuddyProgram): Promise<void>;

  // arrangementer
  eventItems(noticeId: string): Promise<EventItem[]>;
  /** `needed` set = a volunteer slot (the organiser only). */
  addEventItem(noticeId: string, label: string, needed?: number): Promise<void>;
  removeEventItem(itemId: string): Promise<void>;
  takeEventItem(itemId: string, take: boolean): Promise<void>;
  eventPhotos(noticeId: string): Promise<EventPhoto[]>;
  /** `path`: the photo in `listing-images`. */
  addEventPhoto(noticeId: string, path: string): Promise<void>;
  removeEventPhoto(photoId: string): Promise<void>;

  // projects
  listProjects(municipality: string): Promise<CommunityProject[]>;
  saveProject(input: ProjectInput): Promise<CommunityProject>;
  deleteProject(id: string): Promise<void>;
  supportProject(id: string, on: boolean, showName?: boolean): Promise<number>;
  projectSupport(id: string): Promise<ProjectSupport>;

  // «Ukas bilde»
  /** This week's photos, the most liked first (that one is «Ukas bilde»). */
  areaPhotosWeek(municipality: string): Promise<AreaPhoto[]>;
  addAreaPhoto(municipality: string, path: string, caption: string): Promise<void>;
  toggleAreaPhotoLike(photoId: string): Promise<number>;

  // summaries
  communityBadges(profileId: string): Promise<CommunityBadges>;
  communitySummary(municipality: string): Promise<CommunitySummary>;
  myCommunityYear(): Promise<CommunityYear>;
}
