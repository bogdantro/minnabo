import { screen } from '@testing-library/react-native';
import { ListingListScreen } from '@/screens/ListingListScreen';
import { renderWithProviders } from '../testUtils';

// RNTL 14 + react-query: let the mock query settle on the real event loop.
const settle = () => new Promise((r) => setTimeout(r, 500));

test('task list shows the "Alle åpne oppdrag" section and only requests', async () => {
  await renderWithProviders(<ListingListScreen type="TASK_REQUEST" />);
  await settle();
  expect(screen.getByText('Oppdrag som trenger hjelp')).toBeTruthy();
  expect(screen.getByText('Alle åpne oppdrag')).toBeTruthy();
  expect(screen.getAllByText('Klippe plen').length).toBeGreaterThan(0);
  expect(screen.queryByText('Jeg kan klippe plenen din')).toBeNull();
});

test('provider list shows a "Nylig aktive" strip and only offers', async () => {
  await renderWithProviders(<ListingListScreen type="SERVICE_OFFER" />);
  await settle();
  expect(screen.getByText('Folk som tilbyr hjelp')).toBeTruthy();
  expect(screen.getByText('Nylig aktive')).toBeTruthy();
  expect(screen.getAllByText('Jeg kan klippe plenen din').length).toBeGreaterThan(0);
  expect(screen.queryByText('Klippe plen')).toBeNull();
});
