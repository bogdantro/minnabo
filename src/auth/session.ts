import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { unregisterPush } from '@/lib/notifications';
import { queryClientRef } from './queryClientRef';

export type SessionStatus = 'loading' | 'authed' | 'anon';

export type SessionState = {
  session: Session | null;
  userId: string | null;
  status: SessionStatus;
};

/**
 * The Supabase auth session, kept live via `onAuthStateChange`.
 * `status` is 'loading' until the first `getSession()` resolves.
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
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

  return useMemo(() => ({ session, userId: session?.user?.id ?? null, status }), [session, status]);
}

/** Sign out everywhere. */
export async function signOut(): Promise<void> {
  // while still signed in: this phone stops getting the account's push notifications –
  // but never hold the logout up for it (offline, slow network)
  await Promise.race([unregisterPush(), new Promise((resolve) => setTimeout(resolve, 1500))]);
  await supabase.auth.signOut();
  // nothing of the previous person may stay in memory or in the persisted cache
  queryClientRef.current?.clear();
}
