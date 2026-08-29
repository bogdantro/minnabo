import { ENV } from '@/lib/env';
import type { ApiClient } from './ApiClient';
import { MockApiClient } from './mockClient';

const IS_TEST = process.env.NODE_ENV === 'test';

/**
 * Selects the data client. Jest and mock mode (`EXPO_PUBLIC_USE_MOCKS=true`)
 * use the in-memory `MockApiClient`; otherwise the runtime app lazily loads
 * `SupabaseApiClient` so the mock path never pulls in supabase-js queries.
 */
function makeClient(): ApiClient {
  if (IS_TEST || ENV.useMocks) return new MockApiClient();
  const { SupabaseApiClient } =
    require('./supabaseClient') as typeof import('./supabaseClient');
  return new SupabaseApiClient();
}

export const apiClient: ApiClient = makeClient();
export type { ApiClient };
