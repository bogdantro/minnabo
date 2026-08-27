import { screen, waitFor } from '@testing-library/react-native';
import { ListingListScreen } from '@/screens/ListingListScreen';
import { activeProfiles } from '@/data/seed';
import { renderWithProviders } from '../testUtils';

test('task list shows only requests', async () => {
  await renderWithProviders(
    <ListingListScreen type="TASK_REQUEST" title="Folk som trenger hjelp" />,
  );
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  expect(screen.queryByText('Jeg kan klippe plenen din')).toBeNull();
});

test('offer list shows an active-users row and only offers', async () => {
  await renderWithProviders(
    <ListingListScreen
      type="SERVICE_OFFER"
      title="Folk som tilbyr hjelp"
      activeProfiles={activeProfiles}
    />,
  );
  await waitFor(() => expect(screen.getByText('Jeg kan klippe plenen din')).toBeTruthy());
  expect(screen.queryByText('Klippe plen')).toBeNull();
  // active users row renders the first active profile with an "Aktiv nå" label
  expect(screen.getAllByText('Aktiv nå').length).toBeGreaterThan(0);
});
