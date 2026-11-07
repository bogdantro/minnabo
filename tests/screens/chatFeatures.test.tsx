import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { ChatScreen } from '@/screens/ChatScreen';
import { InnboksScreen } from '@/screens/InnboksScreen';
import { Composer } from '@/components/chat/ChatTop';
import { RichText } from '@/components/chat/MessageExtras';
import { toMessage, toConversation } from '@/api/mappers';
import { chatRepository } from '@mocks/data/chatRepository';
import { extras } from '@mocks/mockClient';
import nb from '@/i18n/nb';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  chatRepository._reset();
  extras.reset();
});

const openChat = async () => {
  const conversation = chatRepository.getConversation('c-emma')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);
};

test('holding a message offers Svar, Kopier and Fest', async () => {
  chatRepository.sendMessage('c-emma', 'Hei, er du ledig?');
  await openChat();
  const bubble = await screen.findByText('Hei, er du ledig?');
  await fireEvent(bubble, 'longPress');
  expect(await screen.findByText('Svar')).toBeTruthy();
  expect(screen.getByText('Kopier teksten')).toBeTruthy();
  expect(screen.getByText(nb.chat.pinMessage)).toBeTruthy();
});

test('your own fresh message can be deleted, and an old one can not', async () => {
  const fresh = chatRepository.sendMessage('c-emma', 'Ny melding her');
  await openChat();
  await fireEvent(await screen.findByText(fresh.text), 'longPress');
  expect(await screen.findByText('Slett meldingen')).toBeTruthy();
});

test('«Svar» shows who is answered above the text field, and it can be cancelled', async () => {
  chatRepository.sendMessage('c-emma', 'Hei, er du ledig?');
  await openChat();
  await fireEvent(await screen.findByText('Hei, er du ledig?'), 'longPress');
  await fireEvent.press(await screen.findByText('Svar'));
  expect(await screen.findByLabelText('Avbryt svaret')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Avbryt svaret'));
  await waitFor(() => expect(screen.queryByLabelText('Avbryt svaret')).toBeNull());
});

test('a deleted message says so and shows no text', () => {
  const m = toMessage({
    id: 'm', conversation_id: 'c', author_id: 'a', kind: 'IMAGE', text: '', proposal_id: null,
    attachment_path: 'a/b.jpg', created_at: new Date().toISOString(), deleted_at: new Date().toISOString(),
  });
  expect(m.deletedAt).toBeTruthy();
  expect(m.attachmentUrl).toBeUndefined();
});

test('a link opens only after a warning, and our own site opens at once', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await renderWithProviders(<RichText value="Se minnaboapp.no/hjelp" mine={false} />);
  await fireEvent.press(screen.getByText('minnaboapp.no/hjelp'));
  await waitFor(() => expect(open).toHaveBeenCalledWith('https://minnaboapp.no/hjelp'));
  open.mockRestore();
});

test('a phone number in a message can be called', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await renderWithProviders(<RichText value="Ring 912 34 567" mine={false} />);
  await fireEvent.press(screen.getByLabelText('Ring 912 34 567'));
  expect(open).toHaveBeenCalledWith('tel:91234567');
  open.mockRestore();
});

test('typing an address before an avtale gives a warning, after an avtale it does not', async () => {
  const props = { first: 'Emma', onSend: () => undefined, onAttach: () => undefined, replies: [] };
  const first = await renderWithProviders(<Composer {...props} hasAgreement={false} />);
  await fireEvent.changeText(screen.getByPlaceholderText(/./), 'Jeg bor i Storgata 12');
  expect(await screen.findByText(/Du deler adressen før dere har avtalt/)).toBeTruthy();
  await first.unmount();

  await renderWithProviders(<Composer {...props} hasAgreement />);
  await fireEvent.changeText(screen.getByPlaceholderText(/./), 'Jeg bor i Storgata 12');
  expect(screen.queryByText(/Du deler adressen/)).toBeNull();
});

test('Innboks: «Mine oppdrag» and «Jeg hjelper» split the conversations', async () => {
  await renderWithProviders(<InnboksScreen />);
  await waitFor(() => expect(screen.getByText('Emma Larsen')).toBeTruthy());
  await fireEvent.press(screen.getByText('Jeg hjelper'));
  await waitFor(() => expect(screen.queryByText('Mine oppdrag')).toBeTruthy());
});

test('the role in a conversation follows who owns what kind of post', () => {
  const row = (type: 'TASK_REQUEST' | 'SERVICE_OFFER', owner: string) =>
    ({
      id: 'c',
      listing: { id: 'l', title: 'T', type, place: 'P', owner_id: owner },
      last_message_preview: '',
      last_message_at: new Date().toISOString(),
      conversation_participants: [],
    }) as unknown as Parameters<typeof toConversation>[0];
  expect(toConversation(row('TASK_REQUEST', 'me'), 'me').role).toBe('client');
  expect(toConversation(row('TASK_REQUEST', 'x'), 'me').role).toBe('helper');
  expect(toConversation(row('SERVICE_OFFER', 'me'), 'me').role).toBe('helper');
  expect(toConversation(row('SERVICE_OFFER', 'x'), 'me').role).toBe('client');
});

test('an archived conversation is not counted, and has its own tab', () => {
  const r = {
    id: 'c',
    listing: { id: 'l', title: 'T', type: 'TASK_REQUEST', place: 'P' },
    last_message_preview: '',
    last_message_at: new Date().toISOString(),
    conversation_participants: [{ profile_id: 'me', archived_at: new Date().toISOString(), profile: { id: 'me' } }],
  } as unknown as Parameters<typeof toConversation>[0];
  expect(toConversation(r, 'me').archived).toBe(true);
});
