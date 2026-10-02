import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StartChatScreen } from '@/screens/StartChatScreen';
import { chatRepository } from '@mocks/data/chatRepository';
import { repositories } from '@mocks/data/repositories';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  jest.clearAllMocks();
  chatRepository._reset();
  repositories.listings._reset();
});

const convFor = (listingId: string) =>
  chatRepository.listConversations().filter((c) => c.listing.id === listingId);

test('a fresh conversation shows the pinned oppdrag, intro, tip and openers – nothing is created yet', async () => {
  const before = convFor('l-vaskehjelp').length;
  await renderWithProviders(<StartChatScreen listingId="l-vaskehjelp" />);
  await waitFor(() => expect(screen.getByText('Si hei til Emma')).toBeTruthy());
  expect(screen.getByText('Vaskehjelp før visning')).toBeTruthy();
  expect(screen.getByText('Tips for en trygg avtale')).toBeTruthy();
  expect(screen.getByText('Forslag til første melding')).toBeTruthy();
  expect(convFor('l-vaskehjelp')).toHaveLength(before);
});

test('an opener fills the composer; sending creates the conversation and shows the banner', async () => {
  await renderWithProviders(<StartChatScreen listingId="l-vaskehjelp" />);
  await waitFor(() => expect(screen.getByText('Si hei til Emma')).toBeTruthy());
  expect(screen.getByLabelText('Send melding')).toBeDisabled();

  await fireEvent.press(screen.getByText('Kan du fortelle litt mer om jobben?'));
  expect(screen.getByLabelText('Melding').props.value).toBe('Kan du fortelle litt mer om jobben?');
  await fireEvent.press(screen.getByLabelText('Send melding'));

  await waitFor(() => expect(screen.getByText('Samtalen er i gang')).toBeTruthy());
  expect(screen.getByText('Sendt')).toBeTruthy();
  const conv = convFor('l-vaskehjelp')[0];
  expect(chatRepository.getMessages(conv.id).some((m) => m.text === 'Kan du fortelle litt mer om jobben?')).toBe(true);

  await fireEvent.press(screen.getByText('Fortsett i samtalen'));
  expect(router.replace).toHaveBeenCalledWith(`/chat/${conv.id}`);
});
