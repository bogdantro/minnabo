import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationScope, useLocationScope } from '@/lib/locationScope';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  // gcTime: Infinity – the default 5-minute clean-up timers kept the Jest worker alive
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })}>{children}</QueryClientProvider>
);

beforeEach(async () => {
  await AsyncStorage.clear();
  locationScope._reset();
});

it('defaults reach to 0 and derives municipalities from the profile kommune', async () => {
  const { result } = await renderHook(() => useLocationScope(), { wrapper });

  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.reach).toBe(0);
  // demo profile (seed u-mb) is Lillehammer
  expect(result.current.municipality).toBe('Lillehammer');
  expect(result.current.municipalities).toEqual(['Lillehammer']);
});

it('setReach widens the derived set and persists the preference', async () => {
  const { result } = await renderHook(() => useLocationScope(), { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));

  await act(async () => {
    result.current.setReach(1);
  });

  await waitFor(() => expect(result.current.reach).toBe(1));
  expect(result.current.municipalities.length).toBeGreaterThan(1);
  expect(result.current.municipalities).toContain('Lillehammer');
  expect(await AsyncStorage.getItem('minnabo.locationScope.reach')).toBe('1');
});

it('hydrates a persisted reach on first mount', async () => {
  await AsyncStorage.setItem('minnabo.locationScope.reach', '2');
  locationScope._reset();

  const { result } = await renderHook(() => useLocationScope(), { wrapper });

  await waitFor(() => expect(result.current.reach).toBe(2));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.municipalities.length).toBeGreaterThan(1);
});

it('getReach / setReach on the singleton stay in sync', async () => {
  expect(locationScope.getReach()).toBe(0);
  locationScope.setReach(2);
  expect(locationScope.getReach()).toBe(2);
  expect(await AsyncStorage.getItem('minnabo.locationScope.reach')).toBe('2');
  locationScope._reset();
  expect(locationScope.getReach()).toBe(0);
});

it('without a backend user (mock Vipps login) it is ready and uses a local kommune', async () => {
  const session = jest.requireActual<typeof import('@/auth/session')>('@/auth/session');
  const spy = jest
    .spyOn(session, 'useSession')
    .mockReturnValue({ userId: null, status: 'authed' } as ReturnType<typeof session.useSession>);
  try {
    const { result } = await renderHook(() => useLocationScope(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.municipality).toBeUndefined();

    await act(async () => {
      result.current.setKommune('Øyer');
    });
    await waitFor(() => expect(result.current.municipality).toBe('Øyer'));
    expect(await AsyncStorage.getItem('minnabo.locationScope.kommune')).toBe('Øyer');
  } finally {
    spy.mockRestore();
  }
});
