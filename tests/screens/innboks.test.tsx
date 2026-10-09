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
    expect(screen.getByText(/uleste? meldinge?r? i \d+ samtaler?/)).toBeTruthy();
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

test('a conversation I just wrote in is not unread and shows "Du:"', async () => {
  const conv = chatRepository.listConversations()[0];
  chatRepository._receive(conv.id, 'Hei, passer lørdag?', conv.counterpart.id);
  chatRepository.sendMessage(conv.id, 'Ja, det passer fint');
  await renderWithProviders(<InnboksScreen />);
  await waitFor(() => expect(screen.getByText(/Du: Ja, det passer fint/)).toBeTruthy());
  expect(chatRepository.listConversations({ unreadOnly: true }).some((c) => c.id === conv.id)).toBe(false);
});

test('my last message shows its receipt; theirs shows none', async () => {
  const [mine, theirs] = chatRepository.listConversations();
  chatRepository.sendMessage(mine.id, 'Er du der?');
  chatRepository._receive(theirs.id, 'Hei igjen', theirs.counterpart.id);
  await renderWithProviders(<InnboksScreen />);
  await waitFor(() => expect(screen.getByText(/Du: Er du der\?/)).toBeTruthy());
  expect(screen.getAllByLabelText('Sendt')).toHaveLength(1);
  const withReceipt = chatRepository.listConversations().filter((c) => c.lastMessageDelivery).length;
  expect(screen.queryAllByLabelText(/^(Sendt|Levert|Lest)$/)).toHaveLength(withReceipt);
  expect(chatRepository.listConversations().find((c) => c.id === theirs.id)?.lastMessageDelivery).toBeUndefined();
});
