import { chatRepository } from '@/data/chatRepository';

beforeEach(() => chatRepository._reset());

test('accepting a proposal creates an agreement and a system message', () => {
  const before = chatRepository.getMessages('c-emma').length;

  const { proposal, agreement } = chatRepository.respondToProposal(
    'p-emma-klippe',
    'ACCEPT',
    'RECIPIENT',
  );

  expect(proposal.status).toBe('ACCEPTED');
  expect(agreement).toBeDefined();
  expect(agreement?.price.amountMinor).toBe(60000);

  const after = chatRepository.getMessages('c-emma');
  expect(after.length).toBe(before + 1);
  expect(after[after.length - 1]).toMatchObject({ kind: 'SYSTEM', text: 'Tilbud godtatt' });

  expect(chatRepository.getConversation('c-emma')?.statusTag).toBe('OFFER_ACCEPTED');
  expect(chatRepository.getAgreementForConversation('c-emma')?.proposalId).toBe('p-emma-klippe');
});

test('the proposer cannot accept their own proposal', () => {
  expect(() =>
    chatRepository.respondToProposal('p-emma-klippe', 'ACCEPT', 'PROPOSER'),
  ).toThrow('Ugyldig endring av tilbudet.');
});

test('sending a message updates the conversation preview', () => {
  chatRepository.sendMessage('c-sara', 'Ja, jeg har verktøy.');
  expect(chatRepository.getConversation('c-sara')?.lastMessagePreview).toBe(
    'Ja, jeg har verktøy.',
  );
});

test('unread filter only returns unread conversations', () => {
  const unread = chatRepository.listConversations({ unreadOnly: true });
  expect(unread.every((c) => c.unread)).toBe(true);
  expect(unread.length).toBeGreaterThan(0);
});

test('toggleReaction adds and removes the current user reaction', () => {
  const msg = chatRepository.getMessages('c-emma')[0];

  let after = chatRepository.toggleReaction('c-emma', msg.id, '👍');
  expect(after.find((m) => m.id === msg.id)?.reactions?.['👍']).toEqual([
    chatRepository.currentUserId,
  ]);

  after = chatRepository.toggleReaction('c-emma', msg.id, '👍');
  expect(after.find((m) => m.id === msg.id)?.reactions).toBeUndefined();
});

test('setPinnedMessage keeps only one pin per conversation', () => {
  const [a, b] = chatRepository.getMessages('c-emma');

  chatRepository.setPinnedMessage('c-emma', a.id);
  expect(chatRepository.getMessages('c-emma').filter((m) => m.pinned).map((m) => m.id)).toEqual([
    a.id,
  ]);

  chatRepository.setPinnedMessage('c-emma', b.id);
  expect(chatRepository.getMessages('c-emma').filter((m) => m.pinned).map((m) => m.id)).toEqual([
    b.id,
  ]);

  chatRepository.setPinnedMessage('c-emma', null);
  expect(chatRepository.getMessages('c-emma').some((m) => m.pinned)).toBe(false);
});

test('opening a thread marks its messages read', () => {
  chatRepository.sendMessage('c-sara', 'Hei!');
  expect(chatRepository.getMessages('c-sara').some((m) => m.delivery !== 'READ' && m.kind !== 'SYSTEM')).toBe(true);

  chatRepository.markRead('c-sara');

  expect(
    chatRepository.getMessages('c-sara').every((m) => m.kind === 'SYSTEM' || m.delivery === 'READ'),
  ).toBe(true);
  expect(chatRepository.getConversation('c-sara')?.unread).toBe(false);
});

test('no payment wording is present in seeded chat data', () => {
  const allText = chatRepository
    .listConversations()
    .flatMap((c) => chatRepository.getMessages(c.id))
    .map((m) => m.text)
    .join(' ');
  expect(allText).not.toMatch(/Vipps|Betal nå/i);
});
