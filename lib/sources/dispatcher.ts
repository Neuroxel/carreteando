import { toChileDateString } from '../event-extraction';
import { detectCategory } from '../events';
import { ADAPTERS, MANUAL_SOURCES, SOURCES } from './registry';
import { clasificar, type Relevancia } from './relevance';
import { authorityOf, originGroupOf, statusFromText } from './evidence';
import { SourceError, type EventCandidate, type Fetcher, type SourceDefinition } from './types';
const USER_AGENT = 'CarreteandoBot/1.0 (+https://carreteando.vercel.app/confianza)';
const MAX_BYTES = 3_000_000;
export const httpFetcher: Fetcher = async (url) => {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/html;q=0.9' },
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
  error: string | null;
}
type Db = {
  from: (table: string) => any;
};
export interface RunOptions {
  /** El motor de evidencia decide la publicación: aquí todo entra privado. */
  deferToEngine?: boolean;
}
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
    error: null,
  };
  const adapter = ADAPTERS[source.adapter];
  if (!adapter) {
    report.error = 'ADAPTADOR_DESCONOCIDO';
    report.durationMs = Date.now() - started;
    return report;
  }
  let candidates: EventCandidate[] = [];
  try {
    const result = await adapter.run(source, fetcher);
    report.itemsFound = result.itemsFound;
    report.parseFailures = result.parseFailures;
    candidates = result.candidates;
    report.ok = true;
  } catch (error) {
    report.error = error instanceof SourceError ? error.code : 'ERROR_DESCONOCIDO';
    report.durationMs = Date.now() - started;
    return report;
  }
  report.candidates = candidates.length;
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
    // Lo que ya existe no se duplica: se le agrega evidencia. Así una segunda
    // fuente confirma, y un cambio de fecha en el origen queda a la vista.
    const existente = await findExisting(db, candidate);
    if (existente) {
      await addEvidence(db, existente, source, candidate);
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
      venue_id: venueId,
      city: candidate.city,
      location: `${candidate.venue || source.name} · ${candidate.city}`,
      instagram_url: candidate.detailUrl,
      source_detail_url: candidate.detailUrl,
      image_url: candidate.imageUrl,
      // La procedencia viaja con la imagen: una ticketera no es lo mismo que el
      // cartel que el propio local publicó.
      image_source_url: candidate.imageUrl ? candidate.detailUrl : null,
      image_kind: candidate.imageUrl
        ? source.sourceType === 'TICKET_PLATFORM'
          ? 'ticketera'
          : source.sourceType === 'MUNICIPALITY'
            ? 'grafica_municipal'
            : 'flyer_oficial'
        : null,
      image_verified_at: candidate.imageUrl ? new Date().toISOString() : null,
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
async function lookupVenueId(db: Db, slug: string): Promise<number | null> {
  const { data } = await db.from('venues').select('id').eq('slug', slug).limit(1);
  return data && data[0] ? (data[0].id as number) : null;
}
/**
 * El mismo evento, aunque venga de otra fuente o con otro título: primero por
 * la URL de detalle (la misma ficha es el mismo evento aunque cambie la fecha),
 * luego por la clave estable, luego por fecha, lugar y título parecido.
 */
async function findExisting(db: Db, candidate: EventCandidate): Promise<number | null> {
  const porUrl = await db
    .from('events')
    .select('id,title,date_text')
    .or(`source_detail_url.eq."${candidate.detailUrl.replace(/"/g, '')}",instagram_url.eq."${candidate.detailUrl.replace(/"/g, '')}"`)
    .neq('disposition', 'duplicate')
    .limit(5);
  type Fila = { id: number; title?: string; date_text?: string };
  const filas = (porUrl.data || []) as Fila[];
  // Primero la fila de esa misma fecha; si la fuente cambió la fecha, la ficha parecida.
  const mismaFicha =
    filas.find((r) => r.date_text === candidate.date) ||
    filas.find((r) => (r.title ? looksLikeSameEvent(r.title, candidate.title) : false));
  if (mismaFicha) return mismaFicha.id as number;
  const porClave = await db.from('events').select('id').eq('instagram_id', candidate.key).limit(1);
  if (porClave.data && porClave.data[0]) return porClave.data[0].id as number;
  const { data } = await db
    .from('events')
    .select('id,title,venue')
    .eq('date_text', candidate.date)
    .neq('disposition', 'duplicate')
    .limit(60);
  const parecido = (data || []).find((row: { title?: string; venue?: string | null }) => {
    if (!row.title) return false;
    const sameVenue =
      !candidate.venue || !row.venue || normalizedTitle(row.venue) === normalizedTitle(candidate.venue);
    return sameVenue && looksLikeSameEvent(row.title, candidate.title);
  });
  return parecido ? (parecido.id as number) : null;
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
      status: statusFromText(`${candidate.title} ${candidate.description || ''}`),
      date_verified: candidate.confidence === 'high',
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
  const due = rows
    .filter((row) => row.active && (new Date(row.next_check_at).getTime() <= limite || urgente(row)))
    // Primero lo que tiene eventos encima; después, por antigüedad.
    .sort((a, b) => Number(urgente(b)) - Number(urgente(a)) || a.next_check_at.localeCompare(b.next_check_at))
    .slice(0, limit);
  return due
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
  const due = dueSources(data || [], reloj, budget, urgentes);
  const reports: SourceRunReport[] = [];
  for (const source of due) {
    const report = await runSource(source, db, fetcher, toChileDateString(reloj), options);
    reports.push(report);
    const next = new Date(reloj.getTime() + source.refreshHours * 3600_000).toISOString();
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
  return { due: due.length, ran: reports.length, reports };
}
