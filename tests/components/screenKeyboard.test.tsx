import { act, screen } from '@testing-library/react-native';
import { Keyboard, Platform, Text, TextInput } from 'react-native';
import { Screen } from '@/components/ui';
import { renderWithProviders } from '../testUtils';

// Android draws edge-to-edge, so the window no longer shrinks for the keyboard: fields low on a screen
// (Legg ut steg 7, Rapporter, Uteblitt) were covered by it (reported 2026-11-03). The screen now lifts
// itself on Android, and the footer button makes room while typing, as the keyboard covers it on iOS.
const realOS = Platform.OS;
let listeners: Record<string, ((e?: unknown) => void)[]> = {};
let spy: jest.SpyInstance;
beforeEach(() => {
  listeners = {};
  spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, cb: (e?: unknown) => void) => {
    (listeners[name] ??= []).push(cb);
    return { remove: () => undefined };
  }) as unknown as typeof Keyboard.addListener);
});
afterEach(() => {
  Platform.OS = realOS;
  spy.mockRestore();
});

const Page = () => (
  <Screen scroll footer={<Text>Neste</Text>}>
    <TextInput accessibilityLabel="Annet praktisk" />
  </Screen>
);
const fire = (name: string) => act(async () => listeners[name]?.forEach((cb) => cb()));

test('on Android the footer button makes room while the keyboard is up', async () => {
  Platform.OS = 'android';
  await renderWithProviders(<Page />);
  expect(screen.getByText('Neste')).toBeTruthy();
  await fire('keyboardDidShow');
  expect(screen.queryByText('Neste')).toBeNull();
  await fire('keyboardDidHide');
  expect(screen.getByText('Neste')).toBeTruthy();
});

test('on iOS the footer stays: the scroll view adjusts for the keyboard itself', async () => {
  Platform.OS = 'ios';
  await renderWithProviders(<Page />);
  await fire('keyboardWillShow');
  expect(screen.getByText('Neste')).toBeTruthy();
});
