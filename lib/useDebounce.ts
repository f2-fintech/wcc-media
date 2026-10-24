'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce any fast-changing value (such as search text)
 *
 * @param value The value to debounce
 * @param delay Milliseconds to delay (default 300ms)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
