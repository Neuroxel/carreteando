import { MetadataRoute } from 'next';
import { getPublicEvents } from '../lib/server-events';
import { getPublicVenues } from '../lib/server-venues';
import { zonaSlug, zonasDe } from '../lib/venues';
import { SITE_URL } from '../lib/site';
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fijas = ['', '/confianza', '/como-funciona', '/zonas', '/explorar', '/publicar'].map((path) => ({
    url: SITE_URL + path,
  }));
  // Sin base configurada (CI): solo las rutas fijas. En producción, un error
  // de la base lanza, y la caché sigue sirviendo el último sitemap bueno.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return fijas;
  const [r, v] = await Promise.all([getPublicEvents(), getPublicVenues()]);
  if (r.status === 'error') throw new Error('SITEMAP_BACKEND_UNAVAILABLE');
  return [
    ...fijas,
    ...r.events.map((e) => ({
      url: `${SITE_URL}/evento/${e.id}`,
      ...(e.ultima_revision ? { lastModified: e.ultima_revision } : {}),
    })),
    ...v.lugares.map((l) => ({
      url: `${SITE_URL}/lugar/${l.slug}`,
      ...(l.ultima_revision ? { lastModified: l.ultima_revision } : {}),
    })),
    // Solo zonas con sustancia: las delgadas llevan noindex y no se anuncian.
    ...zonasDe(v.lugares)
      .filter((z) => z.lugares.length >= 3)
      .map((z) => ({ url: `${SITE_URL}/zonas/${zonaSlug(z.zona)}` })),
  ];
}
