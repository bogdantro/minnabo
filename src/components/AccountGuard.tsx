import { useEffect } from 'react';
import { router } from 'expo-router';
import { useSession, signOut } from '@/auth/session';
import { useMyAccountStatus } from '@/api/queries';

/**
 * Signs a suspended account out and shows /suspendert. The backend already
 * bans the auth user (no new logins, no token refresh – 0034); this covers the
 * access token that is still valid for up to an hour.
 */
export function AccountGuard() {
  const { status } = useSession();
  const active = status === 'authed';
  const q = useMyAccountStatus(active);
  const suspended = !!q.data?.suspended;

  useEffect(() => {
    if (!suspended) return;
    void signOut().finally(() => router.replace('/suspendert'));
  }, [suspended]);

  return null;
}
