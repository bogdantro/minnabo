import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { flipId, savedKeys, useToggleSavedListing } from '@/api/queries';

const setup = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  qc.setQueryData(savedKeys.listings, ['l-a']);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
};

test('flipId adds or removes one id', () => {
  expect(flipId(['a', 'b'], 'b')).toEqual(['a']);
  expect(flipId(['a'], 'b')).toEqual(['a', 'b']);
});

test('the heart fills before the server answers', async () => {
  const { qc, wrapper } = setup();
  let finish: (v: string[]) => void = () => undefined;
  jest.spyOn(apiClient, 'toggleSavedListing').mockImplementation(() => new Promise((r) => (finish = r)));
  const { result } = await renderHook(() => useToggleSavedListing(), { wrapper });
  await act(async () => {
    result.current.mutate('l-b');
  });
  // the server hasn't answered yet, the screen already shows it saved
  await waitFor(() => expect(qc.getQueryData(savedKeys.listings)).toEqual(['l-a', 'l-b']));
  await act(async () => finish(['l-a', 'l-b']));
  expect(qc.getQueryData(savedKeys.listings)).toEqual(['l-a', 'l-b']);
});

test('if the server says no, it goes back to how it was', async () => {
  const { qc, wrapper } = setup();
  jest.spyOn(apiClient, 'toggleSavedListing').mockRejectedValue(new Error('offline'));
  const { result } = await renderHook(() => useToggleSavedListing(), { wrapper });
  await act(async () => {
    result.current.mutate('l-b');
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(qc.getQueryData(savedKeys.listings)).toEqual(['l-a']);
});
