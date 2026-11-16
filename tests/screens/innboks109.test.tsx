/** Innboks and chat additions (0109): pin, snooze, quick reply, bulk, search, edit, delete, «Send senere», address. */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '@/api/client';
import { inbox } from '@mocks/mockInbox';
import { chatRepository } from '@mocks/data/chatRepository';
import { InnboksScreen } from '@/screens/InnboksScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { canDeleteMessage, canEditMessage } from '@/domain/inbox';
import { safePush } from '@/lib/nav';
import nb from '@/i18n/nb';
import { renderWithProviders } from '../testUtils';

jest.mock('@/lib/nav', () => ({ safePush: jest.fn(), safeNavigate: jest.fn() }));

beforeEach(() => {
  inbox._reset();
  (safePush as jest.Mock).mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Innboks', () => {
  test('a pinned conversation comes first and shows its pin', async () => {
    await apiClient.setConversationFlags('c-fjellbygg', { pinned: true });
    await renderWithProviders(<InnboksScreen />);
    await waitFor(() => expect(screen.getByText('Fjellbygg AS')).toBeTruthy());
    const rows = screen.getAllByRole('link').map((n) => n.props.accessibilityLabel as string).filter((l) => l?.includes(','));
    expect(rows.find((l) => l.includes('Festet'))).toMatch(/^Fjellbygg AS/);
  });

  test('a snoozed conversation leaves the list and waits under «Slumrer»', async () => {
    await apiClient.setConversationFlags('c-sara', { snoozeUntil: new Date(Date.now() + 3_600_000).toISOString() });
    await renderWithProviders(<InnboksScreen />);
    await waitFor(() => expect(screen.getByText('Emma Larsen')).toBeTruthy());
    expect(screen.queryByText('Andreas')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Slumrer, 1'));
    expect(await screen.findByText('Andreas')).toBeTruthy();
  });

  test('pinning from the row menu', async () => {
    await renderWithProviders(<InnboksScreen />);
    await waitFor(() => expect(screen.getByText('Martin Solberg')).toBeTruthy());
    await fireEvent(screen.getByLabelText(/^Martin Solberg, /), 'longPress');
    await fireEvent.press(await screen.findByText('Fest øverst'));
    await waitFor(() => expect(inbox.flags['c-martin']?.pinnedAt).toBeTruthy());
  });

  test('«Velg» marks several conversations as read at once', async () => {
    await renderWithProviders(<InnboksScreen />);
    await waitFor(() => expect(screen.getByText('Emma Larsen')).toBeTruthy());
    await fireEvent.press(screen.getByText('Velg'));
    await fireEvent.press(screen.getByLabelText(/^Emma Larsen, /));
    await fireEvent.press(screen.getByLabelText(/^Fjellbygg AS, /));
    expect(screen.getByText('2 valgt')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Merk som lest'));
    await waitFor(() => expect(chatRepository.getConversation('c-emma')?.unread).toBe(false));
  });

  test('search finds a word inside a message and opens the chat at it', async () => {
    await renderWithProviders(<InnboksScreen />);
    await waitFor(() => expect(screen.getByText('Emma Larsen')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Søk i meldinger'), 'gressklipper');
    expect(await screen.findByTestId('message-hits')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/gressklipper/));
    expect(safePush).toHaveBeenCalledWith('/chat/c-emma?melding=m2');
  });
});

describe('the chat', () => {
  const emma = () => chatRepository.getConversation('c-emma')!;

  test('my own message can be edited and says «redigert»', async () => {
    const mine = chatRepository.sendMessage('c-emma', 'Kommer kl 17');
    await renderWithProviders(<ChatScreen conversation={emma()} onBack={() => {}} />);
    await fireEvent(await screen.findByText('Kommer kl 17'), 'longPress');
    await fireEvent.press(await screen.findByText('Endre meldingen'));
    await fireEvent.changeText(screen.getByLabelText('Endre meldingen'), 'Kommer kl 18');
    await fireEvent.press(screen.getByText('Lagre'));
    expect(await screen.findByText('Kommer kl 18')).toBeTruthy();
    expect(chatRepository.getMessages('c-emma').find((m) => m.id === mine.id)?.editedAt).toBeTruthy();
    expect(screen.getAllByText('redigert ·').length).toBeGreaterThan(0);
  });

  test('another person\'s message, or an old one, cannot be edited', async () => {
    await expect(apiClient.editMessage('m1', 'x')).rejects.toThrow('Fant ikke meldingen.');
    const old = chatRepository.sendMessage('c-emma', 'Gammel');
    chatRepository._patchMessage('c-emma', old.id, { createdAt: new Date(Date.now() - 20 * 60_000).toISOString() });
    await expect(apiClient.editMessage(old.id, 'Ny')).rejects.toThrow('Meldinger kan bare endres de første 15 minuttene.');
  });

  test('a message goes at once, with no «Angre» bar to wait for', async () => {
    await renderWithProviders(<ChatScreen conversation={emma()} onBack={() => {}} />);
    const before = chatRepository.getMessages('c-emma').length;
    await fireEvent.changeText(screen.getByLabelText('Melding til Emma'), 'Kommer om litt');
    await fireEvent(screen.getByLabelText('Melding til Emma'), 'submitEditing');
    await waitFor(() => expect(chatRepository.getMessages('c-emma').length).toBe(before + 1));
    expect(screen.queryByTestId('undo-send')).toBeNull();
  });

  test('my own message can be edited and deleted for 15 minutes, not after', () => {
    const now = Date.parse('2026-11-15T12:00:00Z');
    const at = (minutesAgo: number) => ({ kind: 'TEXT', createdAt: new Date(now - minutesAgo * 60_000).toISOString() });
    expect(canDeleteMessage(at(12), true, now)).toBe(true);
    expect(canEditMessage(at(12), true, now)).toBe(true);
    expect(canDeleteMessage(at(16), true, now)).toBe(false);
    expect(canEditMessage(at(16), true, now)).toBe(false);
    // never someone else's
    expect(canDeleteMessage(at(1), false, now)).toBe(false);
    // a photo can be deleted but not edited
    expect(canDeleteMessage({ ...at(1), kind: 'IMAGE' }, true, now)).toBe(true);
    expect(canEditMessage({ ...at(1), kind: 'IMAGE' }, true, now)).toBe(false);
    expect(nb.chat.deleteMessageSub).toBe('De første 15 minuttene');
  });

  test('the address can only be shared with an avtale', async () => {
    await expect(apiClient.shareAddress('c-emma', 'Storgata 1')).rejects.toThrow('Del adressen først når dere har en avtale.');
    await apiClient.shareAddress('c-martin', 'Storgata 1', 'Ring på hos Hansen');
    expect(await apiClient.conversationAddresses('c-martin')).toMatchObject([{ address: 'Storgata 1', note: 'Ring på hos Hansen' }]);
    await apiClient.revokeAddress('c-martin');
    expect(await apiClient.conversationAddresses('c-martin')).toEqual([]);
  });

  test('a planned message shows above the field and can be cancelled', async () => {
    await apiClient.scheduleMessage('c-emma', 'God morgen!', new Date(Date.now() + 3_600_000).toISOString());
    await renderWithProviders(<ChatScreen conversation={emma()} onBack={() => {}} />);
    expect(await screen.findByText('1 planlagt melding')).toBeTruthy();
    await fireEvent.press(screen.getByText('Avbryt'));
    await waitFor(() => expect(inbox.scheduled).toEqual([]));
  });

  test('a text can be saved as one of my quick replies and sent with a tap', async () => {
    await renderWithProviders(<ChatScreen conversation={emma()} onBack={() => {}} />);
    await fireEvent.changeText(screen.getByLabelText('Melding til Emma'), 'Ses snart!');
    await fireEvent.press(screen.getByText('Lagre som hurtigsvar'));
    expect(await screen.findByLabelText('Mine hurtigsvar: Ses snart!')).toBeTruthy();
  });

  test('a PDF must be a PDF', async () => {
    await expect(apiClient.sendFile('c-emma', 'x/virus.exe', 'FILE', 'virus.exe')).rejects.toThrow('Bare PDF-filer kan sendes.');
    await apiClient.sendFile('c-emma', 'x/tilbud.pdf', 'FILE', 'tilbud.pdf');
    expect(chatRepository.getMessages('c-emma').slice(-1)[0]).toMatchObject({ attachmentKind: 'FILE', fileName: 'tilbud.pdf' });
  });
});
