import { Evento } from './types';
import { SITE_URL } from './site';
export function eventJsonLd(e: Evento) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.nombre,
    startDate: e.fecha,
    url: `${SITE_URL}/evento/${encodeURIComponent(e.id)}`,
    ...(e.descripcion ? { description: e.descripcion } : {}),
    ...(e.imagen_url ? { image: [e.imagen_url] } : {}),
    ...(e.lugar
      ? {
          location: {
            '@type': 'Place',
            name: e.lugar,
            ...(e.direccion
              ? {
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: e.direccion,
                    addressLocality: e.ciudad,
                    addressCountry: 'CL',
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(e.precio_conocido === true && e.fuente_url
      ? { offers: { '@type': 'Offer', price: e.precio, priceCurrency: 'CLP', url: e.fuente_url } }
      : {}),
    ...(e.organizador
      ? {
          organizer: {
            '@type': 'Organization',
            name: e.organizador,
            ...(e.organizador_url ? { url: e.organizador_url } : {}),
          },
        }
      : {}),
  };
}
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
