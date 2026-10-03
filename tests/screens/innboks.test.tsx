import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { InnboksScreen } from '@/screens/InnboksScreen';
import { chatRepository } from '@mocks/data/chatRepository';
import { renderWithProviders } from '../testUtils';

beforeEach(() => chatRepository._reset());

test('search filters live on name, oppdrag and message; empty search shows "Ingen treff"', async () => {
  await renderWithProviders(<InnboksScreen />);
  await waitFor(() => expect(screen.getByText('Emma Larsen')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Søk i meldinger'), 'verktøy');
  expect(screen.getByText('Andreas')).toBeTruthy();
  expect(screen.queryByText('Emma Larsen')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Søk i meldinger'), 'xyzzy');
  expect(screen.getByText('Ingen treff på «xyzzy»')).toBeTruthy();
});

test('"Merk alle som lest" clears unread, is held for Angre and then sent', async () => {
  jest.useFakeTimers();
  try {
    await renderWithProviders(<InnboksScreen />);
    await jest.advanceTimersByTimeAsync(400);
    expect(screen.getByText(/samtaler? med uleste meldinger/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Merk alle som lest'));
    expect(screen.getByText('Alt er lest')).toBeTruthy();
    expect(chatRepository.listConversations({ unreadOnly: true }).length).toBeGreaterThan(0);
    await jest.advanceTimersByTimeAsync(6000);
    await waitFor(() => expect(chatRepository.listConversations({ unreadOnly: true })).toHaveLength(0));
  } finally {
    jest.useRealTimers();
  }
});

test('"Uleste" with nothing unread shows "Du er à jour!"', async () => {
  chatRepository.listConversations().forEach((c) => chatRepository.markRead(c.id));
  await renderWithProviders(<InnboksScreen />);
  await waitFor(() => expect(screen.getByText('Emma Larsen')).toBeTruthy());
  await fireEvent.press(screen.getByText('Uleste'));
  expect(screen.getByText('Du er à jour!')).toBeTruthy();
});
