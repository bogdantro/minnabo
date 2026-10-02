import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { mockVipps, useVippsIdentity } from './mockVipps';

export type SessionStatus = 'loading' | 'authed' | 'anon';

export type SessionState = {
  session: Session | null;
  userId: string | null;
  status: SessionStatus;
};

/**
 * The Supabase auth session, kept live via `onAuthStateChange`.
 * `status` is 'loading' until the first `getSession()` resolves.
 * A mock Vipps login (see `mockVipps.ts`) also counts as signed in.
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const vipps = useVippsIdentity();

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

  return useMemo(
    () => ({
      session,
      userId: session?.user?.id ?? null,
      status: vipps && status !== 'authed' ? 'authed' : status,
    }),
    [session, status, vipps],
  );
}

/** Sign out everywhere. */
export async function signOut(): Promise<void> {
  mockVipps.signOut();
  await supabase.auth.signOut();
}
