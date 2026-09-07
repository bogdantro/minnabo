import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationBar } from '@/components/LocationBar';
import { locationScope } from '@/lib/locationScope';
import nb from '@/i18n/nb';
import { renderWithProviders } from '../testUtils';

const render = renderWithProviders;
const openSheet = () =>
  fireEvent.press(screen.getByLabelText(new RegExp(nb.home.changeLocation)));

beforeEach(async () => {
  await AsyncStorage.clear();
  locationScope._reset();
});
afterEach(() => locationScope._reset());

describe('LocationBar (kommune pill)', () => {
  it('shows the profile kommune on the pill', async () => {
    await render(<LocationBar />);
    expect(await screen.findByText('Lillehammer')).toBeTruthy();
  });

  it('"Bruk posisjonen min" detects and shows the found kommune', async () => {
    await render(<LocationBar />);
    await screen.findByText('Lillehammer');

    await openSheet();
    await fireEvent.press(screen.getByLabelText(nb.home.useMyLocation));

    expect(await screen.findByText(new RegExp(nb.location.detected))).toBeTruthy();
  });

  it('picking a wider reach in the sheet selects it', async () => {
    await render(<LocationBar />);
    await screen.findByText('Lillehammer');

    await openSheet();
    await fireEvent.press(
      screen.getByRole('button', { name: nb.location.reachNeighbours }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: nb.location.reachNeighbours }).props
          .accessibilityState,
      ).toEqual({ selected: true }),
    );
    // the pill's a11y label now reflects the wider reach
    expect(screen.getAllByLabelText(/nabokommuner/).length).toBeGreaterThan(0);
  });
});
