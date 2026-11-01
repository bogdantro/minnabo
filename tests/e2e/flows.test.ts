import { apiClient } from '@/api/client';
import { chatRepository } from '@mocks/data/chatRepository';
import { profileRepository } from '@mocks/data/profileRepository';
import { repositories } from '@mocks/data/repositories';

const ME = profileRepository.currentUserId;

/**
 * Spec §26 E2E flow 1:
 * Find oppdrag -> gi tilbud -> chat -> godta -> fullfør -> vurder.
 */
test('flow 1: task request -> proposal -> accept -> complete -> review', async () => {
  const results = await apiClient.listListings({ filter: { query: 'plen' } });
  const task = results.find((l) => l.type === 'TASK_REQUEST' && l.title === 'Klippe plen')!;
  expect(task).toBeTruthy();

  const conv = await apiClient.startConversationForListing(task.id);
  await apiClient.sendMessage(conv.id, 'Hei! Jeg kan ta denne jobben.');

  const proposal = await apiClient.sendProposal({
    conversationId: conv.id,
    listingId: task.id,
    priceAmountMinor: 65000,
    scheduledText: 'På lørdag',
  });
  expect(proposal.status).toBe('SENT');

  // the task owner is the recipient and accepts
  const { proposal: accepted, agreement } = await apiClient.respondToProposal(
    proposal.id,
    'ACCEPT',
    'RECIPIENT',
  );
  expect(accepted.status).toBe('ACCEPTED');
  expect(agreement?.price.amountMinor).toBe(65000);

  // both parties confirm completion
  await apiClient.confirmCompletion(proposal.id, ME);
  const confirmations = await apiClient.confirmCompletion(proposal.id, task.owner.id);
  expect(confirmations.length).toBe(2);
  expect(profileRepository.isFullyCompleted(proposal.id)).toBe(true);

  // one review per agreement
  const review = await apiClient.submitReview({
    agreementProposalId: proposal.id,
    listingId: task.id,
    fromProfileId: ME,
    toProfileId: task.owner.id,
    rating: 5,
  });
  expect(review.rating).toBe(5);
  expect(profileRepository.hasReviewed(proposal.id, ME)).toBe(true);

  // no payment artefacts anywhere in the conversation
  const messages = await apiClient.listMessages(conv.id);
  expect(messages.map((m) => m.text).join(' ')).not.toMatch(/Vipps|Betal nå/i);
});

/**
 * Spec §26 E2E flow 2:
 * Find tilbyder -> ta kontakt -> be om tilbud -> godta -> fullfør -> vurder.
 */
test('flow 2: service offer -> contact -> request -> proposal -> accept -> complete -> review', async () => {
  const results = await apiClient.listListings({ filter: { type: 'SERVICE_OFFER' } });
  const found = results.find((l) => l.title === 'Jeg kan klippe plenen din')!;
  expect(found.type).toBe('SERVICE_OFFER');
  const offer = found;
  // the nabo who needs help asks first
  const conv = await apiClient.startConversationForListing(offer.id);
  await apiClient.sendMessage(conv.id, 'Hei! Kan du sende meg et tilbud?');

  // On an offer the helper (its owner) sends the tilbud (0076). The mock has one signed-in
  // user, so from here it plays the helper: the offer becomes 'mine' for the send.
  repositories.listings.replace({ ...found, owner: { ...found.owner, id: ME } });

  // the provider (listing owner) sends the proposal
  const proposal = chatRepository.sendProposal({
    conversationId: conv.id,
    listingId: offer.id,
    priceAmountMinor: 55000,
    scheduledText: 'Onsdag ettermiddag',
  });

  // the nabo who asked accepts
  const { agreement } = await apiClient.respondToProposal(proposal.id, 'ACCEPT', 'RECIPIENT');
  expect(agreement).toBeDefined();

  await apiClient.confirmCompletion(proposal.id, ME);
  await apiClient.confirmCompletion(proposal.id, found.owner.id);
  expect(profileRepository.isFullyCompleted(proposal.id)).toBe(true);
  // the offer stays open for the next nabo – an avtale never closes it (0076)
  expect(repositories.listings.get(offer.id)?.status).toBe(found.status);

  const review = await apiClient.submitReview({
    agreementProposalId: proposal.id,
    listingId: offer.id,
    fromProfileId: ME,
    toProfileId: offer.owner.id,
    rating: 4,
    comment: 'Fin jobb.',
  });
  expect(review.rating).toBe(4);
});
