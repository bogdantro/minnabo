import { waitFor } from '@testing-library/react-native';
import { apiClient } from '@/api/client';
import { useCurrentUser, type CurrentUser } from '@/hooks/useCurrentUser';
import { renderWithProviders } from '../testUtils';

afterEach(() => jest.restoreAllMocks());

/** Renders useCurrentUser and keeps every value it reported, render by render. */
async function track() {
  const seen: CurrentUser[] = [];
  function Probe() {
    seen.push(useCurrentUser());
    return null;
  }
  await renderWithProviders(<Probe />);
  return seen;
}

const YOUTH = { vipps: true, youth: true, age: 16, birthYear: 2010, fullName: 'Emil Nygård', phoneMasked: '' };

test('a youth account is never reported as a ready adult, not even for the first render after login', async () => {
  jest.spyOn(apiClient, 'getMyAccount').mockResolvedValue(YOUTH);
  const seen = await track();
  await waitFor(() => expect(seen[seen.length - 1].isYouth).toBe(true));
  // "ready" with isYouth false is what sends a youth to the adult tabs or /oppsett
  expect(seen.filter((u) => u.accountReady && !u.isYouth)).toEqual([]);
});

test('a youth account without a name from Vipps is still a youth account', async () => {
  jest.spyOn(apiClient, 'getMyAccount').mockResolvedValue({ ...YOUTH, fullName: undefined });
  const seen = await track();
  await waitFor(() => expect(seen[seen.length - 1].accountReady).toBe(true));
  expect(seen[seen.length - 1].isYouth).toBe(true);
});
