/**
 * Corre el motor de decisión (evidence.ts) sobre la base. Se llama al final de
 * cada ingesta (/api/cron/scrape) y desde /api/cron/automatizacion. Toma los
 * eventos vigentes, su evidencia, aplica las siete reglas y, en modo activo,
 * cambia el estado. Cada decisión queda en automation_decisions con el estado
 * anterior, para poder ver por qué pasó y deshacerla.
 */
import { toChileDateString } from '../event-extraction';
import { CIUDADES } from '../types';
import { httpFetcher, looksLikeSameEvent, normalizedTitle } from './dispatcher';
import { evaluateEventEvidence, sameVenue, wilsonLower, type Authority, type Decision, type EventState, type Evidence } from './evidence';
import { ADAPTERS, SOURCES } from './registry';
import { clasificar, type Relevancia } from './relevance';
import type { Fetcher, TrustTier } from './types';

type Db = { from: (t: string) => any };
type Row = Record<string, any>;
export type EngineMode = 'shadow' | 'active';

/** Niveles fijos del registro en código. No cambian solos. */
const tierOf = (id: string | null): TrustTier | null => SOURCES.find((s) => s.id === id)?.tier ?? null;

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
function stateFrom(r: Row, locked: Set<number>): EventState {
  // El nombre del local no dice nada del evento ("Teatro Mauri" no hace teatro todo).
  const titulo = r.venue ? normalizedTitle(r.title || '').replace(normalizedTitle(r.venue), ' ') : r.title || '';
  const k = clasificar({ titulo, descripcion: r.description, hora: r.event_time });
  return {
    id: r.id,
    title: r.title,
    date: r.date_text,
    time: r.event_time,
    venue: r.venue,
    city: r.city,
    venueKnown: r.venue_id !== null && r.venue_id !== undefined,
    disposition: r.disposition,
    relevance: (r.relevance as Relevancia) || k.relevancia,
    academic: k.academico,
    daySignal: k.salida,
    humanLocked: locked.has(r.id),
    eventStatus: r.event_status || 'scheduled',
  };
}

async function inChunks(ids: number[], fn: (chunk: number[]) => Promise<Row[]>) {
  const out: Row[] = [];
  for (let i = 0; i < ids.length; i += 150) out.push(...(await fn(ids.slice(i, i + 150))));
  return out;
}
async function loadEvidence(db: Db, ids: number[]) {
  const rows = await inChunks(ids, async (chunk) => {
    const { data } = await db.from('event_evidence').select('*').in('event_id', chunk).limit(5000);
    return data || [];
  });
  const by = new Map<number, Evidence[]>();
  for (const r of rows) by.set(r.event_id, [...(by.get(r.event_id) || []), evidenceFrom(r)]);
  return by;
}
/** Eventos que una persona con nombre (no el sistema) tocó en el panel. */
async function loadLocked(db: Db, ids: number[]) {
  const rows = await inChunks(ids, async (chunk) => {
    const { data } = await db
      .from('review_audit')
      .select('target,actor')
      .in('target', chunk.map((id) => `event:${id}`))
      .limit(5000);
    return data || [];
  });
  return new Set(
    rows.filter((r) => !String(r.actor || '').startsWith('sistema')).map((r) => Number(String(r.target).split(':')[1])),
  );
}

/**
 * Regla 4 (duplicado): dos filas con la misma URL de detalle son el mismo
 * evento. Se queda la pública, si no la que coincide con la última fecha que
 * da la fuente, si no la más antigua.
 */
export function duplicadosPorFicha(rows: Row[], evidence: Map<number, Evidence[]>) {
  const porUrl = new Map<string, Row[]>();
  for (const r of rows) {
    const url = r.source_detail_url || r.instagram_url;
    if (url) porUrl.set(url, [...(porUrl.get(url) || []), r]);
  }
  const copias = new Map<number, number>();
  for (const [url, grupo] of porUrl) {
    if (grupo.length < 2) continue;
    const ultimaFecha = grupo
      .flatMap((r) => evidence.get(r.id) || [])
      .filter((e) => e.url === url && e.authority !== 'human' && e.active)
      .sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt))[0]?.claims.date;
    const orden = [...grupo].sort(
      (a, b) =>
        Number(b.disposition === 'public') - Number(a.disposition === 'public') ||
        Number(b.date_text === ultimaFecha) - Number(a.date_text === ultimaFecha) ||
        a.id - b.id,
    );
    for (const r of orden.slice(1)) copias.set(r.id, orden[0].id);
  }
  return copias;
}

/**
 * Diagnóstico, no decisión: para cada origen, ¿lo que dijo coincidía con lo
 * que una persona verificó? Una diferencia leída más de 2 días después de la
 * ficha no se cuenta (puede ser una reprogramación real).
 */
export function sourceStatsFrom(evidenceByEvent: Map<number, Evidence[]>) {
  const stats = new Map<string, { reviewed: number; confirmed: number; serious: number }>();
  for (const list of evidenceByEvent.values()) {
    const h = list.find((e) => e.authority === 'human');
    if (!h) continue;
    const visto = new Set<string>();
    for (const e of list) {
      if (e.authority === 'human' || visto.has(e.originGroup)) continue;
      if (!['first_party', 'transactional', 'directory'].includes(e.authority)) continue;
      const delta = Date.parse(e.retrievedAt) - Date.parse(h.retrievedAt);
      const coincide = e.claims.date === h.claims.date && sameVenue(e.claims.venue, h.claims.venue);
      if (delta < -30 * 86_400_000 || (!coincide && delta > 2 * 86_400_000)) continue;
      visto.add(e.originGroup);
      const s = stats.get(e.originGroup) || { reviewed: 0, confirmed: 0, serious: 0 };
      s.reviewed += 1;
      if (coincide) s.confirmed += 1;
      else s.serious += 1;
      stats.set(e.originGroup, s);
    }
  }
  return stats;
}
async function recordSourceStats(db: Db) {
  const { data } = await db.from('event_evidence').select('event_id').eq('authority', 'human').limit(5000);
  const ids = [...new Set(((data || []) as Row[]).map((r) => r.event_id as number))];
  const stats = sourceStatsFrom(await loadEvidence(db, ids));
  for (const s of SOURCES) {
    const grupo = s.id.startsWith('portaldisc-') ? 'portaldisc' : new URL(s.publicUrl).hostname.replace(/^www\./, '');
    const st = stats.get(grupo);
    if (!st) continue;
    await db
      .from('event_sources')
      .update({
        reviewed_n: st.reviewed,
        confirmed_n: st.confirmed,
        serious_errors: st.serious,
        precision_lb: Number(wilsonLower(st.confirmed, st.reviewed).toFixed(3)),
      })
      .eq('id', s.id);
  }
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
    return data || [];
  });
  const last = new Map<number, string>();
  for (const r of rows) if (!last.has(r.event_id)) last.set(r.event_id, r.decision);
  return last;
}

export interface EngineReport {
  mode: EngineMode;
  evaluated: number;
  counts: Partial<Record<Decision, number>>;
  applied: number;
}

/** Cómo queda la fila después de cada decisión. KEEP y REVIEW_INSUFFICIENT no cambian el estado. */
function patchFor(decision: Decision, r: Row, reasons: string[], now: Date): Row | null {
  const nota = reasons.join(' · ').slice(0, 300);
  switch (decision) {
    case 'AUTO_PUBLISH':
    case 'AUTO_PROMOTE_FROM_REVIEW':
      return { is_active: true, moderation_status: 'approved', disposition: 'public', last_verified_at: now.toISOString() };
    case 'AUTO_REJECT':
      // Un duplicado no es un rechazo: queda enlazado al original.
      return /^(misma ficha|ya publicado)/.test(reasons[0] || '')
        ? { is_active: false, disposition: 'duplicate', disposition_note: nota }
        : { is_active: false, moderation_status: 'rejected', disposition: 'rejected', disposition_note: nota };
    case 'AUTO_EXPIRE':
      return { is_active: false, disposition: 'expired', disposition_note: 'La fecha ya pasó.' };
    case 'AUTO_CANCEL':
      return { is_active: false, disposition: 'cancelled', event_status: 'cancelled', disposition_note: nota };
    case 'REVIEW_CONFLICT':
      // Falla hacia lo privado: un dato crítico en duda no se queda en la cartelera.
      return r.disposition === 'public'
        ? { is_active: false, moderation_status: 'pending', disposition: 'review', disposition_note: 'Retirado por contradicción entre fuentes.' }
        : null;
    default:
      return null;
  }
}

export async function reevaluate(db: Db, now = new Date(), forced?: EngineMode): Promise<EngineReport> {
  const mode = forced || (await engineMode(db));
  const today = toChileDateString(now);
  const ayer = toChileDateString(new Date(now.getTime() - 86_400_000));
  const { data } = await db
    .from('events')
    .select(
      'id,title,description,date_text,event_time,venue,venue_id,city,disposition,moderation_status,is_active,relevance,event_status,auto_decision,human_reason,source_detail_url,instagram_url',
    )
    .in('disposition', ['review', 'public'])
    .gte('date_text', ayer)
    .limit(2000);
  const rows = (data || []) as Row[];
  const ids = rows.map((r) => r.id as number);
  const [evidence, locked, ultimas] = await Promise.all([loadEvidence(db, ids), loadLocked(db, ids), lastDecisions(db, ids)]);
  if (mode === 'active') await recordSourceStats(db);
  const copias = duplicadosPorFicha(rows, evidence);
  const publicos = rows.filter((r) => r.disposition === 'public');
  const report: EngineReport = { mode, evaluated: rows.length, counts: {}, applied: 0 };

  for (const r of rows) {
    const st = stateFrom(r, locked);
    let res = evaluateEventEvidence(st, evidence.get(r.id) || [], tierOf, today, now);
    // Regla 4: duplicados y región, que necesitan mirar otras filas.
    if (r.city && !(CIUDADES as readonly string[]).includes(r.city) && r.disposition === 'review')
      res = { ...res, decision: 'AUTO_REJECT', rule: 4, reasons: ['fuera de la región cubierta'] };
    const copiaDe = copias.get(r.id);
    if (copiaDe && !st.humanLocked) res = { ...res, decision: 'AUTO_REJECT', rule: 4, reasons: [`misma ficha que el evento ${copiaDe}`], conflicting: [] };
    if (res.decision === 'AUTO_PROMOTE_FROM_REVIEW' || res.decision === 'AUTO_PUBLISH') {
      const gemelo = publicos.find((p) => p.id !== r.id && p.date_text === r.date_text && looksLikeSameEvent(p.title || '', r.title || ''));
      if (gemelo) res = { ...res, decision: 'AUTO_REJECT', rule: 4, reasons: [`ya publicado como el evento ${gemelo.id}`] };
    }
    report.counts[res.decision] = (report.counts[res.decision] || 0) + 1;

    const humano = res.decision.startsWith('REVIEW') ? [...res.conflicting, ...res.reasons].join(' · ').slice(0, 500) : null;
    const repetida = ultimas.get(r.id) === res.decision && (mode === 'shadow' || r.auto_decision === res.decision);
    if (repetida || (res.decision === 'KEEP' && !r.auto_decision)) continue;
    // Lo editado por una persona: solo se retira ante contradicción; nunca se cambian sus datos.
    let patch = patchFor(res.decision, r, res.reasons, now);
    if (st.humanLocked && res.decision !== 'REVIEW_CONFLICT') patch = null;
    const aplica = mode === 'active' && patch !== null;
    if (mode === 'active') {
      const { error } = await db
        .from('events')
        .update({
          ...(patch || {}),
          auto_decision: res.decision,
          auto_reasons: { rule: res.rule, reasons: res.reasons, supporting: res.supporting, conflicting: res.conflicting },
          auto_decided_at: now.toISOString(),
          human_reason: humano,
          independent_sources: res.independentGroups,
        })
        .eq('id', r.id)
        .eq('disposition', r.disposition);
      if (!error && aplica) report.applied += 1;
    }
    if (res.decision === 'KEEP') continue;
    await db.from('automation_decisions').insert([
      {
        event_id: r.id,
        decision: res.decision,
        applied: aplica,
        mode,
        reasons: [`regla ${res.rule ?? '-'}`, ...res.reasons],
        supporting: res.supporting,
        conflicting: res.conflicting,
        previous: { disposition: r.disposition, moderation_status: r.moderation_status, is_active: r.is_active, event_status: r.event_status },
      },
    ]);
  }
  return report;
}

/**
 * Backtest: cada evento histórico se juzga como si acabara de llegar (con la
 * fecha de ese día y sin su ficha humana) y se compara con lo que decidió una
 * persona. Escribe en modo 'backtest'; no cambia ningún evento.
 */
export async function backtest(db: Db) {
  await db.from('automation_decisions').delete().eq('mode', 'backtest');
  const { data } = await db
    .from('events')
    .select('id,title,description,date_text,event_time,venue,venue_id,city,disposition,moderation_status,source,source_id,relevance,event_status,scraped_at')
    .limit(3000);
  const rows = (data || []) as Row[];
  const evidence = await loadEvidence(db, rows.map((r) => r.id));
  const out: Row[] = [];
  for (const r of rows) {
    const etiqueta =
      r.source === 'editorial' || (r.source === 'passline' && r.moderation_status === 'approved')
        ? 'aprobado'
        : r.disposition === 'rejected'
          ? 'rechazado'
          : 'sin_etiqueta';
    const ev = (evidence.get(r.id) || []).filter((e) => e.authority !== 'human');
    const asOf = r.scraped_at ? new Date(r.scraped_at) : new Date(`${r.date_text}T12:00:00Z`);
    const res = evaluateEventEvidence(stateFrom({ ...r, disposition: 'review' }, new Set()), ev, tierOf, toChileDateString(asOf), asOf);
    out.push({
      event_id: r.id,
      decision: res.decision,
      applied: false,
      mode: 'backtest',
      reasons: [`regla ${res.rule ?? '-'}`, ...res.reasons],
      supporting: res.supporting,
      conflicting: res.conflicting,
      previous: { etiqueta, source: r.source, source_id: r.source_id, title: String(r.title || '').slice(0, 80) },
    });
  }
  for (let i = 0; i < out.length; i += 200) await db.from('automation_decisions').insert(out.slice(i, i + 200));
  const matriz: Record<string, Record<string, number>> = {};
  for (const o of out) {
    const k = (o.previous as Row).etiqueta as string;
    matriz[k] = { ...(matriz[k] || {}), [o.decision]: ((matriz[k] || {})[o.decision] || 0) + 1 };
  }
  return { evaluated: out.length, matriz, parser: await parserCheck(db) };
}

/** Relee hoy las carteleras de la ticketera y las compara, por URL, con fichas verificadas por una persona. */
export async function parserCheck(db: Db, fetcher: Fetcher = httpFetcher) {
  const { data } = await db
    .from('events')
    .select('title,date_text,event_time,venue,source_detail_url,instagram_url')
    .eq('source', 'editorial')
    .limit(1000);
  const humanas = new Map<string, Row>();
  for (const r of (data || []) as Row[]) {
    const url = r.source_detail_url || r.instagram_url;
    if (url?.includes('portaldisc.com')) humanas.set(url, r);
  }
  const res = { comparados: 0, fecha: 0, hora: 0, lugar: 0, diferencias: [] as string[] };
  for (const source of SOURCES.filter((s) => s.adapter === 'portaldisc-cartelera')) {
    const result = await ADAPTERS[source.adapter].run(source, fetcher).catch(() => null);
    for (const c of result?.candidates || []) {
      const h = humanas.get(c.detailUrl);
      if (!h) continue;
      const ok = [c.date === h.date_text, !h.event_time || c.time === h.event_time, sameVenue(c.venue, h.venue)];
      res.comparados += 1;
      res.fecha += Number(ok[0]);
      res.hora += Number(ok[1]);
      res.lugar += Number(ok[2]);
      if (ok.includes(false))
        res.diferencias.push(`${h.title}: ficha ${h.date_text} ${h.event_time ?? ''} @ ${h.venue} · ticketera hoy ${c.date} ${c.time ?? ''} @ ${c.venue}`);
    }
  }
  return res;
}
