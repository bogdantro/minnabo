import type { ApiClient } from './ApiClient';
import { SupabaseApiClient } from './supabaseClient';

/**
 * The app's data client: always the live Supabase backend.
 * Jest swaps this module for `MockApiClient` (see jest-setup.ts).
 */
export const apiClient: ApiClient = new SupabaseApiClient();
export type { ApiClient };
