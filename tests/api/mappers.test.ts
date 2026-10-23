import {
  toAgreement,
  toConversation,
  toListing,
  toMessage,
  toNoticeboardPost,
  toNotification,
  toProfile,
  toProposal,
  toReview,
} from '@/api/mappers';

test('toProposal maps a snake_case row to a domain Proposal', () => {
  const p = toProposal({
    id: 'p1',
    listing_id: 'l1',
    conversation_id: 'c1',
    from_profile_id: 'a',
    to_profile_id: 'b',
    price_amount_minor: 60000,
    price_currency: 'NOK',
    message: 'hei',
    scheduled_text: null,
    caveats: null,
    status: 'SENT',
    created_at: '2026-08-01T10:00:00Z',
  });
  expect(p).toMatchObject({
    id: 'p1',
    listingId: 'l1',
    conversationId: 'c1',
    fromProfileId: 'a',
    toProfileId: 'b',
    price: { amountMinor: 60000, currency: 'NOK' },
    message: 'hei',
    status: 'SENT',
    createdAt: '2026-08-01T10:00:00Z',
  });
});

test('toProfile derives rating from the joined ratings view', () => {
  const prof = toProfile({
    id: 'u1',
    display_name: 'Emma Larsen',
    avatar_path: null,
    initials: 'EL',
    presentation: null,
    member_since: '2026',
    municipality: 'Lillehammer',
    place: 'Lillehammer',
    is_business: false,
    verifications: [{ kind: 'EMAIL', verified: true, explanation: 'ok' }],
    profile_ratings: { average: 4.5, count: 8 },
  });
  expect(prof).toMatchObject({
    id: 'u1',
    displayName: 'Emma Larsen',
    initials: 'EL',
    isBusiness: false,
    location: { place: 'Lillehammer', municipality: 'Lillehammer' },
    rating: { average: 4.5, count: 8 },
  });
  expect(prof.verifications[0]).toMatchObject({ kind: 'EMAIL', verified: true });
});

test('toProfile handles a missing ratings row', () => {
  const prof = toProfile({
    id: 'u2',
    display_name: 'Ny Nabo',
    avatar_path: null,
    initials: 'NN',
    presentation: null,
    member_since: '2026',
    municipality: null,
    place: null,
    is_business: false,
    verifications: [],
    profile_ratings: null,
  });
  expect(prof.rating).toBeUndefined();
});

test('toListing folds task_details / service_offer_details and images', () => {
  const l = toListing({
    id: 'l1',
    type: 'TASK_REQUEST',
    title: 'Klippe plen',
    category_slug: 'hage',
    price_amount_minor: 50000,
    price_currency: 'NOK',
    price_mode: 'BUDGET',
    municipality: 'Lillehammer',
    place: 'Lillehammer',
    status: 'PUBLISHED',
    created_at: '2026-08-01T09:00:00Z',
    owner: {
      id: 'u1',
      display_name: 'Emma',
      avatar_path: null,
      initials: 'E',
      presentation: null,
      member_since: '2026',
      municipality: 'Lillehammer',
      place: 'Lillehammer',
      is_business: false,
      verifications: [],
      profile_ratings: null,
    },
    task_details: { description: 'Stor hage', equipment: null, meeting_note: null, duration_text: null, scheduled_text: null },
    service_offer_details: null,
    listing_images: [{ id: 'im1', storage_path: 'https://img/1.jpg', ord: 0 }],
  });
  expect(l).toMatchObject({
    id: 'l1',
    type: 'TASK_REQUEST',
    title: 'Klippe plen',
    price: { amountMinor: 50000, currency: 'NOK' },
    priceMode: 'BUDGET',
    category: { slug: 'hage' },
    task: { description: 'Stor hage' },
  });
  expect(l.images).toEqual([{ id: 'im1', url: 'https://img/1.jpg' }]);
  expect(l.owner.displayName).toBe('Emma');
});

test('toMessage maps kind + attachment', () => {
  const m = toMessage({
    id: 'm1',
    conversation_id: 'c1',
    author_id: 'u1',
    kind: 'IMAGE',
    text: '',
    proposal_id: null,
    attachment_path: 'https://img/a.jpg',
    created_at: '2026-08-01T10:00:00Z',
  });
  expect(m).toMatchObject({
    id: 'm1',
    conversationId: 'c1',
    authorProfileId: 'u1',
    kind: 'IMAGE',
    attachmentUrl: 'https://img/a.jpg',
    delivery: 'SENT', // stored on the server; Levert / Lest come from the receipts
  });
});

it('maps municipality onto a noticeboard post', () => {
  const post = toNoticeboardPost({
    id: 'n1',
    kind: 'GENERAL',
    title: 't',
    body: 'b',
    author_id: 'a',
    place: 'Brumunddal',
    municipality: 'Ringsaker',
    created_at: '2026-09-05T00:00:00Z',
  });
  expect(post.municipality).toBe('Ringsaker');
});

test('toAgreement + toReview + toNotification', () => {
  expect(
    toAgreement({
      proposal_id: 'p1',
      listing_id: 'l1',
      price_amount_minor: 60000,
      price_currency: 'NOK',
      scheduled_text: 'I morgen',
      description: 'Klippe plen',
      caveats: null,
      agreed_at: '2026-08-02T10:00:00Z',
    }),
  ).toMatchObject({ proposalId: 'p1', price: { amountMinor: 60000 }, agreedAt: '2026-08-02T10:00:00Z' });

  expect(
    toReview({
      id: 'r1',
      agreement_proposal_id: 'p1',
      listing_id: 'l1',
      from_profile_id: 'a',
      to_profile_id: 'b',
      rating: 5,
      comment: 'Topp',
      created_at: '2026-08-03T10:00:00Z',
    }),
  ).toMatchObject({ id: 'r1', agreementProposalId: 'p1', rating: 5, comment: 'Topp' });

  expect(
    toNotification({
      id: 'n1',
      kind: 'NEW_OFFER',
      title: 'Nytt tilbud',
      body: 'Du har fått et tilbud',
      route: '/tilbud/p1',
      read: false,
      created_at: '2026-08-03T10:00:00Z',
    }),
  ).toMatchObject({ id: 'n1', kind: 'NEW_OFFER', read: false, route: '/tilbud/p1' });
});

// --- Innboks: my own message must not make the conversation unread ---------
const convRow = (over: Record<string, unknown> = {}) =>
  ({
    id: 'c1',
    listing: { id: 'l1', title: 'Klippe plen', type: 'TASK_REQUEST', place: 'Nordre Ål' },
    last_message_preview: 'Hei',
    last_message_at: '2026-10-05T12:00:00Z',
    conversation_participants: [],
    message_reads: [{ profile_id: 'me', last_read_at: '2026-10-05T11:00:00Z' }],
    proposals: [],
    ...over,
  }) as never;

test('a conversation whose last message I wrote is not unread and is marked as mine', () => {
  const c = toConversation(convRow({ messages: [{ author_id: 'me', kind: 'TEXT', created_at: '2026-10-05T12:00:00Z' }] }), 'me');
  expect(c.unread).toBe(false);
  expect(c.lastMessageMine).toBe(true);
});

test('a newer message from the other person is unread', () => {
  const c = toConversation(convRow({ messages: [{ author_id: 'other', kind: 'TEXT', created_at: '2026-10-05T12:00:00Z' }] }), 'me');
  expect(c.unread).toBe(true);
  expect(c.lastMessageMine).toBe(false);
});

test('the read time on the participant row counts too (0007 wrote it there)', () => {
  const c = toConversation(
    convRow({
      message_reads: [],
      conversation_participants: [{ profile_id: 'me', last_read_at: '2026-10-05T12:30:00Z', profile: { id: 'me', display_name: 'Meg', avatar_path: null, initials: 'M', presentation: null, member_since: '2026', municipality: null, place: null, is_business: false } }],
      messages: [{ author_id: 'other', kind: 'TEXT', created_at: '2026-10-05T12:00:00Z' }],
    }),
    'me',
  );
  expect(c.unread).toBe(false);
});

test('the preview and time come from the real last message, not a stale conversation row', () => {
  const c = toConversation(
    convRow({
      last_message_preview: 'Gammel melding',
      last_message_at: '2026-10-05T10:00:00Z',
      messages: [{ author_id: 'other', kind: 'TEXT', text: 'Ny melding', created_at: '2026-10-05T12:00:00Z' }],
    }),
    'me',
  );
  expect(c.lastMessagePreview).toBe('Ny melding');
  expect(c.lastMessageAt).toBe('2026-10-05T12:00:00Z');
  expect(c.unread).toBe(true);
});

test('an image or a tilbud as the last message gets a readable preview', () => {
  const img = toConversation(convRow({ messages: [{ author_id: 'other', kind: 'IMAGE', text: '', created_at: '2026-10-05T12:00:00Z' }] }), 'me');
  expect(img.lastMessagePreview).toBe('📷 Bilde');
  const offer = toConversation(convRow({ messages: [{ author_id: 'me', kind: 'PROPOSAL', text: '', created_at: '2026-10-05T12:00:00Z' }] }), 'me');
  // mine reads "Du sendte et tilbud" – and gets no extra "Du: " in front
  expect(offer.lastMessagePreview).toBe('Du sendte et tilbud');
  expect(offer.lastMessageMine).toBe(false);
  const theirs = toConversation(convRow({ messages: [{ author_id: 'other', kind: 'PROPOSAL', text: '', created_at: '2026-10-05T12:00:00Z' }] }), 'me');
  expect(theirs.lastMessagePreview).toBe('Sendte et tilbud');
});

// --- chat read receipts ------------------------------------------------------
test('my messages are "Lest" up to the other person\'s read time, "Levert" after it', () => {
  const { withReadState } = require('@/api/mappers');
  const msg = (id: string, author: string, at: string) =>
    ({ id, conversationId: 'c1', authorProfileId: author, text: 'x', kind: 'TEXT', createdAt: at, delivery: 'DELIVERED' }) as never;
  const out = withReadState(
    [msg('a', 'me', '2026-10-06T10:00:00Z'), msg('b', 'other', '2026-10-06T10:01:00Z'), msg('c', 'me', '2026-10-06T10:05:00Z')],
    'me',
    '2026-10-06T10:02:00Z',
  );
  expect(out.map((m: { delivery: string }) => m.delivery)).toEqual(['READ', 'DELIVERED', 'DELIVERED']);
  // never read by the other person → nothing is "Lest"
  expect(withReadState([msg('a', 'me', '2026-10-06T10:00:00Z')], 'me', null)[0].delivery).toBe('DELIVERED');
});

test('"Sendt" → "Levert" → "Lest" on my messages', () => {
  const { withReadState } = require('@/api/mappers');
  const msg = (id: string, at: string) =>
    ({ id, conversationId: 'c1', authorProfileId: 'me', text: 'x', kind: 'TEXT', createdAt: at, delivery: 'SENT' }) as never;
  const out = withReadState(
    [msg('a', '2026-10-06T10:00:00Z'), msg('b', '2026-10-06T10:05:00Z'), msg('c', '2026-10-06T10:10:00Z')],
    'me',
    '2026-10-06T10:01:00Z', // read up to here
    '2026-10-06T10:06:00Z', // their app has fetched up to here
  );
  expect(out.map((m: { delivery: string }) => m.delivery)).toEqual(['READ', 'DELIVERED', 'SENT']);
});

// --- Innboks: receipt on my last message ------------------------------------
test('Innboks knows whether my last message is sent, delivered or read', () => {
  const me = { id: 'me', display_name: 'Meg', avatar_path: null, initials: 'M', presentation: null, member_since: '2026', municipality: null, place: null, is_business: false };
  const other = { ...me, id: 'other', display_name: 'Kari' };
  const row = (o: { last_read_at?: string; last_delivered_at?: string }, author = 'me') =>
    convRow({
      message_reads: [],
      conversation_participants: [
        { profile_id: 'me', last_read_at: '2026-10-05T12:00:00Z', profile: me },
        { profile_id: 'other', last_read_at: '1970-01-01T00:00:00Z', ...o, profile: other },
      ],
      messages: [{ author_id: author, kind: 'TEXT', text: 'Hei', created_at: '2026-10-05T12:00:00Z' }],
    });
  expect(toConversation(row({}), 'me').lastMessageDelivery).toBe('SENT');
  expect(toConversation(row({ last_delivered_at: '2026-10-05T12:01:00Z' }), 'me').lastMessageDelivery).toBe('DELIVERED');
  expect(toConversation(row({ last_read_at: '2026-10-05T12:02:00Z' }), 'me').lastMessageDelivery).toBe('READ');
  // their message last → no receipt to show
  expect(toConversation(row({ last_read_at: '2026-10-05T12:02:00Z' }, 'other'), 'me').lastMessageDelivery).toBeUndefined();
});

test('partner prices come through as name + price, and a broken list is ignored', () => {
  const { toPartner } = require('@/api/mappers');
  const base = { id: 'p1', name: 'Frisør', blurb: '', url: null, logo_path: null, municipality: null, partner_placements: [] };
  expect(toPartner({ ...base, prices: [{ name: 'Klipp', price: '450 kr' }, { name: '', price: 'x' }, 'tull'] }).prices).toEqual([
    { name: 'Klipp', price: '450 kr' },
  ]);
  expect(toPartner({ ...base, prices: null }).prices).toEqual([]);
});
