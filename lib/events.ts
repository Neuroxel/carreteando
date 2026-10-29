import { coincideTexto } from './busqueda';
import { Categoria, CATEGORIAS, ConfianzaPublica, Evento, FiltrosEvento, TIPOS_EVENTO } from './types';
import {
  addDays,
  extractEventTime,
  extractPriceInfo,
  inferCity,
  normalizeText,
  toChileDateString,
  fechaDeLaNoche,
  parseTimestamp,
  validIsoDate,
} from './event-extraction';
import { safeImageUrl, safeWebUrl } from './safety';
import { inferTipo } from './event-types';
import { enEscena } from './escenas';
import { sigueTrasCorte, type AhoraChile } from './temporal';
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
    fin: typeof row.event_end_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.event_end_time)
      ? row.event_end_time
      : null,
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
            : row.source === 'apify_instagram' || row.source === 'instagram'
              ? 'instagram'
              : row.source === 'facebook' || row.source === 'google'
                ? row.source
                : 'web',
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
  if (typeof row.source_id === 'string' && /^(portaldisc|ticketplus|puntoticket|evently)-/.test(row.source_id)) return 'ticketera';
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
/**
 * Búsqueda local, en el teléfono: sin acentos ni mayúsculas, sobre nombre,
 * lugar, comuna, sector, organizador, descripción, tipo y estilo. Todas las
 * palabras tienen que aparecer (o su sinónimo).
 */
export function coincideBusqueda(e: Evento, busqueda: string) {
  const texto = [
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
    .join(' ');
  return coincideTexto(texto, busqueda);
}
/**
 * Un precio desconocido nunca es barato ni gratis: solo entra lo que la fuente
 * publica. "Hasta $5.000" incluye lo gratis.
 */
export function dentroDelPresupuesto(e: Pick<Evento, 'precio' | 'precio_conocido'>, precio: NonNullable<FiltrosEvento['precio']>) {
  if (precio === 'todos') return true;
  if (e.precio_conocido !== true || typeof e.precio !== 'number' || e.precio < 0) return false;
  if (precio === 'gratis') return e.precio === 0;
  if (precio === 'pago') return e.precio > 0;
  return e.precio <= Number(precio);
}
/** Barato, sin heurística escondida: gratis o hasta $5.000 por entrada individual. */
export const TOPE_BARATO = 5000;
export function esBarato(e: Pick<Evento, 'precio' | 'precio_conocido'>) {
  return dentroDelPresupuesto(e, '5000');
}
/** Más barato primero; lo de precio desconocido va después, en su orden de siempre. */
export function ordenarPorPrecio<T extends Pick<Evento, 'precio' | 'precio_conocido'>>(eventos: T[]): T[] {
  const conocido = (e: T) => e.precio_conocido === true && typeof e.precio === 'number' && e.precio >= 0;
  return eventos
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const ca = conocido(a.e), cb = conocido(b.e);
      if (ca !== cb) return ca ? -1 : 1;
      if (ca && cb && a.e.precio !== b.e.precio) return (a.e.precio as number) - (b.e.precio as number);
      return a.i - b.i;
    })
    .map((x) => x.e);
}
/**
 * Carretes es la noche: dentro de un mismo día, lo que empieza entre las 06:00
 * y las 17:59 (un almuerzo con show, una función de cine) va después de lo
 * nocturno. No se esconde: solo deja de encabezar la cartelera.
 */
export const esDeDia = (hora: string | null | undefined) => Boolean(hora && hora >= '06:00' && hora < '18:00');
export function nocheAntes<T extends Pick<Evento, 'fecha' | 'hora'>>(eventos: T[]): T[] {
  // Partición estable por tramos consecutivos del mismo día: el orden entre días no se toca.
  const salida: T[] = [];
  for (let i = 0; i < eventos.length; ) {
    let j = i;
    while (j < eventos.length && eventos[j].fecha === eventos[i].fecha) j++;
    const tramo = eventos.slice(i, j);
    salida.push(...tramo.filter((e) => !esDeDia(e.hora)), ...tramo.filter((e) => esDeDia(e.hora)));
    i = j;
  }
  return salida;
}
export function getChileTodayStr(): string {
  return fechaDeLaNoche(new Date());
}
export function filterEvents(
  events: Evento[],
  filters: FiltrosEvento,
  today = getChileTodayStr(),
  ahora?: AhoraChile,
): Evento[] {
  return events
    .filter((e) => {
      const enCurso = ahora ? sigueTrasCorte(e, ahora) : false;
      const fechaFiltro = enCurso ? today : e.fecha;
      if (!e.activo || !validIsoDate(e.fecha) || (e.fecha < today && !enCurso)) return false;
      if (filters.busqueda && !coincideBusqueda(e, filters.busqueda)) return false;
      if (filters.categoria && filters.categoria !== 'todos' && filters.categoria !== e.categoria)
        return false;
      if (filters.ciudad && filters.ciudad !== 'todos' && filters.ciudad !== e.ciudad) return false;
      if (filters.tipo && filters.tipo !== 'todos' && filters.tipo !== e.tipo) return false;
      if (filters.escena && filters.escena !== 'todos' && !enEscena(e, filters.escena)) return false;
      if (
        filters.precio &&
        filters.precio !== 'todos' &&
        !dentroDelPresupuesto(e, filters.precio)
      )
        return false;
      // Rango de noches: manda sobre las pestañas de fecha (un evento que sigue tras el corte cuenta como hoy).
      if (filters.desde && filters.hasta) return fechaFiltro >= filters.desde && fechaFiltro <= filters.hasta;
      if (filters.fecha === 'hoy' && fechaFiltro !== today) return false;
      // Carlos: primero hoy, y en una segunda pestaña mañana.
      if (filters.fecha === 'manana' && fechaFiltro !== addDays(today, 1)) return false;
      if (filters.fecha === 'semana' && fechaFiltro > addDays(today, 7)) return false;
      if (filters.fecha === 'finde') {
        const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
        const friday = addDays(today, dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow);
        if (fechaFiltro < friday || fechaFiltro > addDays(friday, 2)) return false;
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
/**
 * Entre las 00:00 y las 04:59 la noche de ayer sigue siendo "hoy" por dentro,
 * pero el teléfono ya marca otro día: se dice "Esta noche" y el día siguiente
 * va con su nombre, nunca "Mañana" (que confunde a las 02:00).
 */
/**
 * Etiqueta de fecha en lenguaje de calendario (día civil de Chile), sin romper la
 * agrupación nocturna: `today` es la fecha de la noche (corte 05:00). En la madrugada
 * la noche en curso sigue siendo "Esta noche", el día civil que ya empezó es "Hoy" y
 * el siguiente es "Mañana" (a la 01:00 del 29, un evento del 29 a las 18:00 es "Hoy").
 */
export function eventDateLabel(date: string, today = getChileTodayStr(), madrugada = false): string {
  if (date === today) return madrugada ? 'Esta noche' : 'Hoy';
  const civil = madrugada ? addDays(today, 1) : today;
  if (date === civil) return 'Hoy';
  if (date === addDays(civil, 1)) return 'Mañana';
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * Orden de funciones: fecha de la noche y luego hora dentro de esa noche (las 00:30
 * van después de las 23:00). Una función sin hora va al final de su día: nunca se
 * inventa una hora para ordenarla.
 */
export function porFechaYHora<T extends { fecha: string; hora?: string | null; nombre?: string }>(a: T, b: T) {
  const enNoche = (h?: string | null) => {
    const m = h && /^([01]\d|2[0-3]):[0-5]\d$/.test(h) ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null;
    return m === null ? Number.POSITIVE_INFINITY : m < 5 * 60 ? m + 24 * 60 : m;
  };
  return a.fecha.localeCompare(b.fecha) || enNoche(a.hora) - enNoche(b.hora) || (a.nombre || '').localeCompare(b.nombre || '', 'es');
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

/**
 * Sugerencias cuando la búsqueda queda vacía. Si hay una comuna elegida, solo
 * de esa comuna: una selección explícita nunca se mezcla con otras comunas.
 */
export function sugerenciasPara(todos: Evento[], filtros: FiltrosEvento, today: string, cuantos = 3): Evento[] {
  const ciudad = filtros.ciudad && filtros.ciudad !== 'todos' ? filtros.ciudad : null;
  return todos
    .filter((e) => e.activo && e.fecha >= today && (!ciudad || e.ciudad === ciudad))
    .filter((e, i, all) => all.findIndex((o) => o.lugar === e.lugar && o.ciudad === e.ciudad) === i)
    .slice(0, cuantos);
}
