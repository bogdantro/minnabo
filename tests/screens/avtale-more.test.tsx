import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AvtaleSammendragScreen } from '@/screens/AvtaleSammendragScreen';
import { chatRepository } from '@mocks/data/chatRepository';
import { repositories } from '@mocks/data/repositories';
import { extras } from '@mocks/mockClient';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  chatRepository._reset();
  repositories.listings._reset();
  extras.reset();
});

// p-martin-flytting: Martin's accepted offer on my "Hjelp med flytting" (I am the oppdragsgiver)
const ID = 'p-martin-flytting';
const tomorrowAt = (h: number) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, 0, 0, 0);
  return d;
};
const pending = (proposedBy: string, h: number, scheduledText: string) =>
  extras.time.push({ id: 't1', proposalId: ID, proposedBy, scheduledAt: tomorrowAt(h).toISOString(), scheduledText, status: 'PENDING' });

test('Foreslå nytt tidspunkt sends a proposal that waits for the other person', async () => {
  await renderWithProviders(<AvtaleSammendragScreen proposalId={ID} />);
  await screen.findByText('Avtalen er klar');
  const before = chatRepository.getAgreement(ID)?.scheduledText;

  await fireEvent.press(screen.getByText('Foreslå nytt tidspunkt'));
  // the first day in the sheet is tomorrow
  const day = (await screen.findAllByLabelText(/^(man|tir|ons|tor|fre|lør|søn)\S* \d/i))[0];
  await fireEvent.press(day);
  await fireEvent.press(screen.getByText('kl. 10:00'));
  await fireEvent.press(screen.getByText('Send forslag'));

  await waitFor(() => expect(extras.time).toHaveLength(1));
  expect(extras.time[0].status).toBe('PENDING');
  expect(new Date(extras.time[0].scheduledAt).getTime()).toBe(tomorrowAt(10).getTime());
  expect(extras.time[0].scheduledText).toMatch(/kl\. 10:00$/);
  // nothing changes until the other person answers
  expect(chatRepository.getAgreement(ID)?.scheduledText).toBe(before);
  expect(await screen.findByText('Du har foreslått nytt tidspunkt')).toBeTruthy();
  expect(screen.getByText('Trekk forslaget')).toBeTruthy();
});

test('I can withdraw my own proposal', async () => {
  pending(chatRepository.currentUserId, 12, 'i morgen kl. 12:00');
  await renderWithProviders(<AvtaleSammendragScreen proposalId={ID} />);
  await fireEvent.press(await screen.findByText('Trekk forslaget'));
  await waitFor(() => expect(extras.time[0].status).toBe('WITHDRAWN'));
  await waitFor(() => expect(screen.queryByText('Du har foreslått nytt tidspunkt')).toBeNull());
});

test('accepting the proposal from the other person moves the avtale', async () => {
  pending(chatRepository.getProposal(ID)!.fromProfileId, 14, 'fre 9. okt kl. 14:00');
  await renderWithProviders(<AvtaleSammendragScreen proposalId={ID} />);
  expect(await screen.findByText(/foreslår nytt tidspunkt/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Godta'));
  await waitFor(() => expect(extras.time[0].status).toBe('ACCEPTED'));
  expect(chatRepository.getAgreement(ID)?.scheduledText).toBe('fre 9. okt kl. 14:00');
  expect(chatRepository.getAgreement(ID)?.scheduledAt).toBe(tomorrowAt(14).toISOString());
});

test('"Passer ikke" leaves the avtale as it was', async () => {
  const before = chatRepository.getAgreement(ID)?.scheduledText;
  pending(chatRepository.getProposal(ID)!.fromProfileId, 14, 'fre 9. okt kl. 14:00');
  await renderWithProviders(<AvtaleSammendragScreen proposalId={ID} />);
  await fireEvent.press(await screen.findByText('Passer ikke'));
  await waitFor(() => expect(extras.time[0].status).toBe('DECLINED'));
  expect(chatRepository.getAgreement(ID)?.scheduledText).toBe(before);
});

test('Be om hjelp igjen is not offered while the job is still open', async () => {
  await renderWithProviders(<AvtaleSammendragScreen proposalId={ID} />);
  await screen.findByText('Avtalen er klar');
  expect(screen.queryByText('Be om hjelp igjen')).toBeNull();
});

test('Be om hjelp igjen on a finished job sends the oppdrag to the same helper', async () => {
  repositories.listings.setStatus(chatRepository.getProposal(ID)!.listingId, 'COMPLETED');
  await renderWithProviders(<AvtaleSammendragScreen proposalId={ID} />);
  await fireEvent.press(await screen.findByText('Be om hjelp igjen'));
  await fireEvent.changeText(await screen.findByLabelText('Når passer det?'), 'Neste lørdag');
  await fireEvent.press(screen.getByText('Send forespørsel'));
  await waitFor(() => expect(extras.again).toEqual([{ proposalId: ID, when: 'Neste lørdag', note: undefined }]));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/oppdrag/again-1'));
  // a finished job can't be moved
  expect(screen.queryByText('Foreslå nytt tidspunkt')).toBeNull();
});
