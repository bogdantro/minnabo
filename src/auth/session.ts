import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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

  return { session, userId: session?.user?.id ?? null, status };
}

/** Sign out everywhere. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
