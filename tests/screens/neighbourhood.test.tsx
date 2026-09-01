import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { NeighbourhoodScreen } from '@/screens/NeighbourhoodScreen';
import { neighbourhood } from '@/lib/neighbourhood';
import { renderWithProviders } from '../testUtils';

beforeEach(() => neighbourhood._reset());

test('joining a neighbourhood shows the group and a member count', async () => {
  await renderWithProviders(<NeighbourhoodScreen />);

  await fireEvent.changeText(
    await screen.findByLabelText('Navn på nabolag / borettslag'),
    'Sørgården borettslag',
  );
  await fireEvent.press(screen.getByText('Bli med'));

  await waitFor(() => expect(screen.getByText('Sørgården borettslag')).toBeTruthy());
  expect(neighbourhood.get()).toBe('Sørgården borettslag');
  expect(screen.getByText(/naboer er med/)).toBeTruthy();
});
