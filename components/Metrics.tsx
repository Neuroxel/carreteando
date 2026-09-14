'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { track } from '../lib/metrics';
export default function Metrics() {
  const path = usePathname(),
    query = useSearchParams();
  useEffect(() => {
    if (path.startsWith('/admin')) return;
    track(
      path.startsWith('/evento/')
        ? 'event_open'
        : path.startsWith('/lugar/')
          ? 'venue_open'
          : path.startsWith('/zonas/')
            ? 'zone_open'
            : 'page_view',
    );
  }, [path]);
  useEffect(() => {
    if ((path === '/' || path === '/buscar') && query.size) track('filter');
  }, [path, query]);
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (path.startsWith('/admin')) return;
      const link = (event.target as Element)?.closest('a');
      if (!link) return;
      const url = new URL(link.href, location.origin);
      if (url.hostname === 'www.google.com' && url.pathname.startsWith('/maps'))
        track('directions');
      else if (url.origin !== location.origin && url.hostname !== 'wa.me') track('source');
    };
    document.addEventListener('click', listener);
    return () => document.removeEventListener('click', listener);
  }, [path]);
  return null;
}
