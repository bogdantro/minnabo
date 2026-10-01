import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OppdragScreen } from '@/screens/OppdragScreen';
import { locationScope } from '@/lib/locationScope';
import { renderWithProviders } from '../testUtils';

const openSheet = async () => {
  await waitFor(() => expect(screen.getByText('Lillehammer kommune')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText(/Lillehammer kommune, Bare min kommune/));
  await waitFor(() => expect(screen.getByText('Hvor vil du se oppdrag?')).toBeTruthy());
};

beforeEach(async () => {
  await AsyncStorage.clear();
  locationScope._reset();
});
afterEach(() => locationScope._reset());

describe('LocationSheet (Oppdrag › Endre)', () => {
  it('lists the profile kommune and its neighbours', async () => {
    await renderWithProviders(<OppdragScreen />);
    await openSheet();
    expect(screen.getByRole('radio', { name: 'Lillehammer' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Øyer' })).toBeTruthy();
  });

  it('"Bruk posisjonen min" detects the kommune', async () => {
    await renderWithProviders(<OppdragScreen />);
    await openSheet();
    await fireEvent.press(screen.getByText('Bruk posisjonen min'));
    expect(await screen.findByText('Fant deg: Lillehammer kommune')).toBeTruthy();
  });

  it('a wider reach applies on "Vis oppdrag"', async () => {
    await renderWithProviders(<OppdragScreen />);
    await openSheet();
    await fireEvent.press(screen.getByRole('tab', { name: 'Nabokommuner' }));
    expect(screen.getByText('Lillehammer og kommunene rundt')).toBeTruthy();
    await fireEvent.press(screen.getByText('Vis oppdrag'));
    await waitFor(() => expect(locationScope.getReach()).toBe(1));
    expect(screen.getAllByText('Nabokommuner').length).toBeGreaterThan(0);
  });
});
