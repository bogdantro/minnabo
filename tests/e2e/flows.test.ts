import { apiClient } from '@/api/client';
import { chatRepository } from '@/data/chatRepository';
import { profileRepository } from '@/data/profileRepository';

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
  const offer = results.find((l) => l.title === 'Jeg kan klippe plenen din')!;
  expect(offer.type).toBe('SERVICE_OFFER');

  const conv = await apiClient.startConversationForListing(offer.id);
  await apiClient.sendMessage(conv.id, 'Hei! Kan du sende meg et tilbud?');

  // the provider (listing owner) sends the proposal
  const proposal = chatRepository.sendProposal({
    conversationId: conv.id,
    listingId: offer.id,
    priceAmountMinor: 55000,
    scheduledText: 'Onsdag ettermiddag',
  });

  // in this conversation the provider is the current user (they own the mock),
  // so the requester side accepts via RECIPIENT
  const { agreement } = await apiClient.respondToProposal(proposal.id, 'ACCEPT', 'RECIPIENT');
  expect(agreement).toBeDefined();

  await apiClient.confirmCompletion(proposal.id, ME);
  await apiClient.confirmCompletion(proposal.id, offer.owner.id);
  expect(profileRepository.isFullyCompleted(proposal.id)).toBe(true);

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
