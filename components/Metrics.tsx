'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { track, trackLater } from '../lib/metrics';
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
    // /buscar dejó de ser una página: filtrar ocurre en la portada y en /explorar.
    if (path !== '/' && path !== '/explorar') return;
    if (query.get('vista') === 'mapa') trackLater('map_open');
    else if (query.get('q')) trackLater('search');
    else if (query.size) trackLater('filter');
  }, [path, query]);
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (path.startsWith('/admin')) return;
      const link = (event.target as Element)?.closest('a');
      if (!link) return;
      const url = new URL(link.href, location.origin);
      const comoLlegar =
        (url.hostname === 'www.google.com' && url.pathname.startsWith('/maps')) ||
        (url.hostname.endsWith('openstreetmap.org') && url.pathname.startsWith('/directions'));
      const instagram = /(^|\.)instagram\.com$/.test(url.hostname);
      const social = /(^|\.)(facebook|tiktok)\.com$/.test(url.hostname);
      if (comoLlegar) track('directions');
      else if (instagram) track('instagram_click');
      else if (social) track('social_click');
      else if (url.origin !== location.origin && url.hostname !== 'wa.me') track('source');
    };
    document.addEventListener('click', listener);
    return () => document.removeEventListener('click', listener);
  }, [path]);
  return null;
}
