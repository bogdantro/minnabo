/**
 * Fellesskap types added with migration 0108: new kinds of oppslag, nabolag verter and rules, lag og
 * foreninger, support votes, partner follows and questions, arrangement lists and albums, projects,
 * «Ukas bilde», community badges and the weekly summaries.
 */

/**
 * The newer kinds of oppslag. Stored as a `topic` on a GENERAL oppslag, so an app from before 1.3
 * still shows them as an ordinary «Oppslag».
 */
export type NoticeTopic = 'WANT_BORROW' | 'SWAP' | 'FOOD' | 'HARVEST' | 'PET' | 'RIDE' | 'RECOMMEND' | 'OUTAGE';

export const NOTICE_TOPICS: NoticeTopic[] = ['WANT_BORROW', 'SWAP', 'FOOD', 'HARVEST', 'PET', 'RIDE', 'RECOMMEND', 'OUTAGE'];

/** Topics a youth account may not post (the database refuses them too). */
export const ADULT_ONLY_TOPICS: NoticeTopic[] = ['RIDE'];

/** «Ta med min innkjørsel» on a snømåking or hage oppdrag (0108). */
export type SharedJoiners = { count: number; mine: boolean; people: { name: string; note: string }[] };

/** Categories where neighbours can share one helper. */
export const SHARED_STREET_CATEGORIES = ['snomaking', 'hage'];

export type MetooState = { count: number; mine: boolean };
export type CommentLikes = Record<string, { count: number; mine: boolean }>;

export type NabolagMember = { id: string; name: string; intro: string; joinedAt: string };
export type NabolagDetails = {
  rules: string;
  hosts: { id: string; name: string }[];
  iAmHost: boolean;
  myIntro: string | null;
  myShowAsNew: boolean | null;
  newMembers: NabolagMember[];
};

export type OrganisationKind = 'IDRETT' | 'VEL' | 'KORPS' | 'KULTUR' | 'FRIVILLIG' | 'SKOLE' | 'ANNET';
export type Organisation = {
  id: string;
  municipality: string;
  name: string;
  kind: OrganisationKind;
  about: string;
  url?: string;
  logoUrl?: string;
  verified: boolean;
};

export type SupportVoteState = {
  /** «2026-K4» */
  round: string;
  mine: string | null;
  /** organisation id → votes */
  counts: Record<string, number>;
  goal: { goalKr: number; collectedKr: number } | null;
};

export type PartnerQuestion = {
  id: string;
  partnerId: string;
  body: string;
  answer?: string;
  answeredAt?: string;
  mine: boolean;
  createdAt: string;
};

export type AvailableToday = { count: number; mine: boolean; people: { id: string; name: string }[] };

export type BuddyProgram = 'SPRAKVENN' | 'VENNETJENESTE';
export type BuddyRole = 'WANTS' | 'GIVES';
export type BuddySignup = { program: BuddyProgram; role: BuddyRole; note: string; createdAt: string; pairedAt?: string };

/** «Hvem tar med hva» (needed null) or a volunteer slot (needed = how many). */
export type EventItem = {
  id: string;
  label: string;
  needed: number | null;
  createdBy: string | null;
  takers: { id: string; name: string }[];
};

export type EventPhoto = { id: string; url: string; profileId: string | null; createdAt: string };

export type ProjectKind = 'PROJECT' | 'PROPOSAL';
export type CommunityProject = {
  id: string;
  authorId: string;
  municipality: string;
  neighbourhoodId?: string;
  kind: ProjectKind;
  title: string;
  body: string;
  steps: string[];
  stepsDone: number;
  sentAt?: string;
  closedAt?: string;
  createdAt: string;
};
export type ProjectInput = {
  id?: string;
  kind: ProjectKind;
  title: string;
  body: string;
  steps: string[];
  stepsDone?: number;
  municipality: string;
  neighbourhoodId?: string;
  closed?: boolean;
  sent?: boolean;
};
export type ProjectSupport = { count: number; mine: boolean; names: string[] };

export type AreaPhoto = { id: string; url: string; caption: string; by: string; profileId: string | null; likes: number; mine: boolean; createdAt: string };

export type CommunityBadges = { lent: number; dugnads: number; arranged: number };
export type CommunitySummary = { weekJobs: number; weekNotices: number; weekEvents: number; monthHelped: number };
export type CommunityYear = { lent: number; borrowed: number; events: number; notices: number; given: number };
