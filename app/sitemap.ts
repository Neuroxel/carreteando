import { MetadataRoute } from 'next';
import { getPublicEvents } from '../lib/server-events';
import { SITE_URL } from '../lib/site';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const r = await getPublicEvents();
  if (r.status === 'error') throw new Error('SITEMAP_BACKEND_UNAVAILABLE');
  return [
    ...['', '/confianza', '/como-funciona', '/zonas', '/publicar'].map((path) => ({
      url: SITE_URL + path,
    })),
    ...r.events.map((e) => ({
      url: `${SITE_URL}/evento/${e.id}`,
      ...(e.ultima_revision ? { lastModified: e.ultima_revision } : {}),
    })),
  ];
}
