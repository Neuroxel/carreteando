/**
 * Motor de decisión. Lógica TypeScript común: sin IA, sin modelos de lenguaje,
 * sin embeddings. Recibe un evento y la evidencia que las fuentes dejaron
 * sobre él, y aplica siete reglas. La primera que calza decide.
 *
 *   1. Fuente oficial (nivel A) estructurada + lugar conocido      → publicar
 *   2. Ticketera (nivel B) + fecha verificada + hora + lugar        → publicar
 *   3. Dos orígenes fuertes independientes coinciden               → publicar
 *   4. Pasado, duplicado, académico explícito o fuera de la región → vencer / descartar
 *   5. Una fuente fuerte dice "cancelado"                          → cancelar
 *   6. Contradicción en fecha, lugar, hora (> 90 min) o estado     → persona (y se retira si estaba publicado)
 *   7. Todo lo demás                                               → persona, con el motivo
 *
 * Las reglas 4–6 se evalúan primero porque protegen los datos críticos
 * (existencia, fecha, lugar, ciudad, cancelación). Para publicar (1–3) la
 * evidencia tiene que haberse leído en las últimas 72 horas y la hora no puede
 * ser diurna (antes de las 17:00): lo de día lo mira una persona.
 * Duplicados y región se resuelven en automation.ts porque necesitan mirar
 * otras filas.
 */
import type { SourceDefinition, SourceFamily, TrustTier } from './types';
import type { Relevancia } from './relevance';

export type Authority = 'human' | 'first_party' | 'transactional' | 'directory' | 'community' | 'lead';
export type EventStatus = 'scheduled' | 'cancelled' | 'postponed';
export interface Claims {
  title?: string | null;
  date?: string | null;
  start_time?: string | null;
  venue?: string | null;
  city?: string | null;
  status?: EventStatus | null;
  /** Año y día de la semana coinciden con la fecha, o la fecha venía estructurada. */
  date_verified?: boolean;
}
export interface Evidence {
  sourceId: string | null;
  family: string | null;
  originGroup: string;
  authority: Authority;
  url: string | null;
  retrievedAt: string;
  claims: Claims;
  structured: boolean;
  active: boolean;
}
export interface EventState {
  id: number;
  title: string;
  date: string;
  time: string | null;
  venue: string | null;
  city: string | null;
  venueKnown: boolean;
  disposition: string;
  relevance: Relevancia | null;
  /** El clasificador vio una señal académica explícita (seminario, taller, charla...). */
  academic?: boolean;
  /** Una persona editó este evento: la automatización no cambia sus datos. */
  humanLocked: boolean;
  eventStatus: EventStatus | 'rescheduled';
}
export type Decision =
  | 'AUTO_PUBLISH'
  | 'AUTO_PROMOTE_FROM_REVIEW'
  | 'AUTO_REJECT'
  | 'AUTO_EXPIRE'
  | 'AUTO_CANCEL'
  | 'REVIEW_CONFLICT'
  | 'REVIEW_INSUFFICIENT'
  | 'KEEP';
export interface Evaluation {
  decision: Decision;
  rule: number | null;
  reasons: string[];
  supporting: string[];
  conflicting: string[];
  independentGroups: number;
}

const FIRST_PARTY: SourceFamily[] = [
  'VENUE_OFFICIAL',
  'CULTURAL_CENTER',
  'ARTIST_OR_BAND',
  'PROMOTER',
  'COLLECTIVE',
  'AUTOGESTIONADO',
  'UNIVERSITY_OFFICIAL',
  'STUDENT_ORGANIZATION',
];
/** Quién habla, según la familia de la fuente. */
export function authorityOf(source: Pick<SourceDefinition, 'family'>): Authority {
  if (source.family === 'EDITORIAL') return 'human';
  if (source.family === 'TICKET_PLATFORM') return 'transactional';
  if (source.family === 'COMMUNITY') return 'community';
  if (source.family === 'PUBLIC_EVENT_DIRECTORY' || source.family === 'MUNICIPALITY') return 'directory';
  if (FIRST_PARTY.includes(source.family)) return 'first_party';
  return 'lead';
}
/**
 * El origen real de un dato. Las 20 carteleras de la ticketera son un solo
 * origen; dos URLs del mismo origen no se confirman entre sí.
 */
export function originGroupOf(url: string | null, sourceId: string | null): string {
  if (sourceId?.startsWith('portaldisc-')) return 'portaldisc';
  if (url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'instagram.com') {
        const handle = u.pathname.split('/').filter(Boolean)[0];
        return handle && handle !== 'p' && handle !== 'reel' ? `instagram:${handle}` : 'instagram';
      }
      return host;
    } catch {
      /* cae al id de la fuente */
    }
  }
  return sourceId || 'desconocido';
}

const CANCELADO = /\b(cancelad[oa]s?|suspendid[oa]s?|se suspende|se cancela)\b/i;
const POSTERGADO = /\b(reprogramad[oa]s?|postergad[oa]s?|nueva fecha|cambio de fecha|se posterga|se reprograma)\b/i;
export function statusFromText(text: string): EventStatus {
  if (CANCELADO.test(text)) return 'cancelled';
  if (POSTERGADO.test(text)) return 'postponed';
  return 'scheduled';
}

/** Límite inferior de Wilson al 95 %. Solo para el diagnóstico del panel: no decide nada. */
export function wilsonLower(ok: number, n: number, z = 1.96) {
  if (n <= 0) return 0;
  const p = ok / n;
  const den = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.max(0, (centre - margin) / den);
}

function norm(v: string | null | undefined) {
  return (v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function sameVenue(a: string | null | undefined, b: string | null | undefined) {
  const x = norm(a);
  const y = norm(b);
  return !x || !y || x.includes(y) || y.includes(x);
}
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
// La ficha humana es nuestro propio registro: no se usa para decidir, solo para medir.
const FUERTE: Authority[] = ['first_party', 'transactional'];
/** Lo que cada origen dice hoy: su lectura más reciente. */
export function latestByOrigin(evidence: Evidence[]) {
  const latest = new Map<string, Evidence>();
  for (const e of evidence.filter((x) => x.active)) {
    const key = `${e.originGroup}|${e.authority}`;
    const prev = latest.get(key);
    if (!prev || e.retrievedAt > prev.retrievedAt) latest.set(key, e);
  }
  return [...latest.values()];
}
/** Orígenes distintos con autoridad de primera parte o de ticketera. */
export function independentGroups(evidence: Evidence[]) {
  return new Set(
    evidence
      .filter((e) => e.active && (e.authority === 'first_party' || e.authority === 'transactional'))
      .map((e) => e.originGroup),
  ).size;
}
/** Para publicar, la fuente tiene que haberlo mostrado hace poco (caso real: un show movido del 9 al 11). */
export const FRESCURA_MS = 72 * 3600_000;

export function evaluateEventEvidence(
  event: EventState,
  evidence: Evidence[],
  tierOf: (sourceId: string | null) => TrustTier | null,
  today: string,
  now: Date = new Date(`${today}T15:00:00Z`),
): Evaluation {
  const reasons: string[] = [];
  const supporting: string[] = [];
  const conflicting: string[] = [];
  const fuertes = latestByOrigin(evidence).filter((e) => FUERTE.includes(e.authority));
  const out = (decision: Decision, rule: number | null): Evaluation => ({
    decision,
    rule,
    reasons,
    supporting,
    conflicting,
    independentGroups: independentGroups(evidence),
  });
  const quien = (e: Evidence) => e.sourceId || e.originGroup;

  // Regla 4 (vencido).
  if (event.date < today) {
    reasons.push('la fecha ya pasó');
    return out(['review', 'public'].includes(event.disposition) ? 'AUTO_EXPIRE' : 'KEEP', 4);
  }
  // Regla 5: cancelación explícita. Si una persona lo editó o es una
  // reprogramación, decide una persona (regla 6).
  for (const e of fuertes) {
    if (e.claims.status === 'cancelled') {
      conflicting.push(`${quien(e)}: cancelado`);
      reasons.push(`${quien(e)} dice que se canceló`);
      return event.humanLocked ? out('REVIEW_CONFLICT', 6) : out('AUTO_CANCEL', 5);
    }
    if (e.claims.status === 'postponed') {
      conflicting.push(`${quien(e)}: reprogramado`);
      reasons.push(`${quien(e)} dice que se reprogramó`);
      return out('REVIEW_CONFLICT', 6);
    }
  }
  // Regla 6: contradicción en un dato crítico. Vale también para lo que editó
  // una persona: no se pisa su corrección, pero tampoco se deja público algo
  // que una fuente con autoridad ahora contradice.
  for (const e of fuertes) {
    if (e.claims.date && e.claims.date !== event.date)
      conflicting.push(`${quien(e)} dice ${e.claims.date}; la ficha dice ${event.date}`);
    else if (!sameVenue(e.claims.venue, event.venue))
      conflicting.push(`${quien(e)} dice "${e.claims.venue}"; la ficha dice "${event.venue}"`);
    else if (e.claims.start_time && event.time && Math.abs(minutes(e.claims.start_time) - minutes(event.time)) > 90)
      conflicting.push(`${quien(e)} dice ${e.claims.start_time}; la ficha dice ${event.time}`);
  }
  if (conflicting.length) {
    reasons.push('una fuente con autoridad contradice un dato crítico');
    return out('REVIEW_CONFLICT', 6);
  }
  if (event.humanLocked) {
    reasons.push('editado por una persona y sin contradicción');
    return out('KEEP', null);
  }
  // Regla 4 (académico explícito).
  if (event.relevance === 'IRRELEVANT' && event.academic) {
    reasons.push('no es una salida: actividad académica');
    return out(event.disposition === 'public' ? 'REVIEW_CONFLICT' : 'AUTO_REJECT', 4);
  }

  // Reglas 1–3: publicar.
  const publicar = (rule: number) =>
    out(
      event.disposition === 'public' ? 'KEEP' : event.disposition === 'review' ? 'AUTO_PROMOTE_FROM_REVIEW' : 'AUTO_PUBLISH',
      rule,
    );
  const diurno = event.time !== null && event.time < '17:00';
  const frescas = fuertes.filter((e) => now.getTime() - Date.parse(e.retrievedAt) <= FRESCURA_MS);
  if (!diurno && event.venueKnown) {
    const oficial = frescas.find((e) => e.authority === 'first_party' && e.structured && tierOf(e.sourceId) === 'A');
    if (oficial) {
      supporting.push(`${quien(oficial)}: calendario oficial estructurado`, 'lugar conocido', 'sin contradicción');
      reasons.push('regla 1: fuente oficial');
      return publicar(1);
    }
    const ticketera = frescas.find(
      (e) => e.authority === 'transactional' && tierOf(e.sourceId) === 'B' && e.claims.date_verified && event.time !== null,
    );
    if (ticketera) {
      supporting.push(`${quien(ticketera)}: ticketera`, 'año y día de la semana coinciden', 'hora escrita', 'lugar conocido');
      reasons.push('regla 2: ticketera con fecha verificada');
      return publicar(2);
    }
  }
  const independientes = new Set(frescas.map((e) => e.originGroup));
  if (!diurno && independientes.size >= 2) {
    supporting.push(`${independientes.size} orígenes independientes coinciden en fecha y lugar`);
    reasons.push('regla 3: confirmación independiente');
    return publicar(3);
  }

  // Regla 7.
  if (event.disposition === 'public') {
    reasons.push('publicado y sin evidencia en contra');
    return out('KEEP', null);
  }
  if (!fuertes.length) reasons.push('solo hay evidencia de directorio, comunidad o redes');
  else if (!frescas.length) reasons.push('la fuente no lo ha mostrado en los últimos 3 días: se confirma en la próxima lectura');
  else if (!event.venueKnown) reasons.push('el lugar no está en el registro');
  else if (diurno) reasons.push('horario diurno: confirmar que es una salida');
  else if (event.time === null) reasons.push('sin hora escrita');
  else if (frescas.some((e) => e.authority === 'transactional' && !e.claims.date_verified))
    reasons.push('la ticketera no escribió el año: fecha sin verificar');
  else reasons.push('la fuente no es de nivel A ni B y nadie más lo confirma');
  return out('REVIEW_INSUFFICIENT', 7);
}
