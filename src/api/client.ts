import type { ApiClient } from './ApiClient';
import { MockApiClient } from './mockClient';

const IS_TEST = process.env.NODE_ENV === 'test';

/**
 * Selects the data client. Jest always gets the in-memory `MockApiClient`.
 * The runtime app lazily loads `SupabaseApiClient` so tests never pull in
 * supabase-js.
 */
function makeClient(): ApiClient {
  if (IS_TEST) return new MockApiClient();
  const { SupabaseApiClient } =
    require('./supabaseClient') as typeof import('./supabaseClient');
  return new SupabaseApiClient();
}

export const apiClient: ApiClient = makeClient();
export type { ApiClient };
