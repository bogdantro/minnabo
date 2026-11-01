import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '@/api/client';
import { OppdragScreen } from '@/screens/OppdragScreen';
import { locationScope } from '@/lib/locationScope';
import { renderWithProviders } from '../testUtils';

beforeEach(() => locationScope._reset());
afterEach(() => jest.restoreAllMocks());

/** The kommuner the home list last asked the server for. */
const askedFor = (spy: jest.SpyInstance) => {
  const calls = spy.mock.calls.filter((c) => c[0]?.filter?.type === 'TASK_REQUEST');
  return calls.at(-1)?.[0].filter.municipalities as string[];
};

test('«Rekkevidde» really changes which kommuner the oppdrag come from', async () => {
  const spy = jest.spyOn(apiClient, 'listListings');
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(askedFor(spy)).toEqual(['Lillehammer']));

  // open the location sheet, pick «Nabokommuner», «Vis oppdrag»
  await fireEvent.press(await screen.findByLabelText(/Bare min kommune/));
  await fireEvent.press(await screen.findByRole('tab', { name: 'Nabokommuner' }));
  await fireEvent.press(screen.getByText('Vis oppdrag'));
  await waitFor(() => expect(askedFor(spy)).toEqual(['Lillehammer', 'Øyer', 'Gausdal', 'Ringsaker', 'Gjøvik']));
  expect(locationScope.getReach()).toBe(1);

  // and «Innlandet» asks for every kommune in the county
  await fireEvent.press(await screen.findByLabelText(/Nabokommuner/));
  await fireEvent.press(await screen.findByRole('tab', { name: 'Innlandet' }));
  await fireEvent.press(screen.getByText('Vis oppdrag'));
  await waitFor(() => expect(askedFor(spy).length).toBeGreaterThan(20));
});
