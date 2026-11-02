'use client';

import { useSyncExternalStore } from 'react';

/** A media query's current match; null during prerender and hydration, so nothing mismatches. */
export function useMedia(query: string): boolean | null {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => matchMedia(query).matches,
    () => null,
  );
}
