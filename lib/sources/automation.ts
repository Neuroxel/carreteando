/**
 * Reevaluación automática: después de cada ingesta, cada evento vigente se
 * vuelve a juzgar con toda su evidencia. Lo que se confirmó se publica solo,
 * lo que es basura se descarta solo, lo que pasó se vence solo, y una persona
 * solo ve lo que de verdad tiene una duda. Todo queda en automation_decisions
 * con el estado anterior, para poder deshacerlo.
 */
import { toChileDateString } from '../event-extraction';
import { CIUDADES } from '../types';
import { httpFetcher, normalizedTitle } from './dispatcher';
import {
  earnTrust,
  evaluateEventEvidence,
  wilsonLower,
  type Authority,
  type Decision,
  type EarnedTrust,
  type EventState,
  type Evidence,
  type SourceStats,
} from './evidence';
import { ADAPTERS, SOURCES } from './registry';
import type { Fetcher } from './types';
import { clasificar, type Relevancia } from './relevance';

type Db = { from: (t: string) => any; rpc?: (f: string, a?: object) => any };
export type EngineMode = 'shadow' | 'active';
type Row = Record<string, any>;

const CEILING: Record<string, EarnedTrust> = { A: 'auto', B: 'strict', C: 'strict', D: 'review' };
const asTrust = (t: string | null | undefined): EarnedTrust =>
  t === 'auto' || t === 'strict' ? t : 'review';

export async function engineMode(db: Db): Promise<EngineMode> {
  const { data } = await db.from('automation_config').select('value').eq('key', 'engine_mode').limit(1);
  return data && data[0]?.value === 'active' ? 'active' : 'shadow';
}

function evidenceFrom(r: Row): Evidence {
  return {
    sourceId: r.source_id,
    family: r.source_family,
    originGroup: r.origin_group,
    authority: r.authority as Authority,
    url: r.source_url,
    retrievedAt: r.retrieved_at,
    claims: r.claims || {},
    structured: Boolean(r.structured),
    active: r.active !== false,
  };
}
function relevanceOf(r: Row): { relevancia: Relevancia; academico: boolean } {
  const titulo = r.venue
    ? normalizedTitle(r.title || '').replace(normalizedTitle(r.venue), ' ')
    : r.title || '';
  const k = clasificar({ titulo, descripcion: r.description, hora: r.event_time });
  return { relevancia: k.relevancia, academico: k.academico };
}
function stateFrom(r: Row, locked: Set<number>): EventState & { academico: boolean; validCity: boolean } {
  const rel = relevanceOf(r);
  return {
    id: r.id,
    title: r.title,
    date: r.date_text,
    time: r.event_time,
    venue: r.venue,
    city: r.city,
    venueKnown: r.venue_id !== null && r.venue_id !== undefined,
    disposition: r.disposition,
    // La relevancia guardada al insertar manda; si no hay, se calcula igual.
    relevance: (r.relevance as Relevancia) || rel.relevancia,
    humanLocked: locked.has(r.id),
    eventStatus: r.event_status || 'scheduled',
    academico: rel.academico,
    validCity: !r.city || (CIUDADES as readonly string[]).includes(r.city),
  };
}

async function inChunks<T>(ids: number[], fn: (chunk: number[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 150) out.push(...(await fn(ids.slice(i, i + 150))));
  return out;
}
async function loadEvidence(db: Db, ids: number[]) {
  const rows = await inChunks(ids, async (chunk) => {
    const { data } = await db.from('event_evidence').select('*').in('event_id', chunk).limit(5000);
    return (data || []) as Row[];
  });
  const by = new Map<number, Evidence[]>();
  for (const r of rows) {
    const list = by.get(r.event_id) || [];
    list.push(evidenceFrom(r));
    by.set(r.event_id, list);
  }
  return by;
}
/** Un moderador con nombre (no el sistema) tocó este evento: queda bajo control humano. */
async function loadLocked(db: Db, ids: number[]) {
  const rows = await inChunks(ids, async (chunk) => {
    const { data } = await db
      .from('review_audit')
      .select('target,actor')
      .in('target', chunk.map((id) => `event:${id}`))
      .limit(5000);
    return (data || []) as Row[];
  });
  return new Set(
    rows
      .filter((r) => !String(r.actor || '').startsWith('sistema'))
      .map((r) => Number(String(r.target).split(':')[1])),
  );
}

async function lastDecisions(db: Db, ids: number[]) {
  const rows = await inChunks(ids, async (chunk) => {
    const { data } = await db
      .from('automation_decisions')
      .select('event_id,decision,created_at')
      .in('event_id', chunk)
      .neq('mode', 'backtest')
      .order('created_at', { ascending: false })
      .limit(3000);
    return (data || []) as Row[];
  });
  const last = new Map<number, string>();
  for (const r of rows) if (!last.has(r.event_id)) last.set(r.event_id, r.decision);
  return last;
}
/**
 * La precisión de una fuente se mide contra lo que una persona verificó: para
 * cada evento con ficha humana, ¿lo que dijo la fuente (antes de esa ficha o a
 * lo más dos días después) coincidía en fecha y lugar? Una fecha distinta
 * declarada después de la ficha es un cambio del origen, no un error, y no se
 * cuenta. Se agrega por origen: las 20 carteleras de la ticketera son un parser.
 */
export function sourceStatsFrom(evidenceByEvent: Map<number, Evidence[]>) {
  const stats = new Map<string, { reviewed: number; confirmed: number; serious: number }>();
  for (const list of evidenceByEvent.values()) {
    const humanas = list.filter((e) => e.authority === 'human');
    if (!humanas.length) continue;
    const h = humanas[0];
    const visto = new Set<string>();
    for (const e of list) {
      if (e.authority === 'human' || visto.has(e.originGroup)) continue;
      if (!['first_party', 'transactional', 'directory'].includes(e.authority)) continue;
      const delta = Date.parse(e.retrievedAt) - Date.parse(h.retrievedAt);
      if (delta > 2 * 86_400_000 || delta < -30 * 86_400_000) continue;
      visto.add(e.originGroup);
      const s = stats.get(e.originGroup) || { reviewed: 0, confirmed: 0, serious: 0 };
      s.reviewed += 1;
      const mismaFecha = e.claims.date === h.claims.date;
      const lugarA = normalizedTitle(e.claims.venue || '');
      const lugarB = normalizedTitle(h.claims.venue || '');
      const mismoLugar = !lugarA || !lugarB || lugarA.includes(lugarB) || lugarB.includes(lugarA);
      if (mismaFecha && mismoLugar) s.confirmed += 1;
      else s.serious += 1;
      stats.set(e.originGroup, s);
    }
  }
  return stats;
}
const groupOfSource = (id: string) => (id.startsWith('portaldisc-') ? 'portaldisc' : null);

async function learnTrust(db: Db, evidenceByEvent: Map<number, Evidence[]>, apply: boolean) {
  const stats = sourceStatsFrom(evidenceByEvent);
  const { data } = await db
    .from('event_sources')
    .select('id,trust,trust_tier,earned_trust,consecutive_failures,public_url,active,access_mode');
  const trustById = new Map<string, EarnedTrust>();
  const cambios: { id: string; from: EarnedTrust; to: EarnedTrust; reason: string }[] = [];
  for (const row of (data || []) as Row[]) {
    if (row.access_mode === 'manual' || row.access_mode === 'blocked') continue;
    const def = SOURCES.find((s) => s.id === row.id);
    let host = '';
    try {
      host = new URL(row.public_url).hostname.replace(/^www\./, '');
    } catch {
      /* sin host */
    }
    const g = groupOfSource(row.id) || host;
    const s = stats.get(g) || { reviewed: 0, confirmed: 0, serious: 0 };
    const current = asTrust(row.earned_trust || row.trust);
    const ceiling = CEILING[row.trust_tier || def?.tier || 'C'] || 'review';
    const full: SourceStats = { ...s, parserHealthy: Number(row.consecutive_failures || 0) < 2 };
    const { trust, reason } = earnTrust(current, ceiling, full);
    trustById.set(row.id, trust);
    if (trust !== current) cambios.push({ id: row.id, from: current, to: trust, reason });
    if (apply)
      await db
        .from('event_sources')
        .update({
          reviewed_n: s.reviewed,
          confirmed_n: s.confirmed,
          serious_errors: s.serious,
          precision_lb: s.reviewed ? Number(wilsonLower(s.confirmed, s.reviewed).toFixed(3)) : null,
          earned_trust: trust,
          ...(trust !== current || !row.earned_trust
            ? { trust_changed_at: new Date().toISOString(), trust_reason: reason }
            : {}),
        })
        .eq('id', row.id);
  }
  return { trustById, cambios, stats };
}

export interface EngineReport {
  mode: EngineMode;
  evaluated: number;
  counts: Partial<Record<Decision, number>>;
  applied: number;
  trustChanges: { id: string; from: EarnedTrust; to: EarnedTrust; reason: string }[];
}

/** Sí cambia el estado: lo demás solo se anota. */
const CAMBIA: Decision[] = ['AUTO_PUBLISH', 'AUTO_PROMOTE_FROM_REVIEW', 'AUTO_REJECT', 'AUTO_EXPIRE', 'AUTO_CANCEL', 'REVIEW_CONFLICT'];

export async function reevaluate(db: Db, now = new Date(), forced?: EngineMode): Promise<EngineReport> {
  const mode = forced || (await engineMode(db));
  const today = toChileDateString(now);
  const ayer = toChileDateString(new Date(now.getTime() - 86_400_000));
  const { data } = await db
    .from('events')
    .select(
      'id,title,description,date_text,event_time,venue,venue_id,city,disposition,moderation_status,is_active,source,source_id,relevance,event_status,auto_decision,human_reason',
    )
    .in('disposition', ['review', 'public'])
    .gte('date_text', ayer)
    .limit(2000);
  const rows = (data || []) as Row[];
  const ids = rows.map((r) => r.id as number);
  const [evidence, locked] = await Promise.all([loadEvidence(db, ids), loadLocked(db, ids)]);
  // El aprendizaje usa toda la evidencia con ficha humana, no solo la vigente.
  const { data: humanEv } = await db.from('event_evidence').select('event_id').eq('authority', 'human').limit(5000);
  const humanIds = [...new Set(((humanEv || []) as Row[]).map((r) => r.event_id as number))];
  const evidenceForStats = await loadEvidence(db, humanIds);
  const { trustById, cambios } = await learnTrust(db, evidenceForStats, mode === 'active');
  const trustOf = (id: string | null) => (id ? trustById.get(id) || 'review' : 'review');
  const ultimas = await lastDecisions(db, ids);
  const report: EngineReport = { mode, evaluated: rows.length, counts: {}, applied: 0, trustChanges: cambios };
  for (const r of rows) {
    const st = stateFrom(r, locked);
    const ev = evidence.get(r.id) || [];
    let result = evaluateEventEvidence(st, ev, trustOf, today);
    // Fuera de la región: no es nuestro, se descarta sin persona.
    if (!st.validCity && r.disposition === 'review') result = { ...result, decision: 'AUTO_REJECT', reasons: ['fuera de la región cubierta'] };
    // Diurno sin señal académica de una fuente fuerte: lo mira una persona, no se bota.
    if (result.decision === 'AUTO_REJECT' && !st.academico && ev.some((e) => ['first_party', 'transactional', 'human'].includes(e.authority)) && st.validCity) {
      result = { ...result, decision: 'REVIEW_INSUFFICIENT', reasons: ['actividad diurna de una fuente confiable: confirmar si es una salida'] };
    }
    report.counts[result.decision] = (report.counts[result.decision] || 0) + 1;
    const human = result.decision.startsWith('REVIEW') ? [...result.conflicting, ...result.reasons].join(' · ').slice(0, 500) : null;
    const yaDecidido = r.auto_decision === result.decision && (r.human_reason || null) === human;
    if (yaDecidido && mode === 'active') continue;
    const aplica = mode === 'active' && CAMBIA.includes(result.decision);
    const previous = {
      disposition: r.disposition,
      moderation_status: r.moderation_status,
      is_active: r.is_active,
      event_status: r.event_status,
    };
    if (mode === 'active') {
      const base = {
        auto_decision: result.decision,
        auto_reasons: { reasons: result.reasons, supporting: result.supporting, conflicting: result.conflicting },
        auto_decided_at: now.toISOString(),
        human_reason: human,
      };
      let patch: Row = base;
      if (result.decision === 'AUTO_PUBLISH' || result.decision === 'AUTO_PROMOTE_FROM_REVIEW')
        patch = { ...base, is_active: true, moderation_status: 'approved', disposition: 'public', last_verified_at: now.toISOString() };
      else if (result.decision === 'AUTO_REJECT')
        patch = { ...base, is_active: false, moderation_status: 'rejected', disposition: 'rejected', disposition_note: result.reasons.join(' · ').slice(0, 300) };
      else if (result.decision === 'AUTO_EXPIRE')
        patch = { ...base, is_active: false, disposition: 'expired', disposition_note: 'La fecha ya pasó.' };
      else if (result.decision === 'AUTO_CANCEL')
        patch = { ...base, is_active: false, disposition: 'cancelled', event_status: 'cancelled', disposition_note: result.reasons.join(' · ').slice(0, 300) };
      else if (result.decision === 'REVIEW_CONFLICT' && r.disposition === 'public')
        // Falla hacia lo privado: una fecha en duda no se queda en la cartelera.
        patch = { ...base, is_active: false, moderation_status: 'pending', disposition: 'review', disposition_note: 'Retirado por contradicción entre fuentes.' };
      // Nunca se toca una fila bajo control humano más allá de anotar la duda.
      if (st.humanLocked) patch = { human_reason: human, auto_decision: result.decision, auto_reasons: base.auto_reasons, auto_decided_at: base.auto_decided_at };
      const { error } = await db
        .from('events')
        .update({ ...patch, independent_sources: result.independentGroups })
        .eq('id', r.id)
        .eq('disposition', r.disposition);
      if (!error && aplica && !st.humanLocked) report.applied += 1;
    }
    if (result.decision === 'KEEP' && mode === 'shadow') continue;
    if (mode === 'shadow' && ultimas.get(r.id) === result.decision) continue;
    await db.from('automation_decisions').insert([
      {
        event_id: r.id,
        decision: result.decision,
        applied: aplica && !st.humanLocked,
        mode,
        reasons: result.reasons,
        supporting: result.supporting,
        conflicting: result.conflicting,
        previous,
      },
    ]);
  }
  return report;
}

/**
 * Backtest: cada evento histórico se juzga como si acabara de llegar (con la
 * fecha de ese día y sin la ficha humana, para no hacer trampa) y se compara
 * con lo que una persona decidió. Escribe en modo 'backtest'; no cambia nada.
 */
export async function backtest(db: Db) {
  await db.from('automation_decisions').delete().eq('mode', 'backtest');
  const { data } = await db
    .from('events')
    .select('id,title,description,date_text,event_time,venue,venue_id,city,disposition,moderation_status,source,source_id,relevance,event_status,scraped_at')
    .limit(3000);
  const rows = (data || []) as Row[];
  const evidence = await loadEvidence(db, rows.map((r) => r.id));
  // Con la confianza inicial del registro, no con la aprendida: aprender de
  // las mismas fichas con que se mide sería hacer trampa.
  const trustOf = (id: string | null) => asTrust(SOURCES.find((s) => s.id === id)?.trust);
  const out: Row[] = [];
  for (const r of rows) {
    const asOf = r.scraped_at ? toChileDateString(new Date(r.scraped_at)) : r.date_text;
    const etiquetaHumana =
      r.source === 'editorial' || (r.source === 'passline' && r.moderation_status === 'approved')
        ? 'aprobado'
        : r.disposition === 'rejected'
          ? 'rechazado'
          : 'sin_etiqueta';
    // Sin la ficha humana: lo que se ve es lo que traía el origen.
    const ev = (evidence.get(r.id) || []).map((e) =>
      e.authority === 'human'
        ? { ...e, authority: (e.originGroup === 'portaldisc' || e.originGroup === 'passline.com' ? 'transactional' : 'directory') as Authority, claims: { ...e.claims, date_verified: false } }
        : e,
    );
    const st = stateFrom({ ...r, disposition: 'review' }, new Set());
    let res = evaluateEventEvidence({ ...st, disposition: 'review' }, ev, trustOf, asOf);
    if (res.decision === 'AUTO_REJECT' && !st.academico && ev.some((e) => ['first_party', 'transactional'].includes(e.authority)))
      res = { ...res, decision: 'REVIEW_INSUFFICIENT' };
    out.push({
      event_id: r.id,
      decision: res.decision,
      applied: false,
      mode: 'backtest',
      reasons: res.reasons,
      supporting: res.supporting,
      conflicting: res.conflicting,
      previous: { etiqueta: etiquetaHumana, source: r.source, source_id: r.source_id, title: String(r.title || '').slice(0, 80) },
    });
  }
  for (let i = 0; i < out.length; i += 200) await db.from('automation_decisions').insert(out.slice(i, i + 200));
  const matriz: Record<string, Record<string, number>> = {};
  for (const o of out) {
    const k = (o.previous as Row).etiqueta as string;
    matriz[k] = matriz[k] || {};
    matriz[k][o.decision] = (matriz[k][o.decision] || 0) + 1;
  }
  return { evaluated: out.length, matriz, parser: await parserCheck(db) };
}

/**
 * ¿El parser de la ticketera lee bien? Se relee hoy cada cartelera y se compara,
 * por URL, con las fichas que una persona verificó. Una diferencia puede ser
 * un error del parser o un cambio real del evento; se listan para mirarlas.
 */
export async function parserCheck(db: Db, fetcher: Fetcher = httpFetcher) {
  const { data } = await db
    .from('events')
    .select('id,title,date_text,event_time,venue,source_detail_url,instagram_url')
    .eq('source', 'editorial')
    .limit(1000);
  const humanas = new Map<string, Row>();
  for (const r of (data || []) as Row[]) {
    const url = r.source_detail_url || r.instagram_url;
    if (url && url.includes('portaldisc.com')) humanas.set(url, r);
  }
  let comparados = 0;
  let fecha = 0;
  let hora = 0;
  let lugar = 0;
  const diferencias: string[] = [];
  for (const source of SOURCES.filter((s) => s.adapter === 'portaldisc-cartelera')) {
    let result;
    try {
      result = await ADAPTERS[source.adapter].run(source, fetcher);
    } catch {
      continue;
    }
    for (const c of result.candidates) {
      const h = humanas.get(c.detailUrl);
      if (!h) continue;
      comparados += 1;
      const okFecha = c.date === h.date_text;
      const okHora = !h.event_time || c.time === h.event_time;
      const a = normalizedTitle(c.venue || '');
      const b = normalizedTitle(h.venue || '');
      const okLugar = !a || !b || a.includes(b) || b.includes(a);
      fecha += Number(okFecha);
      hora += Number(okHora);
      lugar += Number(okLugar);
      if (!okFecha || !okHora || !okLugar)
        diferencias.push(`${h.title}: ficha ${h.date_text} ${h.event_time ?? ''} @ ${h.venue} · ticketera hoy ${c.date} ${c.time ?? ''} @ ${c.venue}`);
    }
  }
  return { comparados, fecha, hora, lugar, diferencias };
}
