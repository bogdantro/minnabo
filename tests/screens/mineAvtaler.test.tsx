import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { MineAvtalerScreen } from '@/screens/MineAvtalerScreen';
import { chatRepository } from '@mocks/data/chatRepository';
import { renderWithProviders } from '../testUtils';

beforeEach(() => chatRepository._reset());

test('upcoming agreements show with role, week strip and legend', async () => {
  await renderWithProviders(<MineAvtalerScreen />);
  // p-martin-flytting: Martin helps me with "Hjelp med flytting" ("Lørdag kl. 10:00" – no date)
  expect(await screen.findByText('Hjelp med flytting')).toBeTruthy();
  expect(screen.getAllByText('Du får hjelp').length).toBeGreaterThan(0);
  expect(screen.getByText('Uten dato')).toBeTruthy();
  expect(screen.getByLabelText(/^(Man|Tir|Ons|Tor|Fre|Lør|Søn) \d+\. \w+, i dag/)).toBeTruthy();
});

test('picking an empty day shows the empty-day card and "Vis alle" resets', async () => {
  await renderWithProviders(<MineAvtalerScreen />);
  await screen.findByText('Hjelp med flytting');
  await fireEvent.press(screen.getByLabelText(/, i dag/));
  expect(screen.getByText(/^Ingen avtaler /)).toBeTruthy();
  await fireEvent.press(screen.getAllByText('Vis alle')[0]);
  expect(screen.getByText('Hjelp med flytting')).toBeTruthy();
});

test('accepting a new offer adds it to Kommende', async () => {
  chatRepository.respondToProposal('p-emma-klippe', 'ACCEPT', 'RECIPIENT');
  await renderWithProviders(<MineAvtalerScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
});

test('a cancelled agreement leaves Kommende and shows as "Avlyst" under Fullført', async () => {
  chatRepository.cancelAgreement('p-martin-flytting', 'Været');
  await renderWithProviders(<MineAvtalerScreen />);
  await waitFor(() => expect(screen.getByText('Ingen kommende avtaler')).toBeTruthy());
  await fireEvent.press(screen.getByRole('tab', { name: /^Fullført/ }));
  expect(screen.getAllByText('Avlyst').length).toBeGreaterThan(0);
});
