import { fechaDeLaNoche, toChileDateString } from '../event-extraction';
import { detectCategory } from '../events';
import { ADAPTERS, MANUAL_SOURCES, SOURCES } from './registry';
import { clasificar, type Relevancia } from './relevance';
import { authorityOf, originGroupOf, statusFromText } from './evidence';
import { hostPermitido } from '../image-hosts';
import { horasCompatibles } from '../occurrence';
import { PLAZO_AGOTADO, SourceError, type EventCandidate, type Fetcher, type SourceDefinition } from './types';
const USER_AGENT = 'CarreteandoBot/1.0 (+https://dondesalgo.vercel.app/confianza)';
const MAX_BYTES = 3_000_000;
export const httpFetcher: Fetcher = async (url, init) => {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { ...(init?.headers || {}), 'User-Agent': USER_AGENT, Accept: 'application/json, text/html;q=0.9' },
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new SourceError('RED');
  }
  const body = await response.text();
  if (body.length > MAX_BYTES) throw new SourceError('RESPUESTA_DEMASIADO_GRANDE');
  return { status: response.status, body };
};
export function normalizedTitle(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
/** Two listings of the same night rarely share a title exactly; they do share most of it. */
export function looksLikeSameEvent(a: string, b: string) {
  const left = new Set(normalizedTitle(a).split(' ').filter((w) => w.length > 3));
  const right = new Set(normalizedTitle(b).split(' ').filter((w) => w.length > 3));
  if (!left.size || !right.size) return normalizedTitle(a) === normalizedTitle(b);
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size) >= 0.6;
}
export type Decision = 'publicar' | 'revisar' | 'duplicado' | 'descartado';
/**
 * The count of events is never the goal. A row only goes public when the source
 * speaks for the venue, the date is structured rather than guessed, and nobody
 * has already published the same night.
 */
export function horizonDays(today: string, date: string) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
export function decide(
  candidate: EventCandidate,
  source: SourceDefinition,
  today: string,
  relevance: Relevancia | null = null,
): { decision: Decision; reason: string } {
  if (candidate.date < today) return { decision: 'descartado', reason: 'fecha pasada' };
  if (!candidate.title || candidate.title.length < 4)
    return { decision: 'descartado', reason: 'título insuficiente' };
  // A municipal note about "el 4 de septiembre" is almost always last year's
  // news, not next year's party. A date far out from a weak source is a parse
  // failure wearing a calendar.
  const horizon = horizonDays(today, candidate.date);
  const maxHorizon = candidate.confidence === 'high' ? 365 : 120;
  if (horizon > maxHorizon)
    return { decision: 'descartado', reason: 'fecha demasiado lejana para la evidencia disponible' };
  // Una universidad o un directorio traen veinte seminarios por cada tocata:
  // en esas fuentes lo claramente ajeno a la noche no llega ni a la cola.
  if (source.relevanceFilter && relevance === 'IRRELEVANT')
    return { decision: 'descartado', reason: 'no es una salida: actividad académica o diurna' };
  if (source.trust === 'evidence')
    return { decision: 'revisar', reason: 'fuente marcada solo como evidencia' };
  // Cancelado en la ficha: nunca se publica; si ya existe, la evidencia lo retira (regla 5).
  if (candidate.status === 'cancelled') return { decision: 'revisar', reason: 'la fuente dice que se canceló' };
  // This product is about the night. A gallery open from 10:00 to 13:30 is real,
  // current and correctly parsed, and still not an answer to "quiero salir".
  const daytime = candidate.time !== null && candidate.time < '17:00';
  const ajeno = relevance === 'IRRELEVANT';
  if (source.trust === 'auto' && candidate.confidence === 'high' && source.venueSlug && !daytime && !ajeno)
    return { decision: 'publicar', reason: 'fuente oficial del lugar con fecha estructurada' };
  // Nivel B: además de fecha verificada y local conocido, la hora tiene que
  // estar escrita y ser de noche. Un "17:43" o un evento sin hora va a la cola.
  if (
    source.trust === 'strict' &&
    candidate.confidence === 'high' &&
    source.venueSlug &&
    candidate.time !== null &&
    candidate.time >= '18:00' &&
    horizon <= 120 &&
    !ajeno
  )
    return { decision: 'publicar', reason: 'nivel B: local conocido, fecha verificada y hora de noche' };
  if (daytime)
    return { decision: 'revisar', reason: 'horario diurno: se revisa antes de ponerlo en la cartelera' };
  return {
    decision: 'revisar',
    reason:
      candidate.confidence === 'high'
        ? 'fuente sin permiso de publicación automática'
        : 'evidencia de fecha insuficiente para publicar sin revisar',
  };
}
export interface SourceRunReport {
  sourceId: string;
  name: string;
  ok: boolean;
  durationMs: number;
  itemsFound: number;
  candidates: number;
  newEvents: number;
  queued: number;
  duplicates: number;
  rejected: number;
  parseFailures: number;
  irrelevant: number;
  relevant: number;
  /** Filas existentes cuyo precio, disponibilidad o URL primaria se actualizó. */
  refreshed: number;
  error: string | null;
  /** Fechas (Chile) que la fuente anunció en esta lectura: base del reporte de cobertura. */
  fechas: string[];
}
type Db = {
  from: (table: string) => any;
};
export interface RunOptions {
  /** El motor de evidencia decide la publicación: aquí todo entra privado. */
  deferToEngine?: boolean;
  /**
   * Tiempo para empezar fuentes nuevas dentro de la función (Vercel corta a
   * los 300 s). Lo que no alcanza queda vencido y encabeza la próxima corrida.
   */
  plazoMs?: number;
  /** Reloj inyectable para las pruebas. */
  reloj?: () => number;
}
/** Margen para el resto del cron (editorial, motor, snapshot) después del despacho. */
export const PLAZO_DESPACHO_MS = 180_000;
export async function runSource(
  source: SourceDefinition,
  db: Db,
  fetcher: Fetcher = httpFetcher,
  today = toChileDateString(),
  options: RunOptions = {},
): Promise<SourceRunReport> {
  const started = Date.now();
  const report: SourceRunReport = {
    sourceId: source.id,
    name: source.name,
    ok: false,
    durationMs: 0,
    itemsFound: 0,
    candidates: 0,
    newEvents: 0,
    queued: 0,
    duplicates: 0,
    rejected: 0,
    parseFailures: 0,
    irrelevant: 0,
    relevant: 0,
    refreshed: 0,
    error: null,
    fechas: [],
  };
  const adapter = ADAPTERS[source.adapter];
  if (!adapter) {
    report.error = 'ADAPTADOR_DESCONOCIDO';
    report.durationMs = Date.now() - started;
    return report;
  }
  let candidates: EventCandidate[] = [];
  try {
    const result = await adapter.run(source, fetcher, await contextoDe(db, source, today));
    report.itemsFound = result.itemsFound;
    report.parseFailures = result.parseFailures;
    report.error = result.diagnostics?.join(' · ') || null;
    candidates = result.candidates;
    report.ok = true;
  } catch (error) {
    report.error = error instanceof SourceError ? error.code : 'ERROR_DESCONOCIDO';
    report.durationMs = Date.now() - started;
    return report;
  }
  report.candidates = candidates.length;
  report.fechas = [...new Set(candidates.map((c) => c.date).filter((d) => d >= today))].sort();
  // The same night can appear twice inside one page.
  const seen = new Set<string>();
  const unique = candidates.filter((candidate) => {
    if (seen.has(candidate.key)) {
      report.duplicates += 1;
      return false;
    }
    seen.add(candidate.key);
    return true;
  });
  const venueId = source.venueSlug ? await lookupVenueId(db, source.venueSlug) : null;
  // Una fuente que habla de muchos locales (ticketera, directorio): el lugar se
  // reconoce solo si el nombre calza con uno del registro, en la misma ciudad.
  const registro = source.venueSlug ? [] : await knownVenues(db);
  const propuestos = new Set<string>();
  // Todos los locales, aprobados o no: lo que ya está en el registro no se propone otra vez.
  const todos = source.venueSlug || source.tier !== 'B' ? [] : await allVenues(db);
  for (const candidate of unique) {
    // El nombre del local no dice nada del evento: "Teatro Mauri" haría pasar
    // por teatro cualquier cosa que ocurra ahí.
    const sinLocal = candidate.venue
      ? normalizedTitle(candidate.title).replace(normalizedTitle(candidate.venue), ' ')
      : candidate.title;
    const clasificacion = clasificar({
      titulo: sinLocal,
      descripcion: candidate.description,
      hora: candidate.time,
      horaFin: candidate.endTime ?? null,
      categorias: candidate.categories,
    });
    if (clasificacion.relevancia === 'IRRELEVANT') report.irrelevant += 1;
    else if (clasificacion.relevancia !== 'REVIEW') report.relevant += 1;
    const { decision } = decide(candidate, source, today, clasificacion.relevancia);
    if (decision === 'descartado') {
      report.rejected += 1;
      continue;
    }
    // Una ticketera nombra un local que no conocemos: queda propuesto, privado,
    // para que una persona lo apruebe una sola vez. No se publica solo.
    if (!source.venueSlug && source.tier === 'B' && candidate.venue && !venueByName(todos, candidate.venue, candidate.city))
      await proponerLocal(db, candidate, propuestos);
    // Lo que ya existe no se duplica: se le agrega evidencia. Así una segunda
    // fuente confirma, y un cambio de fecha en el origen queda a la vista.
    const fila = await findExisting(db, candidate);
    if (fila) {
      const existente = fila.id;
      await addEvidence(db, existente, source, candidate);
      // Datos que cambian con el tiempo (precio, tramo vigente, agotado, URL
      // primaria) se refrescan con la lectura más reciente de la misma ficha o
      // de la misma fuente. Título, fecha, lugar y procedencia no se tocan, y
      // una fila corregida por una persona solo recibe lo que le falta.
      if (await refrescarDinamicos(db, fila, source, candidate)) report.refreshed += 1;
      // Lo mismo con el afiche: solo si falta, solo en la ficha de esta misma
      // URL y con su procedencia. Un afiche puesto o corregido no se toca.
      const afiche = afichePara(candidate, source);
      if (afiche) {
        const url = candidate.detailUrl.replace(/"/g, '');
        await db
          .from('events')
          .update(afiche)
          .eq('id', existente)
          .is('image_url', null)
          .or(`source_detail_url.eq."${url}",instagram_url.eq."${url}"`);
      }
      report.duplicates += 1;
      continue;
    }
    const publish = decision === 'publicar' && !options.deferToEngine;
    const row = {
      instagram_id: candidate.key,
      title: candidate.title,
      description: candidate.description,
      date_text: candidate.date,
      event_time: candidate.time,
      venue: candidate.venue,
      venue_id: venueId ?? venueByName(registro, candidate.venue, candidate.city),
      city: candidate.city,
      location: `${candidate.venue || source.name} · ${candidate.city}`,
      instagram_url: candidate.detailUrl,
      source_detail_url: candidate.detailUrl,
      // La procedencia viaja con la imagen: una ticketera no es lo mismo que el
      // cartel que el propio local publicó.
      ...(afichePara(candidate, source) || { image_url: null, image_source_url: null, image_kind: null, image_verified_at: null }),
      price_clp: candidate.priceClp,
      price_text: candidate.priceText,
      category: detectCategory(`${candidate.title} ${candidate.description || ''}`),
      source: 'adapter',
      source_id: source.id,
      event_key: candidate.key,
      is_active: publish,
      moderation_status: publish ? 'approved' : 'pending',
      relevance: clasificacion.relevancia,
      relevance_reasons: clasificacion.razones.join(' · ').slice(0, 300),
      last_verified_at: new Date().toISOString(),
    };
    // Insert-only: a row the owner has already withdrawn or corrected is never
    // touched again by ingestion.
    const { data, error } = await db
      .from('events')
      .upsert([row], { onConflict: 'instagram_id', ignoreDuplicates: true })
      .select('id');
    if (error) {
      report.rejected += 1;
      continue;
    }
    if (data && data[0]) await addEvidence(db, data[0].id as number, source, candidate);
    if (!data || data.length === 0) report.duplicates += 1;
    else if (publish) report.newEvents += 1;
    else report.queued += 1;
  }
  report.durationMs = Date.now() - started;
  return report;
}
/** Tipo de imagen según quién la publica. */
export function tipoImagen(source: Pick<SourceDefinition, 'sourceType'>) {
  return source.sourceType === 'TICKET_PLATFORM' || source.sourceType === 'VESTI'
    ? 'ticketera'
    : source.sourceType === 'MUNICIPALITY'
      ? 'grafica_municipal'
      : 'flyer_oficial';
}
/** Un afiche con su procedencia (la ficha de origen), o nada si el host no está permitido. */
export function afichePara(candidate: Pick<EventCandidate, 'imageUrl' | 'detailUrl'>, source: Pick<SourceDefinition, 'sourceType'>) {
  if (!candidate.imageUrl) return null;
  let host: string;
  try {
    const u = new URL(candidate.imageUrl);
    if (u.protocol !== 'https:') return null;
    host = u.hostname;
  } catch {
    return null;
  }
  if (!hostPermitido(host)) return null;
  return {
    image_url: candidate.imageUrl,
    image_source_url: candidate.detailUrl,
    image_kind: tipoImagen(source),
    image_verified_at: new Date().toISOString(),
  };
}
/** Fichas de esta fuente que ya tienen precio guardado (para leer primero las que no). */
async function contextoDe(db: Db, source: SourceDefinition, today: string) {
  // Es solo una prioridad: si no se puede leer, el adaptador corre igual.
  const data = await Promise.resolve()
    .then(() =>
      db
        .from('events')
        .select('source_detail_url,instagram_url')
        .eq('source_id', source.id)
        .gte('date_text', today)
        .not('price_clp', 'is', null)
        .limit(1000),
    )
    .then((r: { data?: unknown[] }) => r?.data || [])
    .catch(() => []);
  const conPrecio = new Set<string>();
  for (const r of data as { source_detail_url?: string | null; instagram_url?: string | null }[])
    for (const u of [r.source_detail_url, r.instagram_url]) if (u) conPrecio.add(u);
  return { conPrecio, today };
}

/** Una persona con nombre tocó el evento en el panel: sus datos no se pisan. */
async function editadoPorPersona(db: Db, id: number) {
  const { data } = await db.from('review_audit').select('actor').eq('target', `event:${id}`).limit(50);
  return ((data || []) as { actor?: string | null }[]).some((r) => !String(r.actor || '').startsWith('sistema'));
}

/**
 * Qué datos dinámicos se pueden refrescar en una fila existente (puro, probado):
 * - misma ficha (misma URL): precio y disponibilidad según la lectura más reciente;
 * - misma fuente y mismo host, con otra URL (el sitio cambió de rutas): además
 *   se mueve la URL a la primaria vigente;
 * - otra fuente u otro host: nada (solo evidencia);
 * - misma ruta con otra consulta (`/eventos/?event_id=1` vs `=2`): son fichas
 *   distintas; ni se refresca ni se migra la URL;
 * - fila corregida por una persona: solo se completa un precio vacío.
 */
const SEGUIMIENTO = /^(utm_\w+|fbclid|gclid|mc_cid|mc_eid|ref)$/i;
/**
 * Host + ruta + consulta ordenada, sin parámetros de seguimiento. La consulta se
 * conserva: en sitios como Cinzano (`/eventos/?event_id=ID`) es la identidad.
 */
export function fichaComparable(u: string | null | undefined) {
  if (!u) return null;
  try {
    const x = new URL(u);
    const q = [...x.searchParams].filter(([k]) => !SEGUIMIENTO.test(k)).sort(([a], [b]) => a.localeCompare(b));
    const consulta = q.length ? `?${new URLSearchParams(q).toString()}` : '';
    return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}${consulta}`;
  } catch {
    return null;
  }
}

export function cambiosDinamicos(
  fila: FilaExistente,
  source: Pick<SourceDefinition, 'id'>,
  candidate: Pick<EventCandidate, 'detailUrl' | 'priceClp' | 'priceText' | 'disponibilidad'>,
  editadaPorPersona: boolean,
): Record<string, unknown> | null {
  const nueva = fichaComparable(candidate.detailUrl);
  const mismaFicha = [fila.source_detail_url, fila.instagram_url].some((u) => fichaComparable(u) === nueva);
  const actual = fila.source_detail_url || fila.instagram_url;
  const ruta = (u: string | null | undefined) => fichaComparable(u)?.split('?')[0] ?? null;
  const host = (u: string | null | undefined) => ruta(u)?.split('/')[0] ?? null;
  // Misma ruta y otra consulta: la consulta es la identidad (event_id), no una variante.
  const otraConsulta = !mismaFicha && ruta(actual) === ruta(candidate.detailUrl);
  const migrar = !mismaFicha && !otraConsulta && fila.source_id === source.id && host(actual) === host(candidate.detailUrl);
  if (!mismaFicha && !migrar) return null;
  const precioLeido = candidate.priceClp !== null || candidate.disponibilidad === 'agotado' || candidate.disponibilidad === 'conflicto';
  const cambios: Record<string, unknown> = {};
  if (editadaPorPersona) {
    if (fila.price_clp == null && candidate.priceClp !== null && mismaFicha)
      Object.assign(cambios, { price_clp: candidate.priceClp, price_text: candidate.priceText });
  } else {
    if (precioLeido && (fila.price_clp !== candidate.priceClp || fila.price_text !== candidate.priceText))
      Object.assign(cambios, { price_clp: candidate.priceClp, price_text: candidate.priceText });
    if (migrar) Object.assign(cambios, { instagram_url: candidate.detailUrl, source_detail_url: candidate.detailUrl });
  }
  return Object.keys(cambios).length ? cambios : null;
}

async function refrescarDinamicos(db: Db, fila: FilaExistente, source: SourceDefinition, candidate: EventCandidate) {
  const persona = await editadoPorPersona(db, fila.id);
  const cambios = cambiosDinamicos(fila, source, candidate, persona);
  if (!cambios) return false;
  const { error } = await db.from('events').update({ ...cambios, last_verified_at: new Date().toISOString() }).eq('id', fila.id);
  return !error;
}

export function slugLocal(nombre: string, ciudad: string) {
  return normalizedTitle(`${nombre} ${ciudad}`).replace(/ /g, '-').slice(0, 80);
}
/** El tipo solo si el nombre lo dice; si no, "bar" queda marcado como dato por confirmar. */
export function tipoLocal(nombre: string) {
  const n = normalizedTitle(nombre);
  if (/\bteatro\b/.test(n)) return 'teatro';
  if (/\b(club|disco|discoteca)\b/.test(n)) return 'club';
  if (/\b(centro cultural|casa de la cultura|cine|espacio|multiespacio)\b/.test(n)) return 'centro-cultural';
  return 'bar';
}
async function proponerLocal(db: Db, c: EventCandidate, hechos: Set<string>) {
  const slug = slugLocal(c.venue!, c.city);
  if (hechos.has(slug) || slug.length < 4) return;
  hechos.add(slug);
  await db.from('venues').upsert(
    [
      {
        slug,
        name: c.venue,
        city: c.city,
        venue_type: tipoLocal(c.venue!),
        source_type: 'ticketera',
        source_url: c.detailUrl,
        moderation_status: 'pending',
        is_active: false,
        evidence_missing: 'Propuesto automáticamente porque una ticketera vende un evento ahí: confirmar que el local existe, su dirección y su tipo.',
        evidence_checked_at: new Date().toISOString(),
        next_recheck_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      },
    ],
    { onConflict: 'slug', ignoreDuplicates: true },
  );
}
type VenueRef = { id: number; name: string; city: string; aliases?: string[] | null };
async function allVenues(db: Db): Promise<VenueRef[]> {
  const { data } = await db.from('venues').select('id,name,city,aliases').limit(2000);
  return data || [];
}
async function knownVenues(db: Db): Promise<VenueRef[]> {
  const { data } = await db
    .from('venues')
    .select('id,name,city,aliases')
    .eq('is_active', true)
    .eq('moderation_status', 'approved')
    .limit(1000);
  return data || [];
}
export function venueByName(
  registro: { id: number; name: string; city: string; aliases?: string[] | null }[],
  nombre: string | null,
  ciudad: string,
) {
  if (!nombre) return null;
  const n = normalizedTitle(nombre);
  const hit = registro.find((v) => {
    const r = normalizedTitle(v.name);
    if (r === n) return true;
    // Los nombres con que cada ticketera escribe el mismo local.
    if ((v.aliases || []).some((a) => normalizedTitle(a) === n)) return true;
    // Contención solo con nombres largos y en la misma ciudad: "Teatro" no basta.
    return v.city === ciudad && Math.min(r.length, n.length) >= 10 && (r.includes(n) || n.includes(r));
  });
  return hit ? hit.id : null;
}
async function lookupVenueId(db: Db, slug: string): Promise<number | null> {
  const { data } = await db.from('venues').select('id').eq('slug', slug).limit(1);
  return data && data[0] ? (data[0].id as number) : null;
}
/**
 * El mismo evento, aunque venga de otra fuente o con otro título: primero por
 * la URL de detalle (la misma ficha es el mismo evento aunque cambie la fecha),
 * luego por la clave estable, luego por fecha, lugar y título parecido.
 */
const CAMPOS_EXISTENTE = 'id,title,date_text,event_time,source_id,instagram_url,source_detail_url,price_clp,price_text';
export interface FilaExistente {
  id: number;
  title?: string;
  date_text?: string;
  event_time?: string | null;
  source_id?: string | null;
  instagram_url?: string | null;
  source_detail_url?: string | null;
  price_clp?: number | null;
  price_text?: string | null;
}
async function findExisting(db: Db, candidate: EventCandidate): Promise<FilaExistente | null> {
  const porUrl = await db
    .from('events')
    .select(CAMPOS_EXISTENTE)
    .or(`source_detail_url.eq."${candidate.detailUrl.replace(/"/g, '')}",instagram_url.eq."${candidate.detailUrl.replace(/"/g, '')}"`)
    .neq('disposition', 'duplicate')
    .limit(20);
  type Fila = FilaExistente & { title?: string; date_text?: string };
  // Una ficha puede vender dos funciones: solo es la misma fila si la hora es compatible.
  const filas = ((porUrl.data || []) as Fila[]).filter((r) => horasCompatibles(r.event_time, candidate.time));
  // Primero la fila de esa misma fecha; si la fuente cambió la fecha, la ficha parecida.
  const mismaFicha =
    filas.find((r) => r.date_text === candidate.date) ||
    filas.find((r) => (r.title ? looksLikeSameEvent(r.title, candidate.title) : false));
  if (mismaFicha) return mismaFicha;
  const porClave = await db.from('events').select(CAMPOS_EXISTENTE).eq('instagram_id', candidate.key).limit(1);
  if (porClave.data && porClave.data[0]) return porClave.data[0] as FilaExistente;
  const { data } = await db
    .from('events')
    .select(`${CAMPOS_EXISTENTE},venue`)
    .eq('date_text', candidate.date)
    .neq('disposition', 'duplicate')
    .limit(60);
  const parecido = (data || []).find((row: { title?: string; venue?: string | null; event_time?: string | null }) => {
    if (!row.title || !horasCompatibles(row.event_time, candidate.time)) return false;
    const sameVenue =
      !candidate.venue || !row.venue || normalizedTitle(row.venue) === normalizedTitle(candidate.venue);
    return sameVenue && looksLikeSameEvent(row.title, candidate.title);
  });
  return parecido ? (parecido as FilaExistente) : null;
}
const ESTRUCTURADOS = new Set(['wp-events-list', 'tribe-events', 'usm-eventos', 'jsonld-events', 'ics-calendar']);
/** Lo que esta fuente afirma hoy sobre el evento, con su procedencia. */
export function evidenceRow(eventId: number, source: SourceDefinition, candidate: EventCandidate) {
  return {
    p_event_id: eventId,
    p_source_id: source.id,
    p_family: source.family,
    p_origin: originGroupOf(candidate.detailUrl, source.id),
    p_authority: authorityOf(source),
    p_url: candidate.detailUrl,
    p_claims: {
      title: candidate.title,
      date: candidate.date,
      start_time: candidate.time,
      venue: candidate.venue,
      city: candidate.city,
      status:
        candidate.status && candidate.status !== 'scheduled'
          ? candidate.status
          : statusFromText(`${candidate.title} ${candidate.description || ''}`),
      date_verified: candidate.confidence === 'high',
      // Precio y tramos de esta lectura, con su URL: la procedencia de cada cambio queda guardada.
      ...(candidate.priceClp !== null || candidate.disponibilidad
        ? {
            price_clp: candidate.priceClp,
            price_text: candidate.priceText,
            availability: candidate.disponibilidad ?? null,
            tiers: candidate.tiers ?? null,
          }
        : {}),
    },
    p_structured: ESTRUCTURADOS.has(source.adapter) || candidate.confidence === 'high',
  };
}
async function addEvidence(db: Db, eventId: number, source: SourceDefinition, candidate: EventCandidate) {
  // Si la evidencia no se puede guardar, la ingesta sigue: el motor sin
  // evidencia nueva simplemente no promueve nada (falla hacia lo privado).
  if (typeof (db as { rpc?: unknown }).rpc !== 'function') return;
  await (db as unknown as { rpc: (f: string, a: object) => Promise<unknown> }).rpc(
    'add_event_evidence',
    evidenceRow(eventId, source, candidate),
  );
}
/**
 * The first dispatch after a source is registered used to find nothing at all:
 * the row is stamped with the database's clock, which is milliseconds ahead of
 * the clock the dispatcher read before it wrote, so a brand new source looked
 * like it was due in the future. A minute of tolerance absorbs that and any
 * ordinary skew between the function and the database, and cannot cause
 * over-fetching because no source refreshes more than once a day.
 */
export const TOLERANCIA_RELOJ_MS = 60_000;
/**
 * Que una ficha estuviera bien hace una semana no garantiza que esté bien esta
 * noche. Una fuente con eventos en las próximas 72 horas se vuelve a mirar
 * antes de su turno: cada 12 horas si el evento es en 1 a 3 días, cada 6 si es
 * en menos de 24. Nunca más seguido: no se martilla a nadie.
 */
export function urgencia(horasHastaEvento: number): number | null {
  if (horasHastaEvento < 0) return null;
  if (horasHastaEvento <= 24) return 6;
  if (horasHastaEvento <= 72) return 12;
  return null;
}
/** Fracción del presupuesto que siempre va a las fuentes más atrasadas por turno. */
export const RESERVA_ATRASADAS = 0.25;
/** The daily cron is a dispatcher: it refreshes whatever is due, never everything. */
export function dueSources(
  rows: { id: string; active: boolean; next_check_at: string; last_checked_at?: string | null }[],
  now: Date,
  limit: number,
  urgentes: Map<string, number> = new Map(),
) {
  const limite = now.getTime() + TOLERANCIA_RELOJ_MS;
  const urgente = (row: (typeof rows)[number]) => {
    const cada = urgentes.get(row.id);
    if (!cada) return false;
    const ultima = row.last_checked_at ? Date.parse(row.last_checked_at) : 0;
    return now.getTime() - ultima >= cada * 3600_000 - TOLERANCIA_RELOJ_MS;
  };
  const porTurno = (row: (typeof rows)[number]) => new Date(row.next_check_at).getTime() <= limite;
  const vencidas = rows.filter((row) => row.active && (porTurno(row) || urgente(row)));
  // Cupo reservado para las más atrasadas por turno: si las urgentes llenaran
  // siempre el presupuesto, una fuente normal no se leería nunca. Van primero,
  // así tampoco el plazo de la corrida las deja fuera.
  const reserva = Math.floor(limit * RESERVA_ATRASADAS);
  const reservadas = vencidas
    .filter(porTurno)
    .sort((a, b) => a.next_check_at.localeCompare(b.next_check_at) || a.id.localeCompare(b.id))
    .slice(0, reserva);
  const elegidas = new Set(reservadas.map((r) => r.id));
  const due = vencidas
    .filter((row) => !elegidas.has(row.id))
    // Primero lo que tiene eventos encima; después, por antigüedad.
    // Primero lo que tiene un evento más cerca (6 h antes que 12 h), y entre
    // ellas la que lleva más tiempo sin leerse; después, el turno normal.
    .sort(
      (a, b) =>
        Number(urgente(b)) - Number(urgente(a)) ||
        (urgentes.get(a.id) || 99) - (urgentes.get(b.id) || 99) ||
        (urgente(a) ? (a.last_checked_at || '').localeCompare(b.last_checked_at || '') : 0) ||
        a.next_check_at.localeCompare(b.next_check_at),
    )
    .slice(0, limit - reservadas.length);
  return [...reservadas, ...due]
    .map((row) => SOURCES.find((source) => source.id === row.id))
    .filter((source): source is SourceDefinition => Boolean(source));
}

/** Keep the operational table in step with the registry that lives in code. */
export async function syncRegistry(db: Db) {
  const rows = SOURCES.map((source) => ({
    id: source.id,
    name: source.name,
    source_type: source.sourceType,
    adapter: source.adapter,
    public_url: source.publicUrl,
    commune: source.commune,
    zone: source.zone ?? null,
    venue_slug: source.venueSlug ?? null,
    trust: source.trust,
    family: source.family,
    trust_tier: source.tier,
    access_mode: source.accessMode || 'api',
    relevance_filter: Boolean(source.relevanceFilter),
    refresh_hours: source.refreshHours,
  }));
  // Las fuentes manuales se registran inactivas: el despachador nunca las
  // toca, pero el panel las muestra para que el mapa de fuentes sea completo.
  const manuales = MANUAL_SOURCES.map((source) => ({
    id: source.id,
    name: source.name,
    source_type: 'OTHER_PUBLIC_EVENT_SOURCE',
    adapter: 'manual',
    public_url: source.publicUrl,
    commune: source.commune,
    zone: null,
    venue_slug: null,
    trust: 'evidence',
    family: source.family,
    trust_tier: 'C',
    access_mode: source.accessMode,
    relevance_filter: true,
    refresh_hours: 720,
    active: false,
    notes: source.notes,
  }));
  // Dos escrituras separadas: un upsert con filas de distintas columnas
  // rellena con NULL lo que falta, y apagaría 'active' en las automáticas.
  await db.from('event_sources').upsert(rows, { onConflict: 'id' });
  await db.from('event_sources').upsert(manuales, { onConflict: 'id' });
}
async function sourcesWithEventsSoon(db: Db, now: Date) {
  const hoy = toChileDateString(now);
  const en3 = toChileDateString(new Date(now.getTime() + 3 * 86_400_000));
  const { data } = await db
    .from('events')
    .select('source_id,date_text,event_time')
    .in('disposition', ['public', 'review'])
    .gte('date_text', hoy)
    .lte('date_text', en3)
    .not('source_id', 'is', null)
    .limit(500);
  const urgentes = new Map<string, number>();
  for (const row of (data || []) as { source_id: string; date_text: string; event_time: string | null }[]) {
    // Hora de Chile aproximada a -03:00; para elegir el turno basta.
    const inicio = Date.parse(`${row.date_text}T${row.event_time || '21:00'}:00-03:00`);
    const cada = urgencia((inicio - now.getTime()) / 3600_000);
    if (cada && (!urgentes.has(row.source_id) || cada < urgentes.get(row.source_id)!)) urgentes.set(row.source_id, cada);
  }
  return urgentes;
}
export interface DispatchReport {
  due: number;
  ran: number;
  reports: SourceRunReport[];
  /** Vencidas que no empezaron por plazo: siguen vencidas para la próxima corrida. */
  postergadas: string[];
}
/**
 * Cadencia por TIPO de fuente, no solo por eventos ya conocidos: las ticketeras
 * regionales y las rutas por local anuncian cosas del mismo día. Jueves, viernes
 * y sábado (noche de Chile, hasta las 05:00) se releen cada 6 h; el resto de la
 * semana cada 12 h. Las demás fuentes siguen con su refreshHours.
 */
export const FUENTES_FRECUENTES = (s: Pick<SourceDefinition, 'id' | 'accessMode'>) =>
  s.accessMode !== 'blocked' &&
  s.accessMode !== 'manual' &&
  (s.id === 'portaldisc-region' || s.id === 'puntoticket-region' || s.id === 'evently-region' || s.id.startsWith('ruta-evently-') || s.id.startsWith('ruta-vesti-'));
export function cadenciaHoras(s: Pick<SourceDefinition, 'id' | 'accessMode' | 'refreshHours'>, now: Date) {
  if (!FUENTES_FRECUENTES(s)) return s.refreshHours;
  const dia = new Date(`${fechaDeLaNoche(now)}T12:00:00Z`).getUTCDay(); // 4 jue, 5 vie, 6 sáb
  return Math.min(s.refreshHours, dia >= 4 && dia <= 6 ? 6 : 12);
}

/** Suma a las urgencias (por eventos conocidos) la cadencia de las fuentes frecuentes. */
export function conCadencia(urgentes: Map<string, number>, now: Date, fuentes: SourceDefinition[] = SOURCES) {
  for (const s of fuentes) if (FUENTES_FRECUENTES(s)) urgentes.set(s.id, Math.min(urgentes.get(s.id) ?? Infinity, cadenciaHoras(s, now)));
  return urgentes;
}

export async function dispatchSources(
  db: Db,
  budget = 6,
  fetcher: Fetcher = httpFetcher,
  now = new Date(),
  options: RunOptions = {},
): Promise<DispatchReport> {
  await syncRegistry(db);
  // Read the clock after the registry write, not before it.
  const reloj = now.getTime() >= Date.now() ? now : new Date();
  const { data } = await db
    .from('event_sources')
    .select('id,active,next_check_at,last_checked_at,consecutive_failures');
  const urgentes = await sourcesWithEventsSoon(db, reloj);
  // Las fuentes frecuentes vencen por su cadencia aunque no conozcamos eventos suyos
  // (anuncios nuevos del mismo día). Pasan por la misma reserva anti-inanición.
  conCadencia(urgentes, reloj);
  const due = dueSources(data || [], reloj, budget, urgentes);
  const reports: SourceRunReport[] = [];
  const postergadas: string[] = [];
  const reloj2 = options.reloj || Date.now;
  const inicio = reloj2();
  const plazo = options.plazoMs ?? PLAZO_DESPACHO_MS;
  const agotado = () => reloj2() - inicio >= plazo;
  // El plazo se mira antes de CADA solicitud, no solo al empezar una fuente:
  // una cartelera con 24 fichas no puede seguir pidiendo pasado el límite.
  const conPlazo: Fetcher = (url, init) => {
    if (agotado()) return Promise.reject(new SourceError(PLAZO_AGOTADO));
    return fetcher(url, init);
  };
  for (const source of due) {
    if (agotado()) {
      postergadas.push(source.id);
      continue;
    }
    const report = await runSource(source, db, conPlazo, toChileDateString(reloj), options);
    // Si ni la agenda alcanzó a pedirse, la fuente no se leyó: sigue vencida,
    // sin contar como fallo ni correr su turno.
    if (report.error === PLAZO_AGOTADO) {
      postergadas.push(source.id);
      continue;
    }
    reports.push(report);
    const next = new Date(reloj.getTime() + cadenciaHoras(source, reloj) * 3600_000).toISOString();
    await db.from('ingestion_source_runs').insert([
      {
        source_id: source.id,
        duration_ms: report.durationMs,
        ok: report.ok,
        items_found: report.itemsFound,
        candidates: report.candidates,
        new_events: report.newEvents,
        queued: report.queued,
        duplicates: report.duplicates,
        rejected: report.rejected,
        parse_failures: report.parseFailures,
        irrelevant: report.irrelevant,
        error: report.error,
      },
    ]);
    const health: Record<string, unknown> = {
      last_checked_at: reloj.toISOString(),
      next_check_at: next,
      items_found: report.itemsFound,
      candidate_count: report.candidates,
      unique_event_count: report.newEvents + report.queued,
      duplicate_count: report.duplicates,
      parse_failure_count: report.parseFailures,
      relevant_count: report.relevant,
      irrelevant_count: report.irrelevant,
    };
    if (report.ok) {
      health.last_success_at = reloj.toISOString();
      health.consecutive_failures = 0;
      health.last_error = null;
    } else {
      health.last_failure_at = reloj.toISOString();
      health.last_error = report.error;
      const current = (data || []).find((row: { id: string }) => row.id === source.id) as
        | { consecutive_failures?: number }
        | undefined;
      health.consecutive_failures = (current?.consecutive_failures || 0) + 1;
    }
    await db.from('event_sources').update(health).eq('id', source.id);
  }
  return { due: due.length, ran: reports.length, reports, postergadas };
}
