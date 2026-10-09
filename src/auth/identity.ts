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
  if (!a.vipps || !a.fullName) return null;
  return {
    name: a.fullName,
    firstName: a.fullName.split(' ')[0],
    initials: initialsOf(a.fullName),
    birthYear: a.birthYear ?? 0,
    age: a.age ?? 0,
    phoneMasked: a.phoneMasked ?? '',
    youth: a.youth,
  };
}

function useSupabaseUserId(): string | null {
  const [id, setId] = useState<string | null>(null);
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

/** True once we know whether the signed-in account is a youth account. */
export function useAccountReady(): boolean {
  const userId = useSupabaseUserId();
  const account = useMyAccount();
  return !userId || !account.isLoading;
}
