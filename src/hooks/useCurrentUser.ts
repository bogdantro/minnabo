import { useMemo } from 'react';
import { useSession } from '@/auth/session';
import { useProfile } from '@/api/queries';
import { useAccountReady, useVippsIdentity } from '@/auth/identity';

export type CurrentUser = {
  /** empty string while the session is still loading */
  id: string;
  displayName: string;
  initials: string;
  avatarUrl?: string;
  place?: string;
  municipality?: string;
  onboardedAt?: string;
  isAdmin: boolean;
  isLoading: boolean;
  /** under-18 youth account (from the Vipps birth date; enforced on the backend) */
  isYouth: boolean;
  /** false while we don't yet know whether this is a youth account */
  accountReady: boolean;
};

/**
 * The signed-in user: id from the auth session, display fields from the
 * profile row (cached by React Query). Never returns null so screens that
 * read it synchronously keep working during the first paint.
 */
export function useCurrentUser(): CurrentUser {
  const { userId, status } = useSession();
  const { data, isLoading } = useProfile(userId ?? '');
  const vipps = useVippsIdentity();
  const accountReady = useAccountReady();

  return useMemo(
    () => ({
      id: userId ?? '',
      displayName: data?.displayName || vipps?.name || '',
      initials: data?.initials || vipps?.initials || 'N',
      avatarUrl: data?.avatarUrl,
      place: data?.location.place,
      municipality: data?.location.municipality,
      onboardedAt: data?.onboardedAt,
      isAdmin: data?.role === 'admin',
      isYouth: !!vipps?.youth,
      accountReady,
      isLoading: status === 'loading' || (!!userId && isLoading),
    }),
    [
      userId,
      status,
      isLoading,
      data?.displayName,
      data?.initials,
      data?.avatarUrl,
      data?.location.place,
      data?.location.municipality,
      data?.onboardedAt,
      data?.role,
      vipps,
      accountReady,
    ],
  );
}
