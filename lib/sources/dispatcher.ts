import { toChileDateString } from '../event-extraction';
import { detectCategory } from '../events';
import { ADAPTERS, SOURCES } from './registry';
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
  if (source.trust === 'evidence')
    return { decision: 'revisar', reason: 'fuente marcada solo como evidencia' };
  // This product is about the night. A gallery open from 10:00 to 13:30 is real,
  // current and correctly parsed, and still not an answer to "quiero salir".
  const daytime = candidate.time !== null && candidate.time < '17:00';
  if (source.trust === 'auto' && candidate.confidence === 'high' && source.venueSlug && !daytime)
    return { decision: 'publicar', reason: 'fuente oficial del lugar con fecha estructurada' };
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
  error: string | null;
}
type Db = {
  from: (table: string) => any;
};
export async function runSource(
  source: SourceDefinition,
  db: Db,
  fetcher: Fetcher = httpFetcher,
  today = toChileDateString(),
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
    const { decision } = decide(candidate, source, today);
    if (decision === 'descartado') {
      report.rejected += 1;
      continue;
    }
    if (await alreadyPublished(db, candidate)) {
      report.duplicates += 1;
      continue;
    }
    const publish = decision === 'publicar';
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
      price_clp: candidate.priceClp,
      price_text: candidate.priceText,
      category: detectCategory(`${candidate.title} ${candidate.description || ''}`),
      source: 'adapter',
      source_id: source.id,
      event_key: candidate.key,
      is_active: publish,
      moderation_status: publish ? 'approved' : 'pending',
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
async function alreadyPublished(db: Db, candidate: EventCandidate) {
  const { data } = await db
    .from('events')
    .select('title,venue')
    .eq('date_text', candidate.date)
    .limit(60);
  if (!data) return false;
  return data.some((row: { title?: string; venue?: string | null }) => {
    if (!row.title) return false;
    const sameVenue =
      !candidate.venue || !row.venue || normalizedTitle(row.venue) === normalizedTitle(candidate.venue);
    return sameVenue && looksLikeSameEvent(row.title, candidate.title);
  });
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
/** The daily cron is a dispatcher: it refreshes whatever is due, never everything. */
export function dueSources(rows: { id: string; active: boolean; next_check_at: string }[], now: Date, limit: number) {
  const limite = now.getTime() + TOLERANCIA_RELOJ_MS;
  const due = rows
    .filter((row) => row.active && new Date(row.next_check_at).getTime() <= limite)
    .sort((a, b) => a.next_check_at.localeCompare(b.next_check_at))
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
    refresh_hours: source.refreshHours,
  }));
  await db.from('event_sources').upsert(rows, { onConflict: 'id' });
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
): Promise<DispatchReport> {
  await syncRegistry(db);
  // Read the clock after the registry write, not before it.
  const reloj = now.getTime() >= Date.now() ? now : new Date();
  const { data } = await db.from('event_sources').select('id,active,next_check_at,consecutive_failures');
  const due = dueSources(data || [], reloj, budget);
  const reports: SourceRunReport[] = [];
  for (const source of due) {
    const report = await runSource(source, db, fetcher);
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
