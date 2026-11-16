import { supabase } from '@/lib/supabase';
import { backendError } from '@/lib/errors';
import { publicUrl } from '@/lib/storage';
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
  OrganisationKind,
  PartnerQuestion,
  ProjectInput,
  ProjectKind,
  ProjectSupport,
  SharedJoiners,
  SupportVoteState,
} from '@/domain/community';
import type { CommunityApi } from './communityApi';

/** The Fellesskap part of the Supabase client (0108). SupabaseApiClient extends it. */

function fail(err: { message?: string; code?: string } | string | null | undefined): never {
  throw backendError(err ?? undefined);
}

async function myId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) fail('Ikke innlogget.');
  return data.user.id;
}

/** An RPC that answers with JSON; errors are thrown as the user's message. */
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) fail(error);
  return data as T;
}

const n = (v: unknown) => Number(v ?? 0);
const image = (path?: string | null) => publicUrl('listing-images', path) ?? undefined;

type OrganisationRow = { id: string; municipality: string; name: string; kind: OrganisationKind; about: string; url: string | null; logo_path: string | null; verified: boolean };
type ProjectRow = {
  id: string;
  author_id: string;
  municipality: string;
  neighbourhood_id: string | null;
  kind: ProjectKind;
  title: string;
  body: string;
  steps: string[] | null;
  steps_done: number;
  sent_at: string | null;
  closed_at: string | null;
  created_at: string;
};
const toProject = (r: ProjectRow): CommunityProject => ({
  id: r.id,
  authorId: r.author_id,
  municipality: r.municipality,
  neighbourhoodId: r.neighbourhood_id ?? undefined,
  kind: r.kind,
  title: r.title,
  body: r.body,
  steps: r.steps ?? [],
  stepsDone: r.steps_done,
  sentAt: r.sent_at ?? undefined,
  closedAt: r.closed_at ?? undefined,
  createdAt: r.created_at,
});

export class SupabaseCommunity implements CommunityApi {
  async joinSharedListing(listingId: string, join: boolean, note?: string): Promise<number> {
    return n(await rpc('join_shared_listing', { p_listing: listingId, p_join: join, p_note: note ?? '' }));
  }

  async sharedListingJoiners(listingId: string): Promise<SharedJoiners> {
    const { data, error } = await supabase.rpc('shared_listing_joiners', { p_listing: listingId });
    // before 0108 is pushed nobody can join, so there is nothing to show
    if (error || !data) return { count: 0, mine: false, people: [] };
    const d = data as SharedJoiners;
    return { count: n(d.count), mine: !!d.mine, people: d.people ?? [] };
  }

  async setNoticeMetoo(noticeId: string, on: boolean): Promise<number> {
    return n(await rpc('set_notice_metoo', { p_notice: noticeId, p_on: on }));
  }

  async noticeMetoo(noticeId: string): Promise<MetooState> {
    const d = await rpc<MetooState>('notice_metoo_state', { p_notice: noticeId });
    return { count: n(d?.count), mine: !!d?.mine };
  }

  async toggleCommentLike(commentId: string): Promise<number> {
    return n(await rpc('toggle_comment_like', { p_comment: commentId }));
  }

  async noticeCommentLikes(noticeId: string): Promise<CommentLikes> {
    const { data, error } = await supabase.rpc('notice_comment_likes_for', { p_notice: noticeId });
    if (error || !data) return {};
    return data as CommentLikes;
  }

  async nabolagDetails(nabolagId: string): Promise<NabolagDetails> {
    const d = await rpc<NabolagDetails>('nabolag_details', { p_nabolag: nabolagId });
    return {
      rules: d?.rules ?? '',
      hosts: d?.hosts ?? [],
      iAmHost: !!d?.iAmHost,
      myIntro: d?.myIntro ?? null,
      myShowAsNew: d?.myShowAsNew ?? null,
      newMembers: d?.newMembers ?? [],
    };
  }

  async setNabolagRules(nabolagId: string, rules: string): Promise<void> {
    await rpc('set_nabolag_rules', { p_nabolag: nabolagId, p_rules: rules });
  }

  async pinNotice(noticeId: string, pin: boolean): Promise<void> {
    await rpc('pin_notice', { p_notice: noticeId, p_pin: pin });
  }

  async setNabolagIntro(nabolagId: string, intro: string, showAsNew: boolean): Promise<void> {
    await rpc('set_nabolag_intro', { p_nabolag: nabolagId, p_intro: intro, p_show_as_new: showAsNew });
  }

  async waveNeighbour(nabolagId: string, profileId: string): Promise<void> {
    await rpc('wave_neighbour', { p_nabolag: nabolagId, p_to: profileId });
  }

  async myWaves(): Promise<string[]> {
    const { data, error } = await supabase.rpc('my_waves');
    if (error) return [];
    return (data ?? []) as string[];
  }

  async listOrganisations(municipality: string): Promise<Organisation[]> {
    const { data, error } = await supabase.from('organisations').select('*').eq('municipality', municipality).eq('active', true).order('name');
    if (error) return [];
    return ((data ?? []) as OrganisationRow[]).map((r) => ({
      id: r.id,
      municipality: r.municipality,
      name: r.name,
      kind: r.kind,
      about: r.about,
      url: r.url ?? undefined,
      logoUrl: image(r.logo_path),
      verified: r.verified,
    }));
  }

  async myOrganisations(): Promise<Organisation[]> {
    const { data, error } = await supabase.from('organisation_admins').select('organisations(*)');
    if (error) return [];
    return ((data ?? []) as unknown as { organisations: OrganisationRow | null }[])
      .map((r) => r.organisations)
      .filter((r): r is OrganisationRow => !!r)
      .map((r) => ({
        id: r.id,
        municipality: r.municipality,
        name: r.name,
        kind: r.kind,
        about: r.about,
        url: r.url ?? undefined,
        logoUrl: image(r.logo_path),
        verified: r.verified,
      }));
  }

  async supportVoteState(municipality: string): Promise<SupportVoteState> {
    const { data, error } = await supabase.rpc('support_vote_state', { p_municipality: municipality });
    if (error || !data) return { round: '', mine: null, counts: {}, goal: null };
    const d = data as SupportVoteState;
    return { round: d.round, mine: d.mine ?? null, counts: d.counts ?? {}, goal: d.goal ?? null };
  }

  async voteSupport(organisationId: string): Promise<void> {
    await rpc('vote_support', { p_org: organisationId });
  }

  async listFollowedPartnerIds(): Promise<string[]> {
    const { data, error } = await supabase.from('partner_follows').select('partner_id');
    if (error) return [];
    return ((data ?? []) as { partner_id: string }[]).map((r) => r.partner_id);
  }

  async toggleFollowPartner(partnerId: string): Promise<string[]> {
    const me = await myId();
    const now = await this.listFollowedPartnerIds();
    const { error } = now.includes(partnerId)
      ? await supabase.from('partner_follows').delete().eq('partner_id', partnerId).eq('profile_id', me)
      : await supabase.from('partner_follows').insert({ partner_id: partnerId, profile_id: me });
    if (error) fail(error);
    return this.listFollowedPartnerIds();
  }

  async listPartnerQuestions(partnerId: string): Promise<PartnerQuestion[]> {
    const me = await myId().catch(() => '');
    const { data, error } = await supabase.from('partner_questions').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false });
    if (error) return [];
    return ((data ?? []) as { id: string; partner_id: string; profile_id: string | null; body: string; answer: string | null; answered_at: string | null; created_at: string }[]).map((r) => ({
      id: r.id,
      partnerId: r.partner_id,
      body: r.body,
      answer: r.answer ?? undefined,
      answeredAt: r.answered_at ?? undefined,
      mine: !!me && r.profile_id === me,
      createdAt: r.created_at,
    }));
  }

  async askPartner(partnerId: string, body: string): Promise<void> {
    const me = await myId();
    const { error } = await supabase.from('partner_questions').insert({ partner_id: partnerId, profile_id: me, body: body.trim() });
    if (error) fail(error);
  }

  async tipBusiness(input: { name: string; why: string; municipality: string }): Promise<void> {
    const me = await myId();
    const { error } = await supabase
      .from('business_tips')
      .insert({ profile_id: me, name: input.name.trim(), why: input.why.trim(), municipality: input.municipality });
    if (error) fail(error);
  }

  async setAvailableToday(on: boolean): Promise<void> {
    await rpc('set_available_today', { p_on: on });
  }

  async helpersAvailableToday(municipality: string): Promise<AvailableToday> {
    const { data, error } = await supabase.rpc('helpers_available_today', { p_municipality: municipality });
    if (error || !data) return { count: 0, mine: false, people: [] };
    const d = data as AvailableToday;
    return { count: n(d.count), mine: !!d.mine, people: d.people ?? [] };
  }

  async myBuddySignups(): Promise<BuddySignup[]> {
    const { data, error } = await supabase.from('buddy_signups').select('*');
    if (error) return [];
    return ((data ?? []) as { program: BuddyProgram; role: BuddyRole; note: string; created_at: string; paired_at: string | null }[]).map((r) => ({
      program: r.program,
      role: r.role,
      note: r.note,
      createdAt: r.created_at,
      pairedAt: r.paired_at ?? undefined,
    }));
  }

  async buddySignup(program: BuddyProgram, role: BuddyRole, note: string): Promise<void> {
    await rpc('buddy_signup', { p_program: program, p_role: role, p_note: note });
  }

  async leaveBuddy(program: BuddyProgram): Promise<void> {
    const me = await myId();
    const { error } = await supabase.from('buddy_signups').delete().eq('profile_id', me).eq('program', program);
    if (error) fail(error);
  }

  async eventItems(noticeId: string): Promise<EventItem[]> {
    const { data, error } = await supabase.rpc('event_items_for', { p_notice: noticeId });
    if (error) return [];
    return (data ?? []) as EventItem[];
  }

  async addEventItem(noticeId: string, label: string, needed?: number): Promise<void> {
    await rpc('add_event_item', { p_notice: noticeId, p_label: label.trim(), p_needed: needed ?? null });
  }

  async removeEventItem(itemId: string): Promise<void> {
    await rpc('remove_event_item', { p_item: itemId });
  }

  async takeEventItem(itemId: string, take: boolean): Promise<void> {
    await rpc('take_event_item', { p_item: itemId, p_take: take });
  }

  async eventPhotos(noticeId: string): Promise<EventPhoto[]> {
    const { data, error } = await supabase.rpc('event_photos_for', { p_notice: noticeId });
    if (error) return [];
    return ((data ?? []) as { id: string; path: string; profileId: string | null; createdAt: string }[]).map((r) => ({
      id: r.id,
      url: image(r.path) ?? '',
      profileId: r.profileId,
      createdAt: r.createdAt,
    }));
  }

  async addEventPhoto(noticeId: string, path: string): Promise<void> {
    await rpc('add_event_photo', { p_notice: noticeId, p_path: path });
  }

  async removeEventPhoto(photoId: string): Promise<void> {
    await rpc('remove_event_photo', { p_photo: photoId });
  }

  async listProjects(municipality: string): Promise<CommunityProject[]> {
    const { data, error } = await supabase
      .from('community_projects')
      .select('*')
      .eq('municipality', municipality)
      .is('hidden_at', null)
      .order('created_at', { ascending: false });
    if (error) return [];
    return ((data ?? []) as ProjectRow[]).map(toProject);
  }

  async saveProject(input: ProjectInput): Promise<CommunityProject> {
    const me = await myId();
    const row = {
      kind: input.kind,
      title: input.title.trim(),
      body: input.body.trim(),
      steps: input.steps.map((s) => s.trim()).filter(Boolean),
      ...(input.stepsDone !== undefined ? { steps_done: input.stepsDone } : {}),
      ...(input.closed !== undefined ? { closed_at: input.closed ? new Date().toISOString() : null } : {}),
      ...(input.sent ? { sent_at: new Date().toISOString() } : {}),
    };
    const { data, error } = input.id
      ? await supabase.from('community_projects').update(row).eq('id', input.id).eq('author_id', me).select('*').single()
      : await supabase
          .from('community_projects')
          .insert({ ...row, author_id: me, municipality: input.municipality, neighbourhood_id: input.neighbourhoodId ?? null })
          .select('*')
          .single();
    if (error) fail(error);
    return toProject(data as ProjectRow);
  }

  async deleteProject(id: string): Promise<void> {
    const me = await myId();
    const { error } = await supabase.from('community_projects').delete().eq('id', id).eq('author_id', me);
    if (error) fail(error);
  }

  async supportProject(id: string, on: boolean, showName?: boolean): Promise<number> {
    return n(await rpc('support_project', { p_project: id, p_on: on, p_show_name: !!showName }));
  }

  async projectSupport(id: string): Promise<ProjectSupport> {
    const { data, error } = await supabase.rpc('project_support_state', { p_project: id });
    if (error || !data) return { count: 0, mine: false, names: [] };
    const d = data as ProjectSupport;
    return { count: n(d.count), mine: !!d.mine, names: d.names ?? [] };
  }

  async areaPhotosWeek(municipality: string): Promise<AreaPhoto[]> {
    const { data, error } = await supabase.rpc('area_photos_week', { p_municipality: municipality });
    if (error) return [];
    return ((data ?? []) as (Omit<AreaPhoto, 'url'> & { path: string })[]).map(({ path, ...p }) => ({ ...p, likes: n(p.likes), url: image(path) ?? '' }));
  }

  async addAreaPhoto(municipality: string, path: string, caption: string): Promise<void> {
    const me = await myId();
    const { error } = await supabase.from('area_photos').insert({ profile_id: me, municipality, path, caption: caption.trim() });
    if (error) fail(error);
  }

  async toggleAreaPhotoLike(photoId: string): Promise<number> {
    return n(await rpc('toggle_area_photo_like', { p_photo: photoId }));
  }

  async communityBadges(profileId: string): Promise<CommunityBadges> {
    const { data, error } = await supabase.rpc('community_badges', { p_profile: profileId });
    const d = (error ? null : data) as Partial<CommunityBadges> | null;
    return { lent: n(d?.lent), dugnads: n(d?.dugnads), arranged: n(d?.arranged) };
  }

  async communitySummary(municipality: string): Promise<CommunitySummary> {
    const { data, error } = await supabase.rpc('community_summary', { p_municipality: municipality });
    const d = (error ? null : data) as Partial<CommunitySummary> | null;
    return { weekJobs: n(d?.weekJobs), weekNotices: n(d?.weekNotices), weekEvents: n(d?.weekEvents), monthHelped: n(d?.monthHelped) };
  }

  async myCommunityYear(): Promise<CommunityYear> {
    const { data, error } = await supabase.rpc('my_community_year');
    const d = (error ? null : data) as Partial<CommunityYear> | null;
    return { lent: n(d?.lent), borrowed: n(d?.borrowed), events: n(d?.events), notices: n(d?.notices), given: n(d?.given) };
  }
}
