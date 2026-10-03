import type { ApiClient } from './ApiClient';
import { ENV } from '@/lib/env';
import { SupabaseApiClient } from './supabaseClient';

/**
 * The app's data client — the live Supabase backend, or the in-memory demo data
 * when `EXPO_PUBLIC_USE_MOCKS=true` (dev only, see lib/env.ts). Jest swaps this
 * module for `MockApiClient` itself (see jest-setup.ts).
 */
function createClient(): ApiClient {
  if (ENV.useMocks) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MockApiClient } = require('../../tests/mocks/mockClient');
    return new MockApiClient() as ApiClient;
  }
  return new SupabaseApiClient();
}

export const apiClient: ApiClient = createClient();
export type { ApiClient };
