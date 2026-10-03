import feed from '../data/editorial-events.json';
import { validIsoDate, toChileDateString, addDays } from './event-extraction';
import { eventKey } from './event-identity';
import { safeImageUrl, safeWebUrl } from './safety';
import { CIUDADES, CATEGORIAS } from './types';
// Version-controlled operator approvals, not auto-approval of scraped/anonymous input.
// Import-only: subsequent runs must never overwrite withdrawals or editorial corrections.
/** Una imagen sin origen declarado no entra: la base lo exige y tiene razón. */
export function imagenConOrigen(
  imagen: unknown,
  fuente: string,
  kind: 'ticketera' | 'arte_oficial' | 'flyer_oficial' = 'ticketera',
) {
  const url = safeImageUrl(imagen);
  if (!url) return { image_url: null, image_source_url: null, image_kind: null };
  return {
    image_url: url,
    image_source_url: fuente,
    image_kind: kind,
    image_verified_at: new Date().toISOString(),
  };
}
export function editorialRows(now = new Date()) {
  const today = toChileDateString(now);
  return feed
    .filter(
      (e) =>
        e.review_decision === 'approved' &&
        (e.time === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)) &&
        validIsoDate(e.date) &&
        e.date >= today &&
        e.date <= addDays(today, 90) &&
        CIUDADES.includes(e.city) &&
        CATEGORIAS.some((c) => c.value === e.category) &&
        /^curated-[a-z0-9-]+$/.test(e.id) &&
        Number.isFinite(Date.parse(e.reviewed_at)) &&
        Date.parse(e.reviewed_at) <= now.getTime() + 300000 &&
        now.getTime() - Date.parse(e.reviewed_at) < 7 * 86400000 &&
        safeWebUrl(e.source_url) &&
        [
          'www.passline.com',
          'ticketplus.cl',
          'www.vesti.cl',
          'vesti.cl',
          'www.portaldisc.com',
          // Organización oficial del evento y prensa regional que lo confirma:
          // el puente manual cuando la ticketera no deja leerse.
          'miltambores.cl',
          'www.valparaisonoticias.cl',
          'g5noticias.cl',
        ].includes(
          new URL(e.source_url).hostname,
        ) &&
        e.title &&
        e.venue &&
        (e.price_clp === null ||
          (Number.isInteger(e.price_clp) && e.price_clp >= 0 && e.price_clp <= 500000)),
    )
    .map((e) => ({
      instagram_id: e.id,
      title: e.title,
      description: e.description,
      date_text: e.date,
      event_time: e.time,
      location: `${e.venue} · ${e.city}`,
      venue: e.venue,
      city: e.city,
      address: e.address,
      price_clp: e.price_clp,
      price_text: e.price_text,
      category: e.category,
      instagram_url: e.source_url,
      // La procedencia viaja con la imagen. Sin esto, la restricción de la base
      // rechazaba el import completo y la ingesta diaria caía con DB_EDITORIAL.
      ...imagenConOrigen(
        e.image_url,
        e.source_url,
        new URL(e.source_url).hostname === 'miltambores.cl' ? 'arte_oficial' : 'ticketera',
      ),
      // Un "momento" agrupa eventos de una misma ocasión (Mil Tambores, Año Nuevo).
      moment: (e as { moment?: string }).moment ?? null,
      username: e.organizer,
      source: new URL(e.source_url).hostname === 'www.passline.com' ? 'passline' : 'editorial',
      source_published_at: null,
      scraped_at: now.toISOString(),
      reviewed_at: e.reviewed_at,
      last_verified_at: e.reviewed_at,
      is_active: true,
      moderation_status: 'approved',
      organizer_verified: false,
      event_key: eventKey(e.venue_id, e.date, e.title),
    }));
}
