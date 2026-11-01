import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { usePullRefresh } from '@/components/ui';

test('a pull refetches what is on screen and the spinner stops when it is done', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: Infinity } } });
  const fetch = jest.fn().mockResolvedValue('ok');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const { result } = await renderHook(
    () => {
      useQuery({ queryKey: ['on-screen'], queryFn: fetch });
      return usePullRefresh();
    },
    { wrapper },
  );
  await act(async () => undefined);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(result.current.refreshing).toBe(false);

  await act(async () => result.current.onRefresh());
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(result.current.refreshing).toBe(false);
});

test('a failed refetch still stops the spinner', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: Infinity } } });
  const fetch = jest.fn().mockResolvedValueOnce('ok').mockRejectedValue(new Error('offline'));
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const { result } = await renderHook(
    () => {
      useQuery({ queryKey: ['on-screen'], queryFn: fetch });
      return usePullRefresh();
    },
    { wrapper },
  );
  await act(async () => undefined);
  await act(async () => result.current.onRefresh());
  expect(result.current.refreshing).toBe(false);
});
