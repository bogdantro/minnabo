import { isShake } from '@/lib/shake';
import { quickReplyOf, REPLY_ACTION } from '@/components/PushBridge';
import { widgetProps } from '@/lib/widgetSync';
import { firstLink } from '@/components/chat/MessageExtras';
import type { Listing } from '@/domain/types';

// ------------------------------------------------------------
// Shake to report: only a few hard jolts close together count
// ------------------------------------------------------------
test('three jolts within a second is a shake', () => {
  expect(isShake([1000, 1300, 1700], 1700)).toBe(true);
});

test('jolts spread out (walking, putting the phone down) are not a shake', () => {
  expect(isShake([0, 1200, 2400], 2400)).toBe(false);
  expect(isShake([1000, 1300], 1300)).toBe(false);
});

// ------------------------------------------------------------
// «Svar» from a chat push
// ------------------------------------------------------------
test('a reply typed in a notification is sent to that conversation', () => {
  expect(quickReplyOf(REPLY_ACTION, '  Jeg kommer kl. 10 ', { conversationId: 'c1', route: '/chat/c1' })).toEqual({
    conversationId: 'c1',
    text: 'Jeg kommer kl. 10',
    route: '/chat/c1',
  });
});

test('a plain tap, an empty reply or a push without a conversation is not a reply', () => {
  expect(quickReplyOf('expo.modules.notifications.actions.DEFAULT', 'Hei', { conversationId: 'c1' })).toBeNull();
  expect(quickReplyOf(REPLY_ACTION, '   ', { conversationId: 'c1' })).toBeNull();
  expect(quickReplyOf(REPLY_ACTION, 'Hei', { route: '/varsler' })).toBeNull();
});

// ------------------------------------------------------------
// Home screen widget
// ------------------------------------------------------------
const listing = (over: Partial<Listing>): Listing =>
  ({
    id: 'l1',
    type: 'TASK_REQUEST',
    title: 'Klippe plen',
    status: 'PUBLISHED',
    priceMode: 'FIXED',
    price: { amount: 400, currency: 'NOK' },
    createdAt: new Date().toISOString(),
    owner: { id: 'u-other' },
    location: { municipality: 'Lillehammer', place: 'Nordre Ål' },
    images: [],
    category: { slug: 'hage' },
    ...over,
  }) as unknown as Listing;

test('the widget shows open oppdrag from others, with place and price but never an address', () => {
  const props = widgetProps(
    [listing({}), listing({ id: 'mine', owner: { id: 'me' } as Listing['owner'] }), listing({ id: 'taken', status: 'OFFER_ACCEPTED' })],
    'Lillehammer',
    'me',
  );
  expect(props.heading).toBe('Nye oppdrag i Lillehammer');
  expect(props.sub).toBe('1 ny siste uka');
  expect(props.items).toHaveLength(1);
  expect(props.items[0].title).toBe('Klippe plen');
  expect(props.items[0].line).toContain('Nordre Ål');
});

test('old oppdrag are listed but not counted as new', () => {
  const old = listing({ createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString() });
  const props = widgetProps([old], 'Lillehammer', 'me');
  expect(props.sub).toBe('Ingen nye siste uka');
  expect(props.items).toHaveLength(1);
});

// ------------------------------------------------------------
// Link previews
// ------------------------------------------------------------
test('the first link in a message gets the preview, a phone number does not', () => {
  expect(firstLink('Se her: https://www.yr.no/nb og www.finn.no')).toBe('https://www.yr.no/nb');
  expect(firstLink('Ring meg på 912 34 567')).toBeNull();
});
