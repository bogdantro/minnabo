import { useSession } from '@/auth/session';
import { useProfile } from '@/api/queries';

export type CurrentUser = {
  /** empty string while the session is still loading */
  id: string;
  displayName: string;
  initials: string;
  avatarUrl?: string;
  onboardedAt?: string;
  isLoading: boolean;
};

/**
 * The signed-in user: id from the auth session, display fields from the
 * profile row (cached by React Query). Never returns null so screens that
 * read it synchronously keep working during the first paint.
 */
export function useCurrentUser(): CurrentUser {
  const { userId, status } = useSession();
  const { data, isLoading } = useProfile(userId ?? '');

  return {
    id: userId ?? '',
    displayName: data?.displayName ?? '',
    initials: data?.initials ?? 'N',
    avatarUrl: data?.avatarUrl,
    onboardedAt: data?.onboardedAt,
    isLoading: status === 'loading' || (!!userId && isLoading),
  };
}
