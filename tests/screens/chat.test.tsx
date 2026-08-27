import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { InnboksScreen } from '@/screens/InnboksScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { chatRepository } from '@/data/chatRepository';
import { renderWithProviders } from '../testUtils';

beforeEach(() => chatRepository._reset());

test('Innboks lists conversations with status tags', async () => {
  await renderWithProviders(<InnboksScreen />);
  expect(screen.getByText('Innboks')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Emma Larsen')).toBeTruthy());
  expect(screen.getAllByText('Nytt tilbud').length).toBeGreaterThan(0);
  expect(screen.getByText('Tilbud godtatt')).toBeTruthy();
});

test('Innboks unread filter hides read conversations', async () => {
  await renderWithProviders(<InnboksScreen />);
  await waitFor(() => expect(screen.getByText('Emma Larsen')).toBeTruthy());
  fireEvent.press(screen.getByText('Uleste'));
  await waitFor(() => expect(screen.queryByText('Sara Ahmed')).toBeNull());
});

test('accepting an offer in chat shows "Tilbud godtatt"', async () => {
  const conversation = chatRepository.getConversation('c-emma')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  await waitFor(() =>
    expect(screen.getByText('Hei! Jeg kan klippe plenen i morgen kl. 17.')).toBeTruthy(),
  );
  const accept = await screen.findByText('Godta tilbud');
  fireEvent.press(accept);

  await waitFor(() => expect(screen.getAllByText('Tilbud godtatt').length).toBeGreaterThan(0));
  expect(screen.queryByText('Godta tilbud')).toBeNull();
});

test('chat never shows payment actions', async () => {
  const conversation = chatRepository.getConversation('c-emma')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);
  expect(screen.queryByText(/Vipps|Betal nå|Betal no/i)).toBeNull();
});
