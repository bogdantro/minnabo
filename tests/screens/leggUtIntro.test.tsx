import { screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { LeggUtIntroScreen } from '@/screens/LeggUt/IntroScreen';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  jest.clearAllMocks();
});

test('explains how posting works and that the profile becomes visible to neighbours', async () => {
  await renderWithProviders(<LeggUtIntroScreen />);
  expect(screen.getByText('Slik legger du ut et oppdrag')).toBeTruthy();
  expect(screen.getByText(/Naboer i nærheten sender deg tilbud/)).toBeTruthy();
  expect(screen.getByText(/vises for naboer i nærheten/)).toBeTruthy();
});

test('"Kom i gang" goes straight to the task wizard', async () => {
  await renderWithProviders(<LeggUtIntroScreen />);
  await fireEvent.press(screen.getByText('Kom i gang'));
  expect(router.push).toHaveBeenCalledWith('/legg-ut/trenger-jobb');
});

test('there is no "tilby hjelp" (offer) option to pick from', async () => {
  await renderWithProviders(<LeggUtIntroScreen />);
  expect(screen.queryByText('Jeg tilbyr hjelp')).toBeNull();
});
