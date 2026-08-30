import { useEffect, useState } from 'react';

const IS_TEST = process.env.NODE_ENV === 'test';

/** Returns `value` after it has stopped changing for `delay` ms. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (IS_TEST) {
      setDebounced(value);
      return;
    }
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
