import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Audio from 'expo-audio';
import { ChatScreen } from '@/screens/ChatScreen';
import { formatClip } from '@/components/chat/Voice';
import { chatRepository } from '@mocks/data/chatRepository';
import { toast } from '@/lib/toast';
import { renderWithProviders } from '../testUtils';

// jest has no storage: the "uploaded" clip keeps its phone path
jest.mock('@/lib/uploads', () => ({
  ...jest.requireActual('@/lib/uploads'),
  uploadVoice: jest.fn(async (uri: string) => ({ path: uri, publicUrl: '', localUri: uri })),
}));

const g = globalThis as { __recordedMs?: number };

beforeEach(() => {
  chatRepository._reset();
  g.__recordedMs = 4200;
  jest.clearAllMocks();
});

const open = async () => {
  await renderWithProviders(<ChatScreen conversation={chatRepository.getConversation('c-sara')!} onBack={() => {}} />);
  return screen.findByLabelText('Spill inn talemelding');
};

test('formatClip reads like a clock', () => {
  expect(formatClip(7200)).toBe('0:07');
  expect(formatClip(83000)).toBe('1:23');
  expect(formatClip(120000)).toBe('2:00');
});

test('record a talemelding and send it: it lands in the chat with its length', async () => {
  await fireEvent.press(await open());
  expect(await screen.findByTestId('voice-recording')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Send talemelding'));
  await waitFor(() => expect(chatRepository.getMessages('c-sara').at(-1)?.kind).toBe('AUDIO'));
  expect(chatRepository.getMessages('c-sara').at(-1)?.audioMs).toBe(4200);
  expect(await screen.findByLabelText('Spill av talemelding, 0:04')).toBeTruthy();
  // back to the normal composer
  expect(screen.queryByTestId('voice-recording')).toBeNull();
});

test('the microphone only shows while the text field is empty', async () => {
  await open();
  await fireEvent.changeText(screen.getByLabelText(/^Melding til/), 'Hei');
  expect(screen.queryByLabelText('Spill inn talemelding')).toBeNull();
  expect(screen.getByLabelText('Send melding')).toBeTruthy();
});

test('a mis-tap shorter than a second is not sent', async () => {
  g.__recordedMs = 400;
  const info = jest.spyOn(toast, 'info');
  const before = chatRepository.getMessages('c-sara').length;
  await fireEvent.press(await open());
  await fireEvent.press(await screen.findByLabelText('Send talemelding'));
  await waitFor(() => expect(info).toHaveBeenCalledWith(expect.stringMatching(/for kort/), expect.anything()));
  expect(chatRepository.getMessages('c-sara')).toHaveLength(before);
});

test('«Avbryt» throws the recording away', async () => {
  const before = chatRepository.getMessages('c-sara').length;
  await fireEvent.press(await open());
  await fireEvent.press(await screen.findByLabelText('Avbryt opptaket'));
  await waitFor(() => expect(screen.queryByTestId('voice-recording')).toBeNull());
  expect(chatRepository.getMessages('c-sara')).toHaveLength(before);
});

test('no microphone access: a calm explanation with a way to the settings, nothing recorded', async () => {
  (Audio.requestRecordingPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
  const err = jest.spyOn(toast, 'error');
  await fireEvent.press(await open());
  await waitFor(() =>
    expect(err).toHaveBeenCalledWith(expect.stringMatching(/tilgang til mikrofonen/), expect.objectContaining({ action: expect.anything() })),
  );
  expect(screen.queryByTestId('voice-recording')).toBeNull();
});

test('at 2 minutes the talemelding is sent by itself, once', async () => {
  g.__recordedMs = 2 * 60 * 1000;
  const before = chatRepository.getMessages('c-sara').length;
  await fireEvent.press(await open());
  await waitFor(() => expect(chatRepository.getMessages('c-sara')).toHaveLength(before + 1));
  expect(chatRepository.getMessages('c-sara').at(-1)?.audioMs).toBe(120000);
});
