import 'server-only';
import { cache } from 'react';
import { dbRowToEvento, EventRow } from './events';
import { addDays, fechaDeLaNoche } from './event-extraction';
import { ahoraEnChile, sigueTrasCorte } from './temporal';
import { Evento } from './types';
export type EventsResult =
  | { status: 'ok'; events: Evento[]; checkedAt: string }
  | { status: 'error'; events: []; checkedAt: string };
/** Columnas de antes de 20261029040057 (sin event_end_time): respaldo si el código llega antes que la migración. */
const COLUMNS_LEGADO =
  'instagram_id,title,description,date_text,location,image_url,instagram_url,username,scraped_at,source,is_active,moderation_status,source_published_at,last_verified_at,city,venue,address,event_time,price_clp,price_text,category,organizer_verified,event_type,source_id,independent_sources';
const COLUMNS =
  'instagram_id,title,description,date_text,location,image_url,instagram_url,username,scraped_at,source,is_active,moderation_status,source_published_at,last_verified_at,city,venue,address,event_time,event_end_time,price_clp,price_text,category,organizer_verified,event_type,source_id,independent_sources';
/**
 * Lecturas públicas cacheadas en el servidor (5 minutos, etiqueta
 * 'public-snapshot'). La ingesta y la moderación invalidan la etiqueta, así que
 * un cambio real se ve al tiro y una visita normal no toca la base.
 */
export const PUBLIC_CACHE = { revalidate: 300, tags: ['public-snapshot'] };
export async function readEvents(id?: string): Promise<EventsResult> {
  const checkedAt = new Date().toISOString();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Lectura solo del servidor. Con la clave secreta, la política RLS (que corta la
  // fecha a medianoche) no esconde la noche del sábado antes de las 05:00; los
  // filtros públicos van explícitos en la consulta y la clave nunca llega al cliente.
  const secreta = process.env.SUPABASE_SECRET_KEY;
  const key = secreta?.startsWith('sb_secret_')
    ? secreta
    : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: 'error', events: [], checkedAt };
  const today = fechaDeLaNoche(checkedAt);
  const previous = addDays(today, -1);
  const query = new URLSearchParams({
    select: COLUMNS,
    is_active: 'eq.true',
    moderation_status: 'eq.approved',
    or: `(date_text.gte.${today},and(date_text.eq.${previous},event_end_time.not.is.null))`,
    order: 'date_text.asc,instagram_id.asc',
    limit: id ? '1' : '300',
  });
  if (id) query.set('instagram_id', `eq.${id}`);
  const pedir = (q: URLSearchParams) =>
    fetch(`${url}/rest/v1/events?${q}`, {
      headers: { apikey: key },
      // La fecha de hoy va en la URL: al cambiar el día cambia la clave de caché
      // y nunca se reviven eventos vencidos.
      next: PUBLIC_CACHE,
      signal: AbortSignal.timeout(8000),
    });
  try {
    let response = await pedir(query);
    // Base aún sin la columna (la migración no se aplicó): la consulta de siempre, sin
    // la excepción de cierre verificado. Nunca deja la cartelera vacía por el orden de despliegue.
    if (response.status === 400) {
      const cuerpo = await response.text().catch(() => '');
      if (/event_end_time|42703/.test(cuerpo)) {
        const legado = new URLSearchParams(query);
        legado.set('select', COLUMNS_LEGADO);
        legado.delete('or');
        legado.set('date_text', `gte.${today}`);
        response = await pedir(legado);
      }
    }
    if (!response.ok) return { status: 'error', events: [], checkedAt };
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return { status: 'error', events: [], checkedAt };
    const events = rows
      .map((row) => dbRowToEvento(row as EventRow))
      .filter((e): e is Evento => e !== null)
      .filter((e) => e.fecha >= today || sigueTrasCorte(e, ahoraEnChile(new Date(checkedAt))));
    // A successful [] is authoritative. Never resurrect browser or process caches.
    return { status: 'ok', events, checkedAt };
  } catch {
    return { status: 'error', events: [], checkedAt };
  }
}
export const getPublicEvents = cache(() => readEvents());
export const getPublicEvent = cache(async (id: string) =>
  /^[a-zA-Z0-9_-]{1,120}$/.test(id)
    ? readEvents(id)
    : ({ status: 'ok', events: [], checkedAt: new Date().toISOString() } as EventsResult),
);
