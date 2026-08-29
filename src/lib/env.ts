/**
 * Reads the EXPO_PUBLIC_* variables that Expo inlines at build time.
 * No secrets here — only values that are safe to ship in the app bundle.
 * Jest mocks this module (see jest-setup.ts), so the throw never fires in tests.
 */

/**
 * When true, the app runs entirely against the in-memory mock data layer and
 * skips login (auto "signed in" as the demo user). Flip to false in `.env`
 * once the Supabase backend is migrated + seeded — see BACKEND.md.
 */
const useMocks = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? (useMocks ? 'https://mock.local' : undefined);
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? (useMocks ? 'mock-anon-key' : undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Mangler EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Kopier .env.example til .env.',
  );
}

export const ENV = { supabaseUrl, supabaseAnonKey, useMocks } as const;
