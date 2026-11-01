import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { profileKeys } from '@/api/queries';
import type { AppNotification } from '@/domain/types';

/** '/chat/c1?tab=tilbud' -> '/chat/c1' */
const pathOf = (route: string) => route.split('?')[0].replace(/\/+$/, '') || '/';

/**
 * Seeing a screen reads its notifications: a notification that points to the screen now
 * open is marked read, however the person got there (Innboks, a push, a link) – before,
 * only a tap on the notification itself did, so Varsler kept showing things already seen.
 * Re-runs when new notifications arrive, so one for the chat you are in is read at once.
 */
export function NotificationsReadOnVisit() {
  const pathname = usePathname();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: profileKeys.notifications,
    queryFn: () => apiClient.listNotifications(),
    staleTime: 15_000,
  });

  useEffect(() => {
    const here = pathOf(pathname);
    const seen = (data ?? []).filter((n) => !n.read && n.route && pathOf(n.route) === here);
    if (!seen.length) return;
    const ids = new Set(seen.map((n) => n.id));
    // the bell dot and Varsler update straight away; the server follows
    qc.setQueryData<AppNotification[]>(profileKeys.notifications, (old) =>
      old?.map((n) => (ids.has(n.id) ? { ...n, read: true } : n)),
    );
    void Promise.all(seen.map((n) => apiClient.markNotificationRead(n.id))).catch(() =>
      qc.invalidateQueries({ queryKey: profileKeys.notifications }),
    );
  }, [pathname, data, qc]);

  return null;
}
