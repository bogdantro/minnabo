/**
 * Reads the EXPO_PUBLIC_* variables that Expo inlines at build time.
 * No secrets here — only values that are safe to ship in the app bundle.
 * Jest mocks this module (see jest-setup.ts), so the throw never fires in tests.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Mangler EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Kopier .env.example til .env.',
  );
}

/**
 * `EXPO_PUBLIC_USE_MOCKS=true` → the app runs on the in-memory demo data
 * (tests/mocks) as the demo user Marius B., without touching Supabase.
 * Development only: ignored in release builds.
 */
const useMocks = __DEV__ && process.env.EXPO_PUBLIC_USE_MOCKS === 'true';

export const ENV = { supabaseUrl, supabaseAnonKey, useMocks } as const;
