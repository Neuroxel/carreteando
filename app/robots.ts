import { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/site';
import { EXPERIMENTO } from '../lib/experimento';
export default function robots(): MetadataRoute.Robots {
  // Edición experimental: sin rastreo y sin anunciar sitemap.
  if (EXPERIMENTO) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/buscar?'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
