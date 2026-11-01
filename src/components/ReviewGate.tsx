import { useEffect } from 'react';
import { router, usePathname } from 'expo-router';
import { useSession } from '@/auth/session';
import { usePendingReviews } from '@/api/queries';

/**
 * Screens that stay open while a review is owed: the review itself, getting help
 * (chat, Rapporter, Sikkerhet), the legal pages, deleting the account, and logging in.
 * Everything else sends the person to the review first.
 */
const ALLOWED = ['/vurder/', '/chat/', '/uteblitt/', '/rapporter', '/sikkerhet', '/personvern', '/vilkar', '/slett-konto', '/suspendert',
  '/logg-inn', '/velkommen', '/vipps', '/oppsett', '/samtykker'];

export const reviewGateAllows = (path: string) => ALLOWED.some((p) => path === p.replace(/\/$/, '') || path.startsWith(p));

/**
 * A finished job must be reviewed (0072): as long as one is owed, every other screen opens
 * the review instead (stars required, text optional). The real rule is in the database –
 * no new oppdrag, tilbud or accepting a tilbud – so an old app version can't skip it either.
 */
export function ReviewGate() {
  const { status } = useSession();
  const pathname = usePathname();
  const { data } = usePendingReviews(status === 'authed');
  const first = data?.[0];

  useEffect(() => {
    if (!first || reviewGateAllows(pathname)) return;
    router.replace(`/vurder/${first.proposalId}`);
  }, [first, pathname]);

  return null;
}
