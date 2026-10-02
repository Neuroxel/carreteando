import { Categoria, CATEGORIAS, ConfianzaPublica, Evento, FiltrosEvento, TIPOS_EVENTO } from './types';
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
import { inferTipo } from './event-types';
import { enEscena } from './escenas';
export type EventRow = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
export function dbRowToEvento(row: EventRow): Evento | null {
  if (
    !row ||
    typeof row !== 'object' ||
    Array.isArray(row) ||
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
    // El tipo que trae la fila manda; si no trae, se infiere del texto.
    tipo:
      (TIPOS_EVENTO.find((t) => t.value === row.event_type)?.value as Evento['tipo']) ||
      inferTipo(`${title} ${description || ''}`, category),
    imagen_url: safeImageUrl(row.image_url),
    fuente:
      row.source === 'manual'
        ? 'manual'
        : row.source === 'passline'
          ? 'passline'
          : row.source === 'editorial'
            ? 'editorial'
            : 'instagram',
    fuente_url: safeWebUrl(row.instagram_url),
    organizador: str(row.username),
    organizador_url:
      typeof row.username === 'string' &&
      /^[a-zA-Z0-9_.]{1,30}$/.test(row.username) &&
      row.source === 'apify_instagram'
        ? `https://www.instagram.com/${row.username}/`
        : null,
    verificado: row.organizer_verified === true,
    confianza: confianzaPublica(row),
    activo: true,
    tags: [],
    created_at: str(row.scraped_at) || '',
    ultima_revision: parseTimestamp(row.last_verified_at)?.toISOString() || null,
    publicado_en_fuente: parseTimestamp(row.source_published_at)?.toISOString() || null,
  };
}
const OFICIALES = new Set(['pcdv-agenda', 'cinzano-agenda']);
/** De dónde viene, dicho como lo entiende cualquiera. */
export function confianzaPublica(row: EventRow): ConfianzaPublica {
  if (row.organizer_verified === true) return 'organizador';
  if (Number(row.independent_sources || 0) >= 2) return 'varias';
  if (typeof row.source_id === 'string' && OFICIALES.has(row.source_id)) return 'oficial';
  if (typeof row.source_id === 'string' && row.source_id.startsWith('portaldisc-')) return 'ticketera';
  if (row.source === 'manual') return 'comunidad';
  return 'revisado';
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
/** Formas comunes de decir lo mismo. Se busca la palabra y su equivalente. */
const SINONIMOS: Record<string, string> = {
  valpo: 'valparaiso',
  vina: 'vina del mar',
  electro: 'electronica',
  techno: 'electronica',
  tecno: 'electronica',
  reggaeton: 'reggaeton',
  perreo: 'reggaeton',
  tocatas: 'tocata',
  carrete: 'fiesta',
  stand: 'stand up',
  standup: 'stand up',
};
/**
 * Búsqueda local, en el teléfono: sin acentos ni mayúsculas, sobre nombre,
 * lugar, comuna, sector, organizador, descripción, tipo y estilo. Todas las
 * palabras tienen que aparecer (o su sinónimo).
 */
export function coincideBusqueda(e: Evento, busqueda: string) {
  const texto = normalizeText(
    [
      e.nombre,
      e.descripcion,
      e.lugar,
      e.ciudad,
      e.sector,
      e.organizador,
      TIPOS_EVENTO.find((t) => t.value === e.tipo)?.label,
      CATEGORIAS.find((c) => c.value === e.categoria)?.label,
    ]
      .filter(Boolean)
      .join(' '),
  );
  return normalizeText(busqueda)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => texto.includes(w) || (SINONIMOS[w] ? texto.includes(SINONIMOS[w]) : false));
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
      if (filters.busqueda && !coincideBusqueda(e, filters.busqueda)) return false;
      if (filters.categoria && filters.categoria !== 'todos' && filters.categoria !== e.categoria)
        return false;
      if (filters.ciudad && filters.ciudad !== 'todos' && filters.ciudad !== e.ciudad) return false;
      if (filters.tipo && filters.tipo !== 'todos' && filters.tipo !== e.tipo) return false;
      if (filters.escena && filters.escena !== 'todos' && !enEscena(e, filters.escena)) return false;
      if (
        filters.precio &&
        filters.precio !== 'todos' &&
        (e.precio_conocido !== true ||
          (filters.precio === 'gratis' ? e.precio !== 0 : e.precio <= 0))
      )
        return false;
      if (filters.fecha === 'hoy' && e.fecha !== today) return false;
      // Carlos: primero hoy, y en una segunda pestaña mañana.
      if (filters.fecha === 'manana' && e.fecha !== addDays(today, 1)) return false;
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

// A correct list can still read as one venue's microsite. Keep the chronological
// order the product promises and only intervene when the same place is about to
// take a third row in a row: then look a few rows ahead for a different one.
// The look-ahead is bounded, so a December date never jumps ahead of September,
// and nothing is hidden — every event still appears.
export function diversifyByVenue<T extends { lugar?: string | null }>(
  events: T[],
  run = 2,
  lookahead = 4,
): T[] {
  if (events.length < 3) return events;
  const pending = [...events];
  const out: T[] = [];
  while (pending.length) {
    const recent = out.slice(-run).map((e) => e.lugar || '');
    const inARun = recent.length === run && new Set(recent).size === 1;
    let pick = 0;
    if (inARun) {
      const alt = pending.findIndex((e, i) => i < lookahead && (e.lugar || '') !== recent[0]);
      if (alt !== -1) pick = alt;
    }
    out.push(pending.splice(pick, 1)[0]);
  }
  return out;
}

// Fiestas Patrias are a fixed, short window. The surface appears on its own and
// disappears on its own; nothing is hard-coded as permanently visible.
export function esTemporadaDieciocho(today: string): boolean {
  const md = today.slice(5);
  return md >= '09-14' && md <= '09-21';
}
