import { Evento } from './types';
import { SITE_URL } from './site';
import type { Lugar } from './venues';
/**
 * Desfase de Chile continental para una fecha y hora locales. Chile cambia de
 * horario dos veces al año y las fechas del cambio las decide el gobierno, así
 * que se le pregunta al motor de zonas horarias en vez de fijar "-03:00".
 */
export function chileOffset(date: string, time: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    timeZoneName: 'longOffset',
  }).formatToParts(guess);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT-03:00';
  const m = name.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return m ? `${m[1]}:${m[2] || '00'}` : '-03:00';
}
export function eventJsonLd(e: Evento) {
  // Sin hora conocida, la fecha sola: inventar "00:00" es peor que no decir.
  const startDate =
    e.hora && /^\d{2}:\d{2}$/.test(e.hora) ? `${e.fecha}T${e.hora}:00${chileOffset(e.fecha, e.hora)}` : e.fecha;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.nombre,
    startDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: `${SITE_URL}/evento/${encodeURIComponent(e.id)}`,
    ...(e.descripcion ? { description: e.descripcion } : {}),
    ...(e.imagen_url ? { image: [e.imagen_url] } : {}),
    ...(e.lugar
      ? {
          location: {
            '@type': 'Place',
            name: e.lugar,
            address: {
              '@type': 'PostalAddress',
              ...(e.direccion ? { streetAddress: e.direccion } : {}),
              addressLocality: e.ciudad,
              addressRegion: 'Valparaíso',
              addressCountry: 'CL',
            },
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
/** El tipo de schema.org más específico que podemos afirmar sin inventar. */
const TIPO_SCHEMA: Record<string, string> = {
  bar: 'BarOrPub',
  pub: 'BarOrPub',
  karaoke: 'BarOrPub',
  terraza: 'BarOrPub',
  club: 'NightClub',
  discoteca: 'NightClub',
  'club-electronico': 'NightClub',
  'sala-en-vivo': 'MusicVenue',
  teatro: 'PerformingArtsTheater',
  'centro-cultural': 'Place',
};
export function venueJsonLd(l: Lugar) {
  const sameAs = [l.sitio_url, l.instagram_url, l.facebook_url, l.tiktok_url].filter(
    (u): u is string => Boolean(u),
  );
  return {
    '@context': 'https://schema.org',
    '@type': TIPO_SCHEMA[l.tipo] || 'LocalBusiness',
    name: l.nombre,
    url: `${SITE_URL}/lugar/${encodeURIComponent(l.slug)}`,
    ...(l.descripcion ? { description: l.descripcion } : {}),
    ...(l.imagen_url ? { image: l.imagen_url } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(l.direccion ? { streetAddress: l.direccion } : {}),
      addressLocality: l.ciudad,
      addressRegion: 'Valparaíso',
      addressCountry: 'CL',
    },
    // Coordenadas solo si el geocodificador las resolvió con precisión de
    // dirección: un punto en el centro de la comuna sería información falsa.
    ...(l.lat !== null && l.lng !== null && l.precision_mapa === 'exacta'
      ? { geo: { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng } }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
    // Solo con fuente y fecha; nunca un precio estimado.
    ...(l.precio ? { priceRange: '$'.repeat(l.precio.nivel) } : {}),
  };
}
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
