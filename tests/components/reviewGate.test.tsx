import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { reviewDutyStore } from '@mocks/data/reviewDutyStore';
import { profileRepository } from '@mocks/data/profileRepository';
import { apiClient } from '@/api/client';
import { ReviewGate, reviewGateAllows } from '@/components/ReviewGate';
import { ReviewScreen } from '@/screens/ReviewScreen';
import { buildListing, emptyWizard, upcomingDays } from '@/screens/LeggUt/wizardModel';
import { renderWithProviders } from '../testUtils';

const expoRouter = jest.requireMock('expo-router');
const realPathname = expoRouter.usePathname;
const at = (path: string) => {
  expoRouter.usePathname = () => path;
};

const owed = {
  proposalId: 'p-emma-klippe',
  listingId: 'l1',
  listingTitle: 'Klippe plen',
  otherId: 'u-emma',
  otherName: 'Emma Larsen',
  completedAt: '2026-10-30T10:00:00Z',
};

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  expoRouter.usePathname = realPathname;
});

test('with a review owed, any other screen opens the review instead', async () => {
  reviewDutyStore.add(owed);
  at('/');
  await renderWithProviders(<ReviewGate />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/vurder/p-emma-klippe'));
});

test('nothing owed: the gate does nothing', async () => {
  at('/');
  await renderWithProviders(<ReviewGate />);
  await new Promise((r) => setTimeout(r, 200));
  expect(router.replace).not.toHaveBeenCalled();
});

test('help stays reachable while a review is owed: chat, Rapporter, Sikkerhet – but not Legg ut or a tilbud', () => {
  expect(reviewGateAllows('/vurder/p-emma-klippe')).toBe(true);
  expect(reviewGateAllows('/chat/c-emma')).toBe(true);
  expect(reviewGateAllows('/rapporter')).toBe(true);
  expect(reviewGateAllows('/sikkerhet')).toBe(true);
  expect(reviewGateAllows('/')).toBe(false);
  expect(reviewGateAllows('/legg-ut')).toBe(false);
  expect(reviewGateAllows('/oppdrag/l1')).toBe(false);
  expect(reviewGateAllows('/tilbud/t1')).toBe(false);
});

test('an owed review has no way back, needs stars but no text, and is no longer owed once sent', async () => {
  reviewDutyStore.add(owed);
  await renderWithProviders(<ReviewScreen proposalId="p-emma-klippe" />);
  expect(await screen.findByText(/en vurdering er påkrevd/)).toBeTruthy();
  expect(screen.queryByLabelText('Tilbake')).toBeNull();
  // no stars: can't send
  expect(screen.getByRole('button', { name: 'Send vurdering' })).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('4 stjerner – Bra'));
  await fireEvent.press(screen.getByText('Send vurdering'));
  await waitFor(() => expect(profileRepository.hasReviewed('p-emma-klippe', profileRepository.currentUserId)).toBe(true));
  expect(reviewDutyStore.list()).toHaveLength(0);
});

test('the rule holds without the app: no stars is refused, and no new oppdrag while a review is owed', async () => {
  reviewDutyStore.add(owed);
  await expect(
    apiClient.submitReview({ agreementProposalId: 'p-emma-klippe', listingId: 'l1', fromProfileId: 'u-mb', toProfileId: 'u-emma', rating: 0 }),
  ).rejects.toThrow('Velg mellom 1 og 5 stjerner.');
  const l = buildListing({ ...emptyWizard('Lillehammer'), cat: 'hage', title: 'Klippe plen igjen' }, upcomingDays(new Date()));
  await expect(apiClient.createListing(l)).rejects.toThrow('Gi en vurdering av Emma først.');
});
