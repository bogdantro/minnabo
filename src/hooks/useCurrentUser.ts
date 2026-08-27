import { profiles } from '@/data/seed';

export type CurrentUser = {
  id: string;
  displayName: string;
  initials: string;
  avatarUrl?: string;
};

/**
 * The signed-in user. Mocked for now — real auth arrives in a later phase.
 * Matches the avatar shown top-right in every mockup.
 */
export function useCurrentUser(): CurrentUser {
  const me = profiles.mb;
  return {
    id: me.id,
    displayName: me.displayName,
    initials: me.initials,
    avatarUrl: me.avatarUrl,
  };
}
