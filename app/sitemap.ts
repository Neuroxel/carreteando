import { MetadataRoute } from 'next';
import { getPublicEvents } from '../lib/server-events';
import { getPublicVenues } from '../lib/server-venues';
import { zonaSlug, zonasDe } from '../lib/venues';
import { SITE_URL } from '../lib/site';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [r, v] = await Promise.all([getPublicEvents(), getPublicVenues()]);
  if (r.status === 'error') throw new Error('SITEMAP_BACKEND_UNAVAILABLE');
  return [
    ...['', '/confianza', '/como-funciona', '/zonas', '/explorar', '/publicar'].map((path) => ({
      url: SITE_URL + path,
    })),
    ...r.events.map((e) => ({
      url: `${SITE_URL}/evento/${e.id}`,
      ...(e.ultima_revision ? { lastModified: e.ultima_revision } : {}),
    })),
    ...v.lugares.map((l) => ({
      url: `${SITE_URL}/lugar/${l.slug}`,
      ...(l.ultima_revision ? { lastModified: l.ultima_revision } : {}),
    })),
    ...zonasDe(v.lugares).map((z) => ({ url: `${SITE_URL}/zonas/${zonaSlug(z.zona)}` })),
  ];
}
