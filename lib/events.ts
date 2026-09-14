import { Categoria, CATEGORIAS, Evento, FiltrosEvento } from './types';
import {
  addDays,
  extractEventTime,
  extractPriceInfo,
  inferCity,
  normalizeText,
  toChileDateString,
  parseTimestamp,
  validIsoDate,
} from './event-extraction';
import { safeImageUrl, safeWebUrl } from './safety';
export type EventRow = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
export function dbRowToEvento(row: EventRow): Evento | null {
  if (
    row.is_active !== true ||
    row.moderation_status !== 'approved' ||
    !validIsoDate(row.date_text)
  )
    return null;
  const id = str(row.instagram_id);
  const title = str(row.title);
  if (!id || !/^[a-zA-Z0-9_-]{1,120}$/.test(id) || !title) return null;
  const description = str(row.description) || '';
  const extracted = extractPriceInfo(description);
  const price =
    typeof row.price_clp === 'number' && Number.isInteger(row.price_clp) && row.price_clp >= 0
      ? row.price_clp
      : null;
  const text = normalizeText(title + ' ' + description);
  const category = CATEGORIAS.find((c) => c.value === row.category)?.value || detectCategory(text);
  return {
    id,
    nombre: title,
    descripcion: description,
    fecha: row.date_text,
    hora: Object.hasOwn(row, 'event_time')
      ? typeof row.event_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.event_time)
        ? row.event_time
        : null
      : extractEventTime(description),
    lugar: str(row.venue),
    direccion: str(row.address),
    ciudad: str(row.city) || inferCity(str(row.location) || ''),
    precio: price ?? extracted.price,
    precio_conocido: price !== null || extracted.known,
    precio_texto:
      str(row.price_text) ||
      (price !== null
        ? price === 0
          ? 'Entrada liberada'
          : `$${price.toLocaleString('es-CL')}`
        : extracted.text),
    categoria: category,
    imagen_url: safeImageUrl(row.image_url),
    fuente:
      row.source === 'manual' ? 'manual' : row.source === 'passline' ? 'passline' : 'instagram',
    fuente_url: safeWebUrl(row.instagram_url),
    organizador: str(row.username),
    organizador_url:
      typeof row.username === 'string' &&
      /^[a-zA-Z0-9_.]{1,30}$/.test(row.username) &&
      row.source === 'apify_instagram'
        ? `https://www.instagram.com/${row.username}/`
        : null,
    verificado: row.organizer_verified === true,
    activo: true,
    tags: [],
    created_at: str(row.scraped_at) || '',
    ultima_revision: parseTimestamp(row.last_verified_at)?.toISOString() || null,
    publicado_en_fuente: parseTimestamp(row.source_published_at)?.toISOString() || null,
  };
}
export function detectCategory(textValue: string): Categoria {
  const text = normalizeText(textValue);
  if (/universitari|mechoneo/.test(text)) return 'universitario';
  if (/under|post.punk|darkwave/.test(text)) return 'under';
  if (/techno|house|electronic|rave|dj set/.test(text)) return 'electronica';
  if (/cumbia|salsa|pachanga/.test(text)) return 'cumbia';
  if (/reggaeton|perreo/.test(text)) return 'reggaeton';
  if (/rock|tocata|punk|metal/.test(text)) return 'rock';
  return 'otro';
}
export function getChileTodayStr(): string {
  return toChileDateString(new Date());
}
export function filterEvents(
  events: Evento[],
  filters: FiltrosEvento,
  today = getChileTodayStr(),
): Evento[] {
  return events
    .filter((e) => {
      if (!e.activo || !validIsoDate(e.fecha) || e.fecha < today) return false;
      if (
        filters.busqueda &&
        !normalizeText(
          `${e.nombre} ${e.descripcion || ''} ${e.lugar || ''} ${e.ciudad} ${e.organizador || ''}`,
        ).includes(normalizeText(filters.busqueda))
      )
        return false;
      if (filters.categoria && filters.categoria !== 'todos' && filters.categoria !== e.categoria)
        return false;
      if (filters.ciudad && filters.ciudad !== 'todos' && filters.ciudad !== e.ciudad) return false;
      if (
        filters.precio &&
        filters.precio !== 'todos' &&
        (e.precio_conocido !== true ||
          (filters.precio === 'gratis' ? e.precio !== 0 : e.precio <= 0))
      )
        return false;
      if (filters.fecha === 'hoy' && e.fecha !== today) return false;
      if (filters.fecha === 'semana' && e.fecha > addDays(today, 7)) return false;
      if (filters.fecha === 'finde') {
        const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
        const friday = addDays(today, dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow);
        if (e.fecha < friday || e.fecha > addDays(friday, 2)) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        (a.hora || '99:99').localeCompare(b.hora || '99:99') ||
        a.nombre.localeCompare(b.nombre),
    );
}
export function eventDateLabel(date: string, today = getChileTodayStr()): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, 1)) return 'Mañana';
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}
