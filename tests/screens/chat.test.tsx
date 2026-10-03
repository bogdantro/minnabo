import { screen, waitFor, fireEvent, within } from '@testing-library/react-native';
import { InnboksScreen } from '@/screens/InnboksScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { chatRepository } from '@mocks/data/chatRepository';
import { shift } from '@mocks/data/seedChat';
import { formatDayLabel } from '@/lib/calendar';
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
  await fireEvent.press(accept);
  // confirm in the "Godta tilbudet fra …?" dialog
  expect(screen.getByText('Godta tilbudet fra Emma?')).toBeTruthy();
  const buttons = screen.getAllByText('Godta tilbud');
  await fireEvent.press(buttons[buttons.length - 1]);

  await waitFor(() => expect(screen.getAllByText('Tilbud godtatt').length).toBeGreaterThan(0));
  expect(screen.queryByText('Godta tilbud')).toBeNull();
});

test('a counterpart phone number is hidden until an agreement exists', async () => {
  const { apiClient } = require('@/api/client');
  const before = await apiClient.getProfile('u-emma');
  expect(before.phone).toBeUndefined();

  chatRepository.respondToProposal('p-emma-klippe', 'ACCEPT', 'RECIPIENT');
  const after = await apiClient.getProfile('u-emma');
  expect(after.phone).toBe('+47 901 22 333');
});

test('the pinned job card shows the agreed price once an offer is accepted', async () => {
  const conversation = chatRepository.getConversation('c-emma')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  expect(screen.queryByTestId('chat-job-facts')).toBeNull();

  await fireEvent.press(await screen.findByText('Godta tilbud'));
  const buttons = screen.getAllByText('Godta tilbud');
  await fireEvent.press(buttons[buttons.length - 1]);

  const facts = await screen.findByTestId('chat-job-facts');
  expect(within(facts).getByText(/600/)).toBeTruthy();
  expect(within(facts).getByText('Avtale inngått – I morgen kl. 17:00')).toBeTruthy();
  expect(within(facts).getByText('Avtalt')).toBeTruthy();
});

test('tapping a quick reply sends it', async () => {
  const conversation = chatRepository.getConversation('c-sara')!;
  const before = chatRepository.getMessages('c-sara').length;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  await fireEvent.press(await screen.findByLabelText('Passer fint!'));

  await waitFor(() =>
    expect(chatRepository.getMessages('c-sara').length).toBe(before + 1),
  );
  expect(chatRepository.getMessages('c-sara').at(-1)?.text).toBe('Passer fint!');
});

test('a reaction renders as a chip and can be toggled off', async () => {
  const conversation = chatRepository.getConversation('c-emma')!;
  const first = chatRepository.getMessages('c-emma')[0];
  chatRepository.toggleReaction('c-emma', first.id, '👍');

  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  await fireEvent.press(await screen.findByLabelText('👍 1'));
  await waitFor(() => expect(screen.queryByLabelText('👍 1')).toBeNull());
});

test('pinning a message shows the pinned banner until unpinned', async () => {
  const conversation = chatRepository.getConversation('c-emma')!;
  const first = chatRepository.getMessages('c-emma')[0];
  chatRepository.setPinnedMessage('c-emma', first.id);

  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  expect(await screen.findByText('Festet:')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Løsne festet melding'));
  await waitFor(() => expect(screen.queryByText('Festet:')).toBeNull());
});

test('the "Foreslå tid" action opens the time picker sheet', async () => {
  const conversation = chatRepository.getConversation('c-sara')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  await fireEvent.press(await screen.findByLabelText('Legg ved eller foreslå tid'));
  await fireEvent.press(await screen.findByLabelText('Foreslå tid'));
  expect(await screen.findByText('Send tidsforslag')).toBeTruthy();
});

test('chat never shows payment actions', async () => {
  const conversation = chatRepository.getConversation('c-emma')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);
  expect(screen.queryByText(/Vipps|Betal nå|Betal no/i)).toBeNull();
});

test('the Send tilbud row opens the Gi tilbud sheet and sends a proposal', async () => {
  const conversation = chatRepository.getConversation('c-sara')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  await fireEvent.press(await screen.findByLabelText('Legg ved eller foreslå tid'));
  await waitFor(() => expect(screen.getByText('Gi et pristilbud på oppdraget')).toBeTruthy());
  await fireEvent.press(screen.getByText('Send tilbud'));
  await fireEvent.changeText(await screen.findByLabelText('Beløp i kroner'), '850');
  await fireEvent.changeText(screen.getByLabelText('Melding til Emma'), 'Jeg kan montere skapet i morgen.');
  await fireEvent.press(screen.getByText('Se over tilbudet'));
  const send = screen.getAllByText('Send tilbud');
  await fireEvent.press(send[send.length - 1]);

  await waitFor(() =>
    expect(
      chatRepository.proposalsForListing('l-montere-garderobe').some((p) => p.price.amountMinor === 85000),
    ).toBe(true),
  );
});

test('chat shows a day separator above the first message of a day', async () => {
  const conversation = chatRepository.getConversation('c-emma')!;
  // seedChat anchors its dates to "now" (see seedChat.ts) so compute the
  // label the same way, rather than off the original frozen literal.
  const firstDayLabel = formatDayLabel(new Date(shift('2026-08-27T12:42:00Z')));
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);
  // c-emma messages are all dated 2026-08-27 → exactly one divider.
  await waitFor(() => expect(screen.getByText(firstDayLabel)).toBeTruthy());
});

test('the Bilde tile uploads and posts an image message', async () => {
  const uploads = require('@/lib/uploads');
  const spy = jest.spyOn(uploads, 'pickAndUpload').mockResolvedValue({ path: 'u/x.jpg', publicUrl: 'https://example.com/x.jpg' });
  const conversation = chatRepository.getConversation('c-sara')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  await fireEvent.press(await screen.findByLabelText('Legg ved eller foreslå tid'));
  await fireEvent.press(await screen.findByLabelText('Bilde'));

  await waitFor(() =>
    expect(chatRepository.getMessages('c-sara').some((m) => m.kind === 'IMAGE')).toBe(true),
  );
  spy.mockRestore();
});

test('sending a message appends it and persists it', async () => {
  const conversation = chatRepository.getConversation('c-sara')!;
  const before = chatRepository.getMessages('c-sara').length;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  await fireEvent.changeText(screen.getByPlaceholderText('Skriv en melding …'), 'Hei der!');
  await fireEvent.press(screen.getByLabelText('Send melding'));

  await waitFor(() => expect(screen.getByText('Hei der!')).toBeTruthy());
  await waitFor(() =>
    expect(chatRepository.getMessages('c-sara').length).toBe(before + 1),
  );
});

test('cannot open a conversation about your own listing', async () => {
  const { chatRepository: repo } = require('@mocks/data/chatRepository');
  // l-male-gjerdet is owned by the current user (profiles.mb)
  expect(() => repo.findOrCreateConversationForListing('l-male-gjerdet')).toThrow(
    /kontakte deg selv/i,
  );
});

test('a time proposal renders as a card the other party can answer with "Passer"', async () => {
  const conversation = chatRepository.getConversation('c-sara')!;
  chatRepository._receive('c-sara', '📅 Tidsforslag: Lør 10. okt kl. 10:00', 'u-andreas');
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  expect(await screen.findByText('Tidsforslag')).toBeTruthy();
  await fireEvent.press(screen.getByText('Passer'));
  await waitFor(() => expect(screen.getByText('Tidspunktet passer')).toBeTruthy());
  expect(chatRepository.getMessages('c-sara').at(-1)?.text).toBe('✓ Tidspunktet passer: Lør 10. okt kl. 10:00');
});

test('blocking from the menu replaces the composer with the blocked bar', async () => {
  const conversation = chatRepository.getConversation('c-sara')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  await fireEvent.press(await screen.findByLabelText('Flere valg'));
  await fireEvent.press(screen.getByText('Blokker'));
  await fireEvent.press(screen.getAllByText('Blokker').at(-1)!);
  expect(await screen.findByText(/Du har blokkert Andreas/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Opphev'));
  await waitFor(() => expect(screen.queryByText(/Du har blokkert Andreas/)).toBeNull());
});
