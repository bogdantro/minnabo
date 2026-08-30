import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { InnboksScreen } from '@/screens/InnboksScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { chatRepository } from '@/data/chatRepository';
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
  fireEvent.press(accept);

  await waitFor(() => expect(screen.getAllByText('Tilbud godtatt').length).toBeGreaterThan(0));
  expect(screen.queryByText('Godta tilbud')).toBeNull();
});

test('chat never shows payment actions', async () => {
  const conversation = chatRepository.getConversation('c-emma')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);
  expect(screen.queryByText(/Vipps|Betal nå|Betal no/i)).toBeNull();
});

test('the Send tilbud sheet sends a customised proposal', async () => {
  const conversation = chatRepository.getConversation('c-sara')!;
  const before = chatRepository.getMessages('c-sara').length;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  await fireEvent.press(screen.getByText('Send tilbud'));
  await waitFor(() => expect(screen.getByLabelText('Foreslått pris (kr)')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Foreslått pris (kr)'), '850');
  const submitButtons = screen.getAllByRole('button', { name: 'Send tilbud' });
  await fireEvent.press(submitButtons[submitButtons.length - 1]);

  await waitFor(() =>
    expect(chatRepository.getMessages('c-sara').length).toBeGreaterThan(before),
  );
  const proposalMsg = chatRepository.getMessages('c-sara').find((m) => m.kind === 'PROPOSAL')!;
  const proposal = chatRepository.getProposal(proposalMsg.proposalId!)!;
  expect(proposal.price.amountMinor).toBe(85000);
});

test('chat shows a day separator above the first message of a day', async () => {
  const conversation = chatRepository.getConversation('c-emma')!;
  const firstDayLabel = formatDayLabel(new Date('2026-08-27T12:42:00Z'));
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);
  // c-emma messages are all dated 2026-08-27 → exactly one divider.
  await waitFor(() => expect(screen.getByText(firstDayLabel)).toBeTruthy());
});

test('the attach sheet posts an image message', async () => {
  const conversation = chatRepository.getConversation('c-sara')!;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  await fireEvent.press(screen.getByLabelText('Legg ved'));
  await waitFor(() => expect(screen.getByText('Legg ved bilde')).toBeTruthy());
  const pickers = screen.getAllByLabelText('Velg fra bibliotek');
  await fireEvent.press(pickers[pickers.length - 1]);

  await waitFor(() =>
    expect(chatRepository.getMessages('c-sara').some((m) => m.kind === 'IMAGE')).toBe(true),
  );
});

test('sending a message optimistically appends it then persists', async () => {
  const conversation = chatRepository.getConversation('c-sara')!;
  const before = chatRepository.getMessages('c-sara').length;
  await renderWithProviders(<ChatScreen conversation={conversation} onBack={() => {}} />);

  await fireEvent.changeText(screen.getByLabelText('Skriv en melding …'), 'Hei der!');
  await fireEvent.press(screen.getByLabelText('Send'));

  // optimistic bubble shows immediately
  expect(screen.getByText('Hei der!')).toBeTruthy();
  await waitFor(() =>
    expect(chatRepository.getMessages('c-sara').length).toBe(before + 1),
  );
});

test('cannot open a conversation about your own listing', async () => {
  const { chatRepository: repo } = require('@/data/chatRepository');
  // l-male-gjerdet is owned by the current user (profiles.mb)
  expect(() => repo.findOrCreateConversationForListing('l-male-gjerdet')).toThrow(
    /kontakte deg selv/i,
  );
});
