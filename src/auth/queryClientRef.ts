import type { QueryClient } from '@tanstack/react-query';

/** The app's QueryClient, set once in `app/_layout.tsx`, so sign-out can empty the cache. */
export const queryClientRef: { current: QueryClient | null } = { current: null };
