/** Chat reactions (2026-11-13): the same five as on Oppslagstavla, as emoji pills with counts and a ×. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ChatScreen } from '@/screens/ChatScreen';
import { chatRepository } from '@mocks/data/chatRepository';
import { REACTIONS, reactionChips } from '@/domain/reactions';
import { renderWithProviders } from '../testUtils';

beforeEach(() => chatRepository._reset());

const MSG = 'Hei! Jeg kan klippe plenen i morgen kl. 17.';

test('chips come in the usual order, with older reactions kept at the end', () => {
  const chips = reactionChips({ '❤️': ['a'], '🎉': ['me', 'b'], '👍': ['b'], '😮': [] }, 'me');
  expect(chips).toEqual([
    { emoji: '👍', n: 1, on: false },
    { emoji: '🎉', n: 2, on: true },
    { emoji: '❤️', n: 1, on: false },
  ]);
});

test('tapping a message shows the five reactions and a ×; picking one puts a chip under it', async () => {
  const conversation = chatRepository.getConversation('c-emma')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);
  await fireEvent.press(await screen.findByText(MSG));
  for (const e of REACTIONS) expect(screen.getByLabelText(`${e} 0`)).toBeTruthy();
  expect(screen.getByLabelText('Lukk reaksjonene')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('🙏 0'));
  // the bar closes, and the chip shows it is mine
  await waitFor(() => expect(screen.queryByLabelText('Lukk reaksjonene')).toBeNull());
  expect(await screen.findByLabelText('🙏 1, din reaksjon')).toBeTruthy();

  // tapping my chip takes it back
  await fireEvent.press(screen.getByLabelText('🙏 1, din reaksjon'));
  await waitFor(() => expect(screen.queryByLabelText('🙏 1, din reaksjon')).toBeNull());
});

test('the × closes the bar without reacting', async () => {
  const conversation = chatRepository.getConversation('c-emma')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);
  await fireEvent.press(await screen.findByText(MSG));
  await fireEvent.press(screen.getByLabelText('Lukk reaksjonene'));
  await waitFor(() => expect(screen.queryByLabelText('👍 0')).toBeNull());
});
