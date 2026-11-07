/**
 * Stands in for src/lib/supabase.ts under `npm run test-login`. Nothing leaves the PC: every call
 * answers «no data», so test clicks can never reach the real database.
 */
import { TEST_USER_ID, testPerson } from './store';

const session = () => (testPerson.get() ? { user: { id: TEST_USER_ID } } : null);

/** Any chain of calls (`from().select().eq()`, `channel().on().subscribe()`) ends in «no data». */
function nothing(): unknown {
  const p: unknown = new Proxy(function () {}, {
    get: (_t, key) => (key === 'then' ? (done: (v: unknown) => void) => done({ data: null, error: null }) : p),
    apply: () => p,
  });
  return p;
}

export const supabase = new Proxy(
  {
    auth: {
      getSession: async () => ({ data: { session: session() }, error: null }),
      getUser: async () => ({ data: { user: session()?.user ?? null }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: (cb: (event: string, s: unknown) => void) => {
        const stop = testPerson.subscribe(() => cb('SIGNED_IN', session()));
        return { data: { subscription: { unsubscribe: stop } } };
      },
    },
  } as Record<string, unknown>,
  { get: (target, key: string) => target[key] ?? nothing() },
) as never;
