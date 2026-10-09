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

export const ENV = { supabaseUrl, supabaseAnonKey } as const;
