/**
 * Keeps the «Nye oppdrag» home screen widget up to date (asked 2026-11-09). The widget can't fetch by itself:
 * every time the Oppdrag feed loads, its newest open oppdrag in the kommune are written to the widget.
 * Nothing on the web, and any failure (an older build without the widget) is ignored.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { Listing } from '@/domain/types';
import nb from '@/i18n/nb';
import { listingPrice } from '@/components/OppdragCard';
import type { NewOppdragWidgetProps } from '@/widgets/types';

/** «Nye» means posted within this many days. */
const NEW_DAYS = 7;
const MAX_ITEMS = 5;
const OPEN: Listing['status'][] = ['PUBLISHED', 'RECEIVING_OFFERS'];

/** The widget's content, from the feed. Pure, so it can be tested. */
export function widgetProps(listings: Listing[], kommune: string | undefined, meId: string, now = Date.now()): NewOppdragWidgetProps {
  const open = listings.filter((l) => l.type === 'TASK_REQUEST' && l.owner.id !== meId && OPEN.includes(l.status));
  const fresh = open.filter((l) => now - Date.parse(l.createdAt) <= NEW_DAYS * 86_400_000).length;
  return {
    heading: kommune ? nb.widget.heading(kommune) : nb.widget.headingNoKommune,
    sub: nb.widget.sub(fresh),
    empty: nb.widget.empty,
    items: open.slice(0, MAX_ITEMS).map((l) => ({
      title: l.title,
      line: [l.location.place || l.location.municipality, listingPrice(l).value].filter(Boolean).join(' · '),
    })),
  };
}

/** Is the widget module in this build? Asked once; Expo Go and older builds don't have it. */
let widgetModule: boolean | null = null;
const hasWidget = () => (widgetModule ??= !!requireOptionalNativeModule('ExpoWidgets'));

export function useNewOppdragWidget(listings: Listing[] | undefined, kommune: string | undefined, meId: string) {
  useEffect(() => {
    if (Platform.OS === 'web' || !listings || !meId || !hasWidget()) return;
    try {
      // loaded here, not at the top: a build without the widget module (an older build that gets this code
      // as an update) would otherwise crash on start
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const widget = (require('@/widgets/NewOppdragWidget') as typeof import('@/widgets/NewOppdragWidget')).default;
      widget.updateSnapshot(widgetProps(listings, kommune, meId));
    } catch {
      // no widget in this build (Expo Go, an older build): nothing to update, and nothing worth reporting
    }
  }, [listings, kommune, meId]);
}
