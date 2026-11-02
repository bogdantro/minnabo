import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '@/api/client';
import { FellesskapScreen } from '@/screens/FellesskapScreen';
import { renderWithProviders } from '../testUtils';

afterEach(() => jest.restoreAllMocks());

test('«Bli partner» under støttespillere sends a business to «For bedrifter» on the website', async () => {
  const { Linking } = require('react-native');
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await renderWithProviders(<FellesskapScreen />);
  expect(await screen.findByTestId('partner-cta')).toBeTruthy();
  expect(screen.getByText('Driver du en bedrift i Lillehammer?')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Bli partner med MinNabo. Åpner minnaboapp.no'));
  expect(open).toHaveBeenCalledWith('https://minnaboapp.no/for-bedrifter/');
});

test('a youth account never sees it', async () => {
  jest
    .spyOn(apiClient, 'getMyAccount')
    .mockResolvedValue({ vipps: true, youth: true, age: 16, birthYear: 2010, fullName: 'Emil Nygård', phoneMasked: '+47 ••• •• 518' });
  await renderWithProviders(<FellesskapScreen />);
  await screen.findByText('Sammen gjør vi en forskjell');
  await waitFor(() => expect(screen.queryByTestId('partner-cta')).toBeNull());
});
