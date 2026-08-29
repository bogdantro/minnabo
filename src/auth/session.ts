import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { ENV } from '@/lib/env';

export type SessionStatus = 'loading' | 'authed' | 'anon';

export type SessionState = {
  session: Session | null;
  userId: string | null;
  status: SessionStatus;
};

/** Mock mode: always "signed in" as the seeded demo user, no login screen. */
const MOCK_USER_ID = 'u-mb';

/**
 * The Supabase auth session, kept live via `onAuthStateChange`.
 * `status` is 'loading' until the first `getSession()` resolves.
 * In mock mode it is immediately 'authed' as the demo user.
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(
    ENV.useMocks ? ({ user: { id: MOCK_USER_ID } } as Session) : null,
  );
  const [status, setStatus] = useState<SessionStatus>(ENV.useMocks ? 'authed' : 'loading');

  useEffect(() => {
    if (ENV.useMocks) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? 'authed' : 'anon');
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'authed' : 'anon');
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return useMemo(
    () => ({ session, userId: session?.user?.id ?? null, status }),
    [session, status],
  );
}

/** Sign out everywhere. */
export async function signOut(): Promise<void> {
  if (ENV.useMocks) return;
  await supabase.auth.signOut();
}
