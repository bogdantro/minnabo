import { screen, waitFor } from '@testing-library/react-native';

// A kommune-less profile: `useLocationScope` reports ready with an empty
// municipality list. Screens must then fall open to every kommune — never
// stay stuck on the loading state, and never flash a scoped list.
jest.mock('@/lib/locationScope', () => ({
  ...jest.requireActual('@/lib/locationScope'),
  useLocationScope: () => ({
    municipality: undefined,
    municipalities: [],
    reach: 0,
    setReach: () => undefined,
    setKommune: () => undefined,
    ready: true,
  }),
}));

import { SeeAllScreen } from '@/screens/SeeAllScreen';
import { renderWithProviders } from '../testUtils';

test('a kommune-less profile falls open to tasks from every kommune', async () => {
  await renderWithProviders(<SeeAllScreen />);

  // a Lillehammer task
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy(), {
    timeout: 6000,
  });
  // and tasks that the Lillehammer scope would normally filter out
  await waitFor(
    () => expect(screen.getByText('Vaskehjelp før visning')).toBeTruthy(), // Øyer
    { timeout: 6000 },
  );
});
