import { useEffect, useState } from 'react';

export interface ViewMode {
  /** Narrow portrait phones use the tall composition. */
  tall: boolean;
  narrow: boolean;
  reduced: boolean;
}

const QUERIES = {
  narrow: '(max-width: 760px)',
  portrait: '(orientation: portrait)',
  reduced: '(prefers-reduced-motion: reduce)',
} as const;

function read(): ViewMode {
  if (typeof window === 'undefined') return { tall: false, narrow: false, reduced: false };
  const narrow = window.matchMedia(QUERIES.narrow).matches;
  const portrait = window.matchMedia(QUERIES.portrait).matches;
  const reduced = window.matchMedia(QUERIES.reduced).matches;
  return { tall: narrow && portrait, narrow, reduced };
}

export function useViewMode(): ViewMode {
  const [mode, setMode] = useState<ViewMode>(read);

  useEffect(() => {
    const queries = Object.values(QUERIES).map((query) => window.matchMedia(query));
    const update = () => setMode(read());
    for (const query of queries) query.addEventListener('change', update);
    return () => {
      for (const query of queries) query.removeEventListener('change', update);
    };
  }, []);

  return mode;
}
