/**
 * Motor de evidencia. Un evento no es "una fila de una fuente": es lo que
 * afirman todas las fuentes que lo mencionan. Este módulo es puro (sin base de
 * datos ni red) para poder probarlo, reproducirlo sobre el histórico y
 * explicarle al panel por qué decidió lo que decidió.
 *
 * Orden de precedencia de quién manda sobre un dato:
 *   corrección humana > primera parte (local, organizador, artista)
 *   > ticketera que vende la entrada > directorio > comunidad > pista social
 * Una contradicción no se promedia: se manda a una persona.
 */
import type { SourceDefinition, SourceFamily, Trust } from './types';
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
  /** La fecha se leyó dos veces igual (año y día de la semana) o venía estructurada. */
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
  /** Un moderador lo tocó: la automatización no cambia sus datos ni su estado. */
  humanLocked: boolean;
  eventStatus: EventStatus | 'rescheduled';
  /** El clasificador vio una señal académica explícita (seminario, taller, charla...). */
  academic?: boolean;
}
export type EarnedTrust = Extract<Trust, 'auto' | 'strict' | 'review'>;
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
/** Quién habla, según su familia. Un centro cultural habla por sí mismo solo si la fuente es la suya. */
export function authorityOf(source: Pick<SourceDefinition, 'family' | 'venueSlug'>): Authority {
  if (source.family === 'EDITORIAL') return 'human';
  if (source.family === 'TICKET_PLATFORM') return 'transactional';
  if (source.family === 'COMMUNITY') return 'community';
  if (source.family === 'PUBLIC_EVENT_DIRECTORY' || source.family === 'MUNICIPALITY') return 'directory';
  if (FIRST_PARTY.includes(source.family)) {
    return 'first_party';
  }
  return 'lead';
}
/**
 * El origen real de un dato. Las 20 carteleras de la ticketera son un solo
 * origen; una ficha editorial copiada de la ticketera también lo es. Un
 * directorio puede estar copiando a cualquiera, así que nunca cuenta como
 * confirmación independiente (ver independentGroups).
 */
export function originGroupOf(url: string | null, sourceId: string | null): string {
  if (sourceId?.startsWith('portaldisc-')) return 'portaldisc';
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (host === 'instagram.com') {
        const handle = new URL(url).pathname.split('/').filter(Boolean)[0];
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
/** Señales fuertes de estado escritas por la propia fuente. */
export function statusFromText(text: string): EventStatus {
  if (CANCELADO.test(text)) return 'cancelled';
  if (POSTERGADO.test(text)) return 'postponed';
  return 'scheduled';
}

/** Límite inferior de Wilson al 95 %: 2 de 2 no es 100 % de confianza. */
export function wilsonLower(ok: number, n: number, z = 1.96) {
  if (n <= 0) return 0;
  const p = ok / n;
  const den = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.max(0, (centre - margin) / den);
}
export interface SourceStats {
  reviewed: number;
  confirmed: number;
  serious: number;
  parserHealthy: boolean;
}
/** Umbrales documentados en docs/AUTOMATION.md; la histéresis evita que un evento raro cambie el nivel cada día. */
export const UMBRALES = {
  auto: { n: 40, lb: 0.95, maxSeriousRate: 0 },
  strict: { n: 15, lb: 0.8, maxSeriousRate: 0.03 },
  bajarDeAuto: { lb: 0.9 },
  bajarDeStrict: { lb: 0.7, maxSeriousRate: 0.06 },
};
const RANGO: Record<EarnedTrust, number> = { review: 0, strict: 1, auto: 2 };
export function earnTrust(
  current: EarnedTrust,
  ceiling: EarnedTrust,
  s: SourceStats,
): { trust: EarnedTrust; reason: string } {
  // Falla hacia lo privado: un parser roto no publica nada.
  if (!s.parserHealthy) return { trust: 'review', reason: 'la fuente falló o cambió de forma: todo a revisión' };
  const lb = wilsonLower(s.confirmed, s.reviewed);
  const seriousRate = s.reviewed ? s.serious / s.reviewed : 0;
  const pct = `${Math.round(lb * 100)} % (mínimo probable, ${s.reviewed} revisados)`;
  let trust = current;
  let reason = `sin cambios: precisión ${pct}`;
  if (current === 'auto' && (lb < UMBRALES.bajarDeAuto.lb || s.serious > 0) && s.reviewed >= 10) {
    trust = 'strict';
    reason = `baja de automático: precisión ${pct}, ${s.serious} errores graves`;
  }
  if (trust === 'strict' && s.reviewed >= 10 && (lb < UMBRALES.bajarDeStrict.lb || seriousRate > UMBRALES.bajarDeStrict.maxSeriousRate)) {
    trust = 'review';
    reason = `baja a revisión: precisión ${pct}, ${s.serious} errores graves`;
  }
  if (trust === 'review' && s.reviewed >= UMBRALES.strict.n && lb >= UMBRALES.strict.lb && seriousRate <= UMBRALES.strict.maxSeriousRate) {
    trust = 'strict';
    reason = `sube a estricto: precisión ${pct}`;
  }
  if (trust === 'strict' && s.reviewed >= UMBRALES.auto.n && lb >= UMBRALES.auto.lb && s.serious === 0) {
    trust = 'auto';
    reason = `sube a automático: precisión ${pct}, sin errores graves`;
  }
  if (RANGO[trust] > RANGO[ceiling]) trust = ceiling;
  return { trust, reason };
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
function minutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
const FUERTE: Authority[] = ['human', 'first_party', 'transactional'];
/** La última afirmación de cada origen: lo que la fuente dice hoy, no lo que dijo hace un mes. */
export function latestByOrigin(evidence: Evidence[]) {
  const latest = new Map<string, Evidence>();
  for (const e of evidence.filter((x) => x.active)) {
    const prev = latest.get(e.originGroup);
    // Una ficha humana no es "más nueva" que la fuente: se compara aparte.
    if (!prev || (e.authority !== 'human' && (prev.authority === 'human' || e.retrievedAt > prev.retrievedAt)))
      latest.set(e.originGroup, e);
  }
  return latest;
}
/** Confirmaciones independientes: orígenes distintos y con autoridad fuerte. Los espejos no suman. */
export function independentGroups(evidence: Evidence[]) {
  const groups = new Set<string>();
  for (const e of evidence)
    if (e.active && (e.authority === 'first_party' || e.authority === 'transactional')) groups.add(e.originGroup);
  return groups.size;
}

export function evaluateEventEvidence(
  event: EventState,
  evidence: Evidence[],
  trustOf: (sourceId: string | null) => EarnedTrust,
  today: string,
): Evaluation {
  const reasons: string[] = [];
  const supporting: string[] = [];
  const conflicting: string[] = [];
  const latest = latestByOrigin(evidence);
  const independientes = independentGroups(evidence);
  const out = (decision: Decision): Evaluation => ({ decision, reasons, supporting, conflicting, independentGroups: independientes });
  const publicado = event.disposition === 'public';
  const promover = (): Evaluation => out(publicado ? 'KEEP' : event.disposition === 'review' ? 'AUTO_PROMOTE_FROM_REVIEW' : 'AUTO_PUBLISH');

  if (event.date < today) {
    reasons.push('la fecha ya pasó');
    return out(['review', 'public'].includes(event.disposition) ? 'AUTO_EXPIRE' : 'KEEP');
  }

  // 1. Estado: cancelaciones y postergaciones escritas por quien manda.
  for (const e of latest.values()) {
    if (!FUERTE.includes(e.authority) || !e.claims.status || e.claims.status === 'scheduled') continue;
    const quien = `${e.sourceId || e.originGroup} (${e.authority})`;
    if (e.claims.status === 'cancelled') {
      reasons.push(`${quien} dice que se canceló`);
      conflicting.push(`${quien}: cancelado`);
      if (event.humanLocked) return out('REVIEW_CONFLICT');
      return out('AUTO_CANCEL');
    }
    reasons.push(`${quien} dice que se reprogramó`);
    conflicting.push(`${quien}: reprogramado`);
    return out('REVIEW_CONFLICT');
  }

  // 2. Contradicciones entre orígenes fuertes, y de cada origen con la ficha publicada.
  const fuertes = [...latest.values()].filter((e) => FUERTE.includes(e.authority));
  for (const e of fuertes) {
    const quien = e.sourceId || e.originGroup;
    if (e.claims.date && e.claims.date !== event.date) {
      conflicting.push(`${quien} dice ${e.claims.date}; la ficha dice ${event.date}`);
    }
    if (e.claims.venue && event.venue && norm(e.claims.venue) !== norm(event.venue) && !norm(e.claims.venue).includes(norm(event.venue)) && !norm(event.venue).includes(norm(e.claims.venue))) {
      conflicting.push(`${quien} dice "${e.claims.venue}"; la ficha dice "${event.venue}"`);
    }
    if (
      e.claims.date === event.date &&
      e.claims.start_time &&
      event.time &&
      Math.abs(minutes(e.claims.start_time) - minutes(event.time)) > 90
    ) {
      conflicting.push(`${quien} dice ${e.claims.start_time}; la ficha dice ${event.time}`);
    }
  }
  if (conflicting.length) {
    reasons.push('hay datos contradictorios entre fuentes con autoridad');
    return out(event.humanLocked ? 'KEEP' : 'REVIEW_CONFLICT');
  }
  if (event.humanLocked) {
    reasons.push('revisado por una persona: la automatización no lo cambia');
    return out('KEEP');
  }

  // 3. Basura evidente: se descarta sin gastar a una persona.
  const soloDebiles = fuertes.length === 0;
  // Solo se descarta sin persona lo que lleva una señal académica explícita: el
  // backtest mostró que "diurno sin señales" incluía fondas aprobadas a mano.
  if (event.relevance === 'IRRELEVANT' && event.academic) {
    reasons.push('no es una salida: actividad académica');
    return out(publicado ? 'REVIEW_CONFLICT' : 'AUTO_REJECT');
  }

  // 4. Publicación con evidencia suficiente.
  const deNoche = event.time !== null && event.time >= '18:00';
  const diurno = event.time !== null && event.time < '17:00';
  if (independientes >= 2) {
    supporting.push(`${independientes} orígenes independientes coinciden en fecha y lugar`);
    if (!diurno) {
      reasons.push('confirmado por fuentes independientes');
      return promover();
    }
  }
  for (const e of fuertes) {
    const nivel = trustOf(e.sourceId);
    const quien = e.sourceId || e.originGroup;
    if (e.authority === 'human') {
      supporting.push(`${quien}: revisado por una persona`);
      continue;
    }
    if (e.authority === 'first_party' && e.structured && nivel === 'auto' && event.venueKnown && !diurno) {
      supporting.push(`${quien}: calendario oficial con fecha estructurada`, 'lugar conocido', 'sin duplicado ni contradicción');
      reasons.push('fuente oficial del lugar');
      return promover();
    }
    if (
      e.authority === 'transactional' &&
      (nivel === 'strict' || nivel === 'auto') &&
      e.claims.date_verified &&
      event.venueKnown &&
      deNoche
    ) {
      supporting.push(`${quien}: ticketera que vende la entrada`, 'año y día de la semana coinciden', 'lugar conocido', 'hora de noche');
      reasons.push('ticketera confiable con fecha verificada');
      return promover();
    }
  }
  if (supporting.some((s) => s.includes('revisado por una persona')) && !diurno) {
    reasons.push('ficha curada por una persona y sin contradicción');
    return promover();
  }

  // 5. Lo que queda necesita a alguien, y se dice por qué.
  if (publicado) {
    reasons.push('publicado antes y sin evidencia en contra');
    return out('KEEP');
  }
  if (soloDebiles) reasons.push('solo hay evidencia de directorio, comunidad o redes');
  else if (!event.venueKnown) reasons.push('el lugar no está en el registro');
  else if (diurno) reasons.push('horario diurno: hay que confirmar que es una salida');
  else if (!deNoche) reasons.push('sin hora de noche confirmada');
  else reasons.push('la fuente aún no tiene historial suficiente para publicar sola');
  return out('REVIEW_INSUFFICIENT');
}
