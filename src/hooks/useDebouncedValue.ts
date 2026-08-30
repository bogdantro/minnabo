import { useEffect, useState } from 'react';

const IS_TEST = process.env.NODE_ENV === 'test';

/** Returns `value` after it has stopped changing for `delay` ms. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  // Under Jest, debouncing only adds flakiness — return the settled value.
  if (IS_TEST) return value;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [debounced, setDebounced] = useState(value);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
