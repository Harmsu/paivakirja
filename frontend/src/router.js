// Pieni hash-reititin: #/day/2026-10-13 -> ['day', '2026-10-13']
import { useEffect, useState } from 'react';

const parse = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = path => { window.location.hash = path; };
