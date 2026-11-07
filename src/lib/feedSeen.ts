import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = (feed: string) => `minnabo.feedSeen.${feed}.v1`;

/**
 * «Nytt siden sist»: when this feed was last seen. Read once when the screen opens, so the line
 * stays put while scrolling; the new time is stored right away, so the next visit starts from now.
 * On the phone only: it is a reading position, not something to sync.
 */
export function useFeedSeen(feed: string): number | null {
  const [since, setSince] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY(feed))
      .then((raw) => {
        const n = raw ? Number(raw) : NaN;
        if (live && Number.isFinite(n)) setSince(n);
      })
      .catch(() => undefined)
      .finally(() => AsyncStorage.setItem(KEY(feed), String(Date.now())).catch(() => undefined));
    return () => {
      live = false;
    };
  }, [feed]);
  return since;
}

/**
 * Where the line goes: before the first post older than `since`. Hasteoppdrag sit on top whatever
 * their age, so they are skipped. None when nothing is new, or when everything is (a first visit,
 * or a long time away): then there is nothing to separate.
 */
export function newSinceIndex(listings: { createdAt: string; urgentUntil?: string }[], since: number | null, now: number): number {
  if (since == null) return -1;
  const urgent = (l: { urgentUntil?: string }) => !!l.urgentUntil && Date.parse(l.urgentUntil) > now;
  const firstNormal = listings.findIndex((l) => !urgent(l));
  if (firstNormal < 0) return -1;
  const i = listings.findIndex((l, n) => n >= firstNormal && Date.parse(l.createdAt) <= since);
  return i > firstNormal ? i : -1;
}
