/**
 * Who is logged in under `npm run test-login`. Kept in the browser, so a reload keeps you logged in.
 * Only ever bundled by that command: see dev/test-login/metro.js.
 */
export type TestPerson = 'adult' | 'youth';

const KEY = 'minnabo.testPerson';
export const TEST_USER_ID = 'u-mb';

const read = (): TestPerson | null => {
  const v = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
  return v === 'adult' || v === 'youth' ? v : null;
};

let person = read();
const listeners = new Set<() => void>();

export const testPerson = {
  get: () => person,
  set(next: TestPerson | null) {
    person = next;
    if (next) localStorage.setItem(KEY, next);
    else localStorage.removeItem(KEY);
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
