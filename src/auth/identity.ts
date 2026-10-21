import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { apiClient } from '@/api/client';
import type { MyAccount } from '@/api/ApiClient';
import { supabase } from '@/lib/supabase';

/** What Vipps confirmed about the signed-in person. */
export type VippsIdentity = {
  name: string;
  firstName: string;
  initials: string;
  birthYear: number;
  age: number;
  /** "+47 ••• •• 234" – only the last digits are ever shown */
  phoneMasked: string;
  /** under 18 → youth account */
  youth: boolean;
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'N';

function toIdentity(a: MyAccount): VippsIdentity | null {
  // Only a missing Vipps link means "no identity". A missing name must not hide the rest –
  // above all the youth flag, which decides what the person may do.
  if (!a.vipps) return null;
  const name = a.fullName ?? '';
  return {
    name,
    firstName: name.split(' ')[0],
    initials: initialsOf(name),
    birthYear: a.birthYear ?? 0,
    age: a.age ?? 0,
    phoneMasked: a.phoneMasked ?? '',
    youth: a.youth,
  };
}

/** The signed-in user's id; null when nobody is signed in, undefined until that is known. */
function useSupabaseUserId(): string | null | undefined {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => active && setId(data.session?.user?.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s: Session | null) => setId(s?.user?.id ?? null));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return id;
}

/** What Vipps confirmed about the signed-in person (`my_account`, 0038). */
export function useMyAccount() {
  const userId = useSupabaseUserId();
  return useQuery({
    queryKey: ['my-account', userId],
    queryFn: () => apiClient.getMyAccount(),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

/**
 * The Vipps identity: name, birth year, masked phone and whether this is a youth
 * account. Null while the account is loading.
 */
export function useVippsIdentity(): VippsIdentity | null {
  const account = useMyAccount();
  return account.data ? toIdentity(account.data) : null;
}

/**
 * True once we know whether the signed-in account is a youth account. Not before the
 * session itself is known: "ready" with no answer yet sent youths to the adult tabs.
 */
export function useAccountReady(): boolean {
  const userId = useSupabaseUserId();
  const account = useMyAccount();
  if (userId === undefined) return false;
  return userId === null || !account.isPending;
}
