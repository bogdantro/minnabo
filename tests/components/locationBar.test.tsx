import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationBar } from '@/components/LocationBar';
import { locationScope } from '@/lib/locationScope';
import nb from '@/i18n/nb';
import { renderWithProviders } from '../testUtils';

const render = renderWithProviders;

beforeEach(async () => {
  await AsyncStorage.clear();
  locationScope._reset();
});
afterEach(() => locationScope._reset());

describe('LocationBar', () => {
  it('shows the profile kommune with the "kommune" suffix', async () => {
    await render(<LocationBar />);
    expect(await screen.findByText(/Lillehammer kommune/i)).toBeTruthy();
  });

  it('"Bruk posisjonen min" detects and shows the found kommune', async () => {
    await render(<LocationBar />);
    await screen.findByText(/Lillehammer kommune/i);

    await fireEvent.press(screen.getByLabelText(nb.home.changeLocation));
    await fireEvent.press(screen.getByLabelText(nb.home.useMyLocation));

    expect(
      await screen.findByText(new RegExp(nb.location.detected)),
    ).toBeTruthy();
  });

  it('picking a reach updates the visible reach label on the bar', async () => {
    await render(<LocationBar />);
    await screen.findByText(/Lillehammer kommune/i);
    // bar starts on "own kommune only"
    expect(screen.getByText(`· ${nb.location.reachOwn}`)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(nb.home.changeLocation));
    await fireEvent.press(
      screen.getByRole('button', { name: nb.location.reachNeighbours }),
    );

    // the bar's secondary line now reflects the new reach
    await waitFor(() =>
      expect(
        screen.getByText(`· ${nb.location.reachNeighbours}`),
      ).toBeTruthy(),
    );
    // and the pressed pill is the selected one
    expect(
      screen.getByRole('button', { name: nb.location.reachNeighbours }).props
        .accessibilityState,
    ).toEqual({ selected: true });
  });
});
