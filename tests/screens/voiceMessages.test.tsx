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

// ------------------------------------------------------------
// Playing a talemelding closed the app (reported 2026-11-03): an error from the native
// player in a tap handler is fatal in a release build. It must become a calm message.
// ------------------------------------------------------------
describe('playing a talemelding never closes the app', () => {
  const { VoiceBubble } = jest.requireActual('@/components/chat/Voice') as typeof import('@/components/chat/Voice');
  const player = () => (Audio.useAudioPlayer as unknown as () => { play: jest.Mock })();
  const tapPlay = async () => fireEvent.press(screen.getByLabelText(/Spill av talemelding|Spill av/));

  test('a clip without a real address is not handed to the player', async () => {
    const err = jest.spyOn(toast, 'error');
    await renderWithProviders(<VoiceBubble uri="conv-1/clip.m4a" ms={4200} mine={false} />);
    await tapPlay();
    expect(player().play).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledWith('Talemeldingen kunne ikke spilles av akkurat nå. Prøv igjen om litt.');
  });

  test('a player that throws shows the message instead of crashing', async () => {
    const err = jest.spyOn(toast, 'error');
    player().play.mockImplementationOnce(() => {
      throw new Error('native player failed');
    });
    await renderWithProviders(<VoiceBubble uri="https://x.supabase.co/clip.m4a?token=1" ms={4200} mine />);
    await tapPlay();
    await waitFor(() => expect(err).toHaveBeenCalled());
  });

  test('a normal clip sets the audio mode first, then plays', async () => {
    await renderWithProviders(<VoiceBubble uri="https://x.supabase.co/clip.m4a?token=1" ms={4200} mine={false} />);
    await tapPlay();
    await waitFor(() => expect(player().play).toHaveBeenCalledTimes(1));
    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true });
  });
});
