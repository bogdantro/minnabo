import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { AgendaScreen } from '@/screens/AgendaScreen';
import { chatRepository } from '@/data/chatRepository';
import { renderWithProviders } from '../testUtils';

beforeEach(() => chatRepository._reset());

test('the agenda lists the current user agreements', async () => {
  await renderWithProviders(<AgendaScreen />);
  // p-martin-flytting is seeded as an agreement the current user is part of.
  await waitFor(() => expect(screen.getByText('KOMMENDE')).toBeTruthy());
  expect(screen.getByText('Lørdag kl. 10:00')).toBeTruthy();
});

test('accepting a new offer adds it to the agenda', async () => {
  chatRepository.respondToProposal('p-emma-klippe', 'ACCEPT', 'RECIPIENT');
  await renderWithProviders(<AgendaScreen />);
  await waitFor(() =>
    expect(chatRepository.listMyAgreements().some((a) => a.proposalId === 'p-emma-klippe')).toBe(true),
  );
});
