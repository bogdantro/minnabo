/**
 * Query hooks for the Fellesskap features of migration 0108 (see communityApi.ts).
 * Kept apart from queries.ts so each part stays a size you can read.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BuddyProgram, BuddyRole, ProjectInput } from '@/domain/community';
import { apiClient } from './client';

export const fellesKeys = {
  joiners: (listingId: string) => ['shared-joiners', listingId] as const,
  metoo: (noticeId: string) => ['notice-metoo', noticeId] as const,
  commentLikes: (noticeId: string) => ['comment-likes', noticeId] as const,
  nabolag: (id: string) => ['nabolag-details', id] as const,
  waves: ['neighbour-waves'] as const,
  organisations: (kommune: string) => ['organisations', kommune] as const,
  support: (kommune: string) => ['support-votes', kommune] as const,
  followedPartners: ['followed-partners'] as const,
  partnerQuestions: (partnerId: string) => ['partner-questions', partnerId] as const,
  availableToday: (kommune: string) => ['available-today', kommune] as const,
  buddies: ['buddy-signups'] as const,
  eventItems: (noticeId: string) => ['event-items', noticeId] as const,
  eventPhotos: (noticeId: string) => ['event-photos', noticeId] as const,
  projects: (kommune: string) => ['projects', kommune] as const,
  projectSupport: (id: string) => ['project-support', id] as const,
  areaPhotos: (kommune: string) => ['area-photos', kommune] as const,
  badges: (profileId: string) => ['community-badges', profileId] as const,
  summary: (kommune: string) => ['community-summary', kommune] as const,
  year: ['community-year'] as const,
};

/** A mutation that refreshes the given keys afterwards, whatever happened. */
function useRefreshing<A, R>(fn: (a: A) => Promise<R>, keys: readonly (readonly unknown[])[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [...k] }))),
  });
}

// --- shared helper for one street ---
export function useSharedJoiners(listingId: string, enabled = true) {
  return useQuery({ queryKey: fellesKeys.joiners(listingId), queryFn: () => apiClient.sharedListingJoiners(listingId), enabled: enabled && !!listingId });
}
export function useJoinShared(listingId: string) {
  return useRefreshing(({ join, note }: { join: boolean; note?: string }) => apiClient.joinSharedListing(listingId, join, note), [fellesKeys.joiners(listingId)]);
}

// --- oppslag topics ---
export function useNoticeMetoo(noticeId: string, enabled = true) {
  return useQuery({ queryKey: fellesKeys.metoo(noticeId), queryFn: () => apiClient.noticeMetoo(noticeId), enabled: enabled && !!noticeId });
}
export function useSetMetoo(noticeId: string) {
  return useRefreshing((on: boolean) => apiClient.setNoticeMetoo(noticeId, on), [fellesKeys.metoo(noticeId)]);
}
export function useCommentLikes(noticeId: string, enabled = true) {
  return useQuery({ queryKey: fellesKeys.commentLikes(noticeId), queryFn: () => apiClient.noticeCommentLikes(noticeId), enabled: enabled && !!noticeId });
}
export function useToggleCommentLike(noticeId: string) {
  return useRefreshing((commentId: string) => apiClient.toggleCommentLike(commentId), [fellesKeys.commentLikes(noticeId)]);
}

// --- nabolag ---
export function useNabolagDetails(id: string | undefined) {
  return useQuery({ queryKey: fellesKeys.nabolag(id ?? ''), queryFn: () => apiClient.nabolagDetails(id!), enabled: !!id });
}
export function useSetNabolagRules(id: string) {
  return useRefreshing((rules: string) => apiClient.setNabolagRules(id, rules), [fellesKeys.nabolag(id)]);
}
export function useSetNabolagIntro(id: string) {
  return useRefreshing(({ intro, showAsNew }: { intro: string; showAsNew: boolean }) => apiClient.setNabolagIntro(id, intro, showAsNew), [fellesKeys.nabolag(id)]);
}
export function useMyWaves() {
  return useQuery({ queryKey: fellesKeys.waves, queryFn: () => apiClient.myWaves() });
}
export function useWave() {
  return useRefreshing(({ nabolagId, profileId }: { nabolagId: string; profileId: string }) => apiClient.waveNeighbour(nabolagId, profileId), [fellesKeys.waves]);
}
export function usePinNotice() {
  return useRefreshing(({ noticeId, pin }: { noticeId: string; pin: boolean }) => apiClient.pinNotice(noticeId, pin), [['noticeboard']]);
}

// --- lag og foreninger, support ---
export function useOrganisations(kommune: string) {
  return useQuery({ queryKey: fellesKeys.organisations(kommune), queryFn: () => apiClient.listOrganisations(kommune), enabled: !!kommune });
}
export function useMyOrganisations(enabled = true) {
  return useQuery({ queryKey: ['my-organisations'], queryFn: () => apiClient.myOrganisations(), enabled });
}
export function useSupportVotes(kommune: string) {
  return useQuery({ queryKey: fellesKeys.support(kommune), queryFn: () => apiClient.supportVoteState(kommune), enabled: !!kommune });
}
export function useVoteSupport(kommune: string) {
  return useRefreshing((orgId: string) => apiClient.voteSupport(orgId), [fellesKeys.support(kommune)]);
}

// --- partners ---
export function useFollowedPartners() {
  return useQuery({ queryKey: fellesKeys.followedPartners, queryFn: () => apiClient.listFollowedPartnerIds() });
}
export function useToggleFollowPartner() {
  return useRefreshing((partnerId: string) => apiClient.toggleFollowPartner(partnerId), [fellesKeys.followedPartners]);
}
export function usePartnerQuestions(partnerId: string) {
  return useQuery({ queryKey: fellesKeys.partnerQuestions(partnerId), queryFn: () => apiClient.listPartnerQuestions(partnerId), enabled: !!partnerId });
}
export function useAskPartner(partnerId: string) {
  return useRefreshing((body: string) => apiClient.askPartner(partnerId, body), [fellesKeys.partnerQuestions(partnerId)]);
}
export function useTipBusiness() {
  return useMutation({ mutationFn: (input: { name: string; why: string; municipality: string }) => apiClient.tipBusiness(input) });
}

// --- helping today, buddies ---
export function useAvailableToday(kommune: string) {
  return useQuery({ queryKey: fellesKeys.availableToday(kommune), queryFn: () => apiClient.helpersAvailableToday(kommune), enabled: !!kommune });
}
export function useSetAvailableToday(kommune: string) {
  return useRefreshing((on: boolean) => apiClient.setAvailableToday(on), [fellesKeys.availableToday(kommune)]);
}
export function useBuddySignups() {
  return useQuery({ queryKey: fellesKeys.buddies, queryFn: () => apiClient.myBuddySignups() });
}
export function useBuddySignup() {
  return useRefreshing(
    ({ program, role, note }: { program: BuddyProgram; role: BuddyRole; note: string }) => apiClient.buddySignup(program, role, note),
    [fellesKeys.buddies],
  );
}
export function useLeaveBuddy() {
  return useRefreshing((program: BuddyProgram) => apiClient.leaveBuddy(program), [fellesKeys.buddies]);
}

// --- arrangementer ---
export function useEventItems(noticeId: string, enabled = true) {
  return useQuery({ queryKey: fellesKeys.eventItems(noticeId), queryFn: () => apiClient.eventItems(noticeId), enabled: enabled && !!noticeId });
}
export function useEventItemActions(noticeId: string) {
  const keys = [fellesKeys.eventItems(noticeId)];
  return {
    add: useRefreshing(({ label, needed }: { label: string; needed?: number }) => apiClient.addEventItem(noticeId, label, needed), keys),
    remove: useRefreshing((itemId: string) => apiClient.removeEventItem(itemId), keys),
    take: useRefreshing(({ itemId, take }: { itemId: string; take: boolean }) => apiClient.takeEventItem(itemId, take), keys),
  };
}
export function useEventPhotos(noticeId: string, enabled = true) {
  return useQuery({ queryKey: fellesKeys.eventPhotos(noticeId), queryFn: () => apiClient.eventPhotos(noticeId), enabled: enabled && !!noticeId });
}
export function useEventPhotoActions(noticeId: string) {
  const keys = [fellesKeys.eventPhotos(noticeId)];
  return {
    add: useRefreshing((path: string) => apiClient.addEventPhoto(noticeId, path), keys),
    remove: useRefreshing((photoId: string) => apiClient.removeEventPhoto(photoId), keys),
  };
}

// --- projects ---
export function useProjects(kommune: string) {
  return useQuery({ queryKey: fellesKeys.projects(kommune), queryFn: () => apiClient.listProjects(kommune), enabled: !!kommune });
}
export function useSaveProject(kommune: string) {
  return useRefreshing((input: ProjectInput) => apiClient.saveProject(input), [fellesKeys.projects(kommune)]);
}
export function useDeleteProject(kommune: string) {
  return useRefreshing((id: string) => apiClient.deleteProject(id), [fellesKeys.projects(kommune)]);
}
export function useProjectSupport(id: string) {
  return useQuery({ queryKey: fellesKeys.projectSupport(id), queryFn: () => apiClient.projectSupport(id), enabled: !!id });
}
export function useSupportProject(id: string) {
  return useRefreshing(({ on, showName }: { on: boolean; showName?: boolean }) => apiClient.supportProject(id, on, showName), [fellesKeys.projectSupport(id)]);
}

// --- «Ukas bilde» ---
export function useAreaPhotos(kommune: string) {
  return useQuery({ queryKey: fellesKeys.areaPhotos(kommune), queryFn: () => apiClient.areaPhotosWeek(kommune), enabled: !!kommune });
}
export function useAddAreaPhoto(kommune: string) {
  return useRefreshing(({ path, caption }: { path: string; caption: string }) => apiClient.addAreaPhoto(kommune, path, caption), [fellesKeys.areaPhotos(kommune)]);
}
export function useLikeAreaPhoto(kommune: string) {
  return useRefreshing((id: string) => apiClient.toggleAreaPhotoLike(id), [fellesKeys.areaPhotos(kommune)]);
}

// --- summaries ---
export function useCommunityBadges(profileId: string) {
  return useQuery({ queryKey: fellesKeys.badges(profileId), queryFn: () => apiClient.communityBadges(profileId), enabled: !!profileId });
}
export function useCommunitySummary(kommune: string) {
  return useQuery({ queryKey: fellesKeys.summary(kommune), queryFn: () => apiClient.communitySummary(kommune), enabled: !!kommune });
}
export function useCommunityYear() {
  return useQuery({ queryKey: fellesKeys.year, queryFn: () => apiClient.myCommunityYear() });
}
