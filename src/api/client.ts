import type { ApiClient } from './ApiClient';
import { SupabaseApiClient } from './supabaseClient';

/**
 * The app's data client — always the live Supabase backend. Jest swaps this
 * module for the in-memory `MockApiClient` (tests/mocks, see jest-setup.ts),
 * so test fixtures never end up in the app bundle.
 */
export const apiClient: ApiClient = new SupabaseApiClient();
export type { ApiClient };
