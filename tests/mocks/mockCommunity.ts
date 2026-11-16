/**
 * The Fellesskap part of the in-memory client (0108). MockApiClient extends it.
 * Rules follow the database: verter pin, one vote per person,
 * youth are never counted as free helpers and can't sign up for the vennetjeneste.
 */
import { UserError } from '@/lib/errors';
import type { CommunityApi } from '@/api/communityApi';
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
import { profileRepository } from '@mocks/data/profileRepository';
import { noticeboardStore } from '@mocks/data/noticeboardStore';
import { neighbourhoodStore } from '@mocks/data/neighbourhoodStore';

const me = () => profileRepository.currentUserId;
const nameOf = (id: string) => profileRepository.getProfile(id)?.displayName ?? 'Nabo';
const first = (id: string) => nameOf(id).split(' ')[0];
const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 3600 * 1000).toISOString();
const today = () => new Date().toISOString().slice(0, 10);
let seq = 0;
const id = (p: string) => `${p}-${Date.now()}-${seq++}`;

function fresh() {
  return {
    joiners: {} as Record<string, { profileId: string; note: string }[]>,
    metoo: {} as Record<string, string[]>,
    commentLikes: {} as Record<string, string[]>,
    rules: {} as Record<string, string>,
    waves: [] as string[],
    hosts: {} as Record<string, string[]>,
    intros: {} as Record<string, Record<string, { intro: string; showAsNew: boolean; joinedAt: string }>>,
    organisations: [
      { id: 'org-lil-il', municipality: 'Lillehammer', name: 'Lillehammer IL', kind: 'IDRETT', about: 'Fotball, ski og friidrett for alle aldre.', url: 'https://lillehammeril.no', verified: true },
      { id: 'org-lil-korps', municipality: 'Lillehammer', name: 'Nordre Ål skolekorps', kind: 'KORPS', about: 'Korps for barn fra 3. klasse.', verified: true },
      { id: 'org-lil-vel', municipality: 'Lillehammer', name: 'Søre Ål vel', kind: 'VEL', about: 'Velforening for Søre Ål, med dugnader og 17. mai.', verified: false },
    ] as Organisation[],
    votes: {} as Record<string, string>,
    myOrgs: [] as string[],
    goal: { Lillehammer: { goalKr: 5000, collectedKr: 3200 } } as Record<string, { goalKr: number; collectedKr: number }>,
    followedPartners: [] as string[],
    questions: [
      { id: 'pq-1', partnerId: 'p-main-2', body: 'Når bør jeg skifte takrenner?', answer: 'Se etter rust og lekkasjer etter snøsmeltingen. Stålrenner holder 25–30 år.', answeredAt: daysAgo(3), mine: false, createdAt: daysAgo(5) },
    ] as PartnerQuestion[],
    tips: [] as { name: string; why: string; municipality: string }[],
    availableOn: {} as Record<string, string>,
    buddies: [] as BuddySignup[],
    items: {} as Record<string, (EventItem & { takersIds: string[] })[]>,
    photos: {} as Record<string, EventPhoto[]>,
    projects: [
      {
        id: 'cp-benk',
        authorId: 'u-emma',
        municipality: 'Lillehammer',
        kind: 'PROJECT',
        title: 'Ny benk ved lekeplassen på Søre Ål',
        body: 'Den gamle benken er råtten. Vi spør kommunen om lov, og bygger en ny på dugnad.',
        steps: ['Spørre kommunen', 'Finne materialer', 'Dugnad', 'Innvielse med kaffe'],
        stepsDone: 1,
        createdAt: daysAgo(6),
      },
      {
        id: 'cp-fartshump',
        authorId: 'u-jonas',
        municipality: 'Lillehammer',
        kind: 'PROPOSAL',
        title: 'Fartshump i Storgata ved skolen',
        body: 'Bilene kjører fort forbi skolen om morgenen. Vi foreslår en fartshump ved fotgjengerfeltet.',
        steps: [],
        stepsDone: 0,
        createdAt: daysAgo(2),
      },
    ] as CommunityProject[],
    supporters: {
      'cp-benk': [{ id: 'u-jonas', showName: false }, { id: 'u-andreas', showName: false }],
      'cp-fartshump': [{ id: 'u-emma', showName: true }],
    } as Record<string, { id: string; showName: boolean }[]>,
    areaPhotos: [
      { id: 'ap-1', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', caption: 'Morgentåke over Mjøsa', by: 'Emma', profileId: 'u-emma', likes: 7, mine: false, createdAt: daysAgo(2) },
      { id: 'ap-2', url: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=1200', caption: 'Fullmåne over Hafjell', by: 'Jonas', profileId: 'u-jonas', likes: 4, mine: false, createdAt: daysAgo(4) },
    ] as AreaPhoto[],
    photoLikes: {} as Record<string, boolean>,
    summary: { weekJobs: 6, weekNotices: 4, weekEvents: 2, monthHelped: 23 } as CommunitySummary,
  };
}

export const community = {
  ...fresh(),
  _reset() {
    Object.assign(community, fresh());
  },
};

const supportersOf = (projectId: string): { id: string; showName: boolean }[] => community.supporters[projectId] ?? [];

export class MockCommunity implements CommunityApi {
  async joinSharedListing(listingId: string, join: boolean, note?: string): Promise<number> {
    const list = (community.joiners[listingId] ?? []).filter((j) => j.profileId !== me());
    community.joiners[listingId] = join ? [...list, { profileId: me(), note: note ?? '' }] : list;
    return community.joiners[listingId].length;
  }

  async sharedListingJoiners(listingId: string): Promise<SharedJoiners> {
    const list = community.joiners[listingId] ?? [];
    return { count: list.length, mine: list.some((j) => j.profileId === me()), people: list.map((j) => ({ name: first(j.profileId), note: j.note })) };
  }

  async setNoticeMetoo(noticeId: string, on: boolean): Promise<number> {
    const list = (community.metoo[noticeId] ?? []).filter((p) => p !== me());
    community.metoo[noticeId] = on ? [...list, me()] : list;
    return community.metoo[noticeId].length;
  }

  async noticeMetoo(noticeId: string): Promise<MetooState> {
    const list = community.metoo[noticeId] ?? [];
    return { count: list.length, mine: list.includes(me()) };
  }

  async toggleCommentLike(commentId: string): Promise<number> {
    const list = community.commentLikes[commentId] ?? [];
    community.commentLikes[commentId] = list.includes(me()) ? list.filter((p) => p !== me()) : [...list, me()];
    return community.commentLikes[commentId].length;
  }

  async noticeCommentLikes(noticeId: string): Promise<CommentLikes> {
    const out: CommentLikes = {};
    for (const c of noticeboardStore.comments(noticeId)) {
      const list = community.commentLikes[c.id] ?? [];
      out[c.id] = { count: list.length, mine: list.includes(me()) };
    }
    return out;
  }

  async nabolagDetails(nabolagId: string): Promise<NabolagDetails> {
    const intros = community.intros[nabolagId] ?? {};
    const mine = intros[me()];
    return {
      rules: community.rules[nabolagId] ?? '',
      hosts: (community.hosts[nabolagId] ?? []).map((h) => ({ id: h, name: first(h) })),
      iAmHost: (community.hosts[nabolagId] ?? []).includes(me()),
      // like the database: '' for a member who hasn't written anything, null for someone outside
      myIntro: mine?.intro ?? (neighbourhoodStore.isMember(nabolagId, me()) ? '' : null),
      myShowAsNew: mine?.showAsNew ?? (neighbourhoodStore.isMember(nabolagId, me()) ? false : null),
      newMembers: Object.entries(intros)
        .filter(([pid, v]) => pid !== me() && v.showAsNew && Date.parse(v.joinedAt) > Date.now() - 30 * 24 * 3600 * 1000)
        .map(([pid, v]) => ({ id: pid, name: first(pid), intro: v.intro, joinedAt: v.joinedAt })),
    };
  }

  async setNabolagRules(nabolagId: string, rules: string): Promise<void> {
    if (!(community.hosts[nabolagId] ?? []).includes(me())) throw new UserError('Bare verter kan endre reglene.');
    community.rules[nabolagId] = rules.trim().slice(0, 1200);
  }

  async pinNotice(noticeId: string, pin: boolean): Promise<void> {
    const post = noticeboardStore.get(noticeId);
    if (!post?.neighbourhoodId) throw new UserError('Bare oppslag i et nabolag kan festes.');
    if (!(community.hosts[post.neighbourhoodId] ?? []).includes(me())) throw new UserError('Bare verter kan feste oppslag.');
    const pinned = noticeboardStore.list().filter((p) => p.neighbourhoodId === post.neighbourhoodId && p.pinnedAt && p.id !== noticeId);
    if (pin && pinned.length >= 3) throw new UserError('Det kan bare være 3 festede oppslag. Løsne et først.');
    noticeboardStore._patch(noticeId, { pinnedAt: pin ? now() : undefined });
  }

  async setNabolagIntro(nabolagId: string, intro: string, showAsNew: boolean): Promise<void> {
    const intros = (community.intros[nabolagId] ??= {});
    intros[me()] = { intro: intro.trim().slice(0, 140), showAsNew, joinedAt: intros[me()]?.joinedAt ?? now() };
  }

  async waveNeighbour(nabolagId: string, profileId: string): Promise<void> {
    void nabolagId;
    if (!community.waves.includes(profileId)) community.waves.push(profileId);
  }

  async myWaves(): Promise<string[]> {
    return [...community.waves];
  }

  async listOrganisations(municipality: string): Promise<Organisation[]> {
    return community.organisations.filter((o) => o.municipality === municipality);
  }

  async myOrganisations(): Promise<Organisation[]> {
    return community.organisations.filter((o) => community.myOrgs.includes(o.id));
  }

  async supportVoteState(municipality: string): Promise<SupportVoteState> {
    const counts: Record<string, number> = { 'org-lil-il': 12, 'org-lil-korps': 9 };
    const mine = community.votes[municipality] ?? null;
    if (mine) counts[mine] = (counts[mine] ?? 0) + 1;
    return { round: '2026-K4', mine, counts: municipality === 'Lillehammer' ? counts : mine ? { [mine]: 1 } : {}, goal: community.goal[municipality] ?? null };
  }

  async voteSupport(organisationId: string): Promise<void> {
    const o = community.organisations.find((x) => x.id === organisationId);
    if (!o) throw new UserError('Fant ikke foreningen.');
    community.votes[o.municipality] = organisationId;
  }

  async listFollowedPartnerIds(): Promise<string[]> {
    return [...community.followedPartners];
  }

  async toggleFollowPartner(partnerId: string): Promise<string[]> {
    community.followedPartners = community.followedPartners.includes(partnerId)
      ? community.followedPartners.filter((p) => p !== partnerId)
      : [...community.followedPartners, partnerId];
    return [...community.followedPartners];
  }

  async listPartnerQuestions(partnerId: string): Promise<PartnerQuestion[]> {
    return community.questions.filter((q) => q.partnerId === partnerId && (q.answeredAt || q.mine));
  }

  async askPartner(partnerId: string, body: string): Promise<void> {
    if (body.trim().length < 5) throw new UserError('Skriv litt mer.');
    if (community.questions.filter((q) => q.mine && Date.parse(q.createdAt) > Date.now() - 24 * 3600 * 1000).length >= 3) {
      throw new UserError('Du kan stille 3 spørsmål i døgnet. Prøv igjen i morgen.');
    }
    community.questions = [{ id: id('pq'), partnerId, body: body.trim(), mine: true, createdAt: now() }, ...community.questions];
  }

  async tipBusiness(input: { name: string; why: string; municipality: string }): Promise<void> {
    if (input.name.trim().length < 2) throw new UserError('Skriv navnet på bedriften.');
    community.tips.push(input);
  }

  async setAvailableToday(on: boolean): Promise<void> {
    if (on) community.availableOn[me()] = today();
    else delete community.availableOn[me()];
  }

  async helpersAvailableToday(municipality: string): Promise<AvailableToday> {
    const mine = community.availableOn[me()] === today();
    // two demo neighbours are always free, so the card has someone to show
    const people = municipality === 'Lillehammer' ? [{ id: 'u-jonas', name: 'Jonas' }, { id: 'u-andreas', name: 'Andreas' }] : [];
    return { count: people.length + (mine ? 1 : 0), mine, people };
  }

  async myBuddySignups(): Promise<BuddySignup[]> {
    return [...community.buddies];
  }

  async buddySignup(program: BuddyProgram, role: BuddyRole, note: string): Promise<void> {
    if (program === 'VENNETJENESTE' && profileRepository.getProfile(me())?.youthAge) throw new UserError('Vennetjenesten er for voksne.');
    community.buddies = [...community.buddies.filter((b) => b.program !== program), { program, role, note, createdAt: now() }];
  }

  async leaveBuddy(program: BuddyProgram): Promise<void> {
    community.buddies = community.buddies.filter((b) => b.program !== program);
  }

  async eventItems(noticeId: string): Promise<EventItem[]> {
    return (community.items[noticeId] ?? []).map(({ takersIds, ...i }) => ({ ...i, takers: takersIds.map((t) => ({ id: t, name: first(t) })) }));
  }

  async addEventItem(noticeId: string, label: string, needed?: number): Promise<void> {
    const post = noticeboardStore.get(noticeId);
    if (!post?.eventType) throw new UserError('Fant ikke arrangementet.');
    if (needed !== undefined && post.authorProfileId !== me()) throw new UserError('Bare arrangøren kan legge til frivillige oppgaver.');
    const list = (community.items[noticeId] ??= []);
    if (list.length >= 30) throw new UserError('Listen er full.');
    list.push({ id: id('ei'), label: label.trim(), needed: needed ?? null, createdBy: me(), takers: [], takersIds: [] });
  }

  async removeEventItem(itemId: string): Promise<void> {
    for (const k of Object.keys(community.items)) community.items[k] = community.items[k].filter((i) => i.id !== itemId);
  }

  async takeEventItem(itemId: string, take: boolean): Promise<void> {
    const item = Object.values(community.items).flat().find((i) => i.id === itemId);
    if (!item) throw new UserError('Fant ikke oppgaven.');
    const others = item.takersIds.filter((t) => t !== me());
    if (take && others.length >= (item.needed ?? 1)) throw new UserError('Noen har allerede tatt denne.');
    item.takersIds = take ? [...others, me()] : others;
  }

  async eventPhotos(noticeId: string): Promise<EventPhoto[]> {
    return [...(community.photos[noticeId] ?? [])];
  }

  async addEventPhoto(noticeId: string, path: string): Promise<void> {
    const post = noticeboardStore.get(noticeId);
    if (!post?.eventAt || Date.parse(post.eventAt) > Date.now()) throw new UserError('Bilder kan legges til når arrangementet har startet.');
    (community.photos[noticeId] ??= []).push({ id: id('ep'), url: path, profileId: me(), createdAt: now() });
  }

  async removeEventPhoto(photoId: string): Promise<void> {
    for (const k of Object.keys(community.photos)) community.photos[k] = community.photos[k].filter((p) => p.id !== photoId);
  }

  async listProjects(municipality: string): Promise<CommunityProject[]> {
    return community.projects.filter((p) => p.municipality === municipality);
  }

  async saveProject(input: ProjectInput): Promise<CommunityProject> {
    if (input.title.trim().length < 4) throw new UserError('Gi prosjektet en tittel.');
    const steps = input.steps.map((s) => s.trim()).filter(Boolean);
    if (steps.length > 8) throw new UserError('Bruk høyst 8 steg.');
    if (input.id) {
      const cur = community.projects.find((p) => p.id === input.id);
      if (!cur || cur.authorId !== me()) throw new UserError('Ikke tilgang.');
      const next: CommunityProject = {
        ...cur,
        title: input.title.trim(),
        body: input.body.trim(),
        steps,
        stepsDone: Math.min(input.stepsDone ?? cur.stepsDone, steps.length),
        closedAt: input.closed === undefined ? cur.closedAt : input.closed ? now() : undefined,
        sentAt: input.sent ? now() : cur.sentAt,
      };
      community.projects = community.projects.map((p) => (p.id === cur.id ? next : p));
      return next;
    }
    const p: CommunityProject = {
      id: id('cp'),
      authorId: me(),
      municipality: input.municipality,
      neighbourhoodId: input.neighbourhoodId,
      kind: input.kind,
      title: input.title.trim(),
      body: input.body.trim(),
      steps,
      stepsDone: 0,
      createdAt: now(),
    };
    community.projects = [p, ...community.projects];
    return p;
  }

  async deleteProject(projectId: string): Promise<void> {
    community.projects = community.projects.filter((p) => !(p.id === projectId && p.authorId === me()));
  }

  async supportProject(projectId: string, on: boolean, showName?: boolean): Promise<number> {
    const list = supportersOf(projectId).filter((s) => s.id !== me());
    community.supporters[projectId] = on ? [...list, { id: me(), showName: !!showName }] : list;
    return community.supporters[projectId].length;
  }

  async projectSupport(projectId: string): Promise<ProjectSupport> {
    const list = supportersOf(projectId);
    const author = community.projects.find((p) => p.id === projectId)?.authorId === me();
    return { count: list.length, mine: list.some((s) => s.id === me()), names: author ? list.filter((s) => s.showName).map((s) => nameOf(s.id)) : [] };
  }

  async areaPhotosWeek(municipality: string): Promise<AreaPhoto[]> {
    void municipality;
    return [...community.areaPhotos].sort((a, b) => b.likes - a.likes);
  }

  async addAreaPhoto(municipality: string, path: string, caption: string): Promise<void> {
    void municipality;
    if (community.areaPhotos.filter((p) => p.profileId === me() && Date.parse(p.createdAt) > Date.now() - 7 * 24 * 3600 * 1000).length >= 2) {
      throw new UserError('Du kan sende inn 2 bilder i uka.');
    }
    community.areaPhotos = [...community.areaPhotos, { id: id('ap'), url: path, caption: caption.trim(), by: first(me()), profileId: me(), likes: 0, mine: false, createdAt: now() }];
  }

  async toggleAreaPhotoLike(photoId: string): Promise<number> {
    let count = 0;
    community.areaPhotos = community.areaPhotos.map((p) => {
      if (p.id !== photoId) return p;
      const next = { ...p, mine: !p.mine, likes: p.likes + (p.mine ? -1 : 1) };
      count = next.likes;
      return next;
    });
    return count;
  }

  async communityBadges(profileId: string): Promise<CommunityBadges> {
    return profileId === me() ? { lent: 3, dugnads: 2, arranged: 1 } : { lent: 1, dugnads: 5, arranged: 0 };
  }

  async communitySummary(municipality: string): Promise<CommunitySummary> {
    return municipality === 'Lillehammer' ? { ...community.summary } : { weekJobs: 0, weekNotices: 0, weekEvents: 0, monthHelped: 0 };
  }

  async myCommunityYear(): Promise<CommunityYear> {
    return { lent: 3, borrowed: 1, events: 2, notices: 4, given: 2 };
  }
}
