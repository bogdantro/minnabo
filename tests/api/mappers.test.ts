import {
  toAgreement,
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
    delivery: 'DELIVERED',
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
