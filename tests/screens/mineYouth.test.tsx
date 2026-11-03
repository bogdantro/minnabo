import { screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '@/api/client';
import { MyListingsScreen } from '@/screens/MyListingsScreen';
import { renderWithProviders } from '../testUtils';

// A youth account has no oppdrag (0084): «Mine» shows only what they offer, without the oppdrag tab or «+».
test('Mine for a youth account shows only «Tilbyr hjelp»', async () => {
  jest
    .spyOn(apiClient, 'getMyAccount')
    .mockResolvedValue({ vipps: true, youth: true, age: 16, birthYear: 2010, fullName: 'Emil Nygård', phoneMasked: '+47 ••• •• 518' });
  await renderWithProviders(<MyListingsScreen />);
  // the «+» (Legg ut ny oppdrag) is there until the account is known to be a youth
  await waitFor(() => expect(screen.queryByLabelText('Legg ut ny')).toBeNull());
  expect(screen.queryByText('Oppdrag')).toBeNull();
  jest.restoreAllMocks();
});
