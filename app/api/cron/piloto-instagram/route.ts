import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/server-db';
import { cronAutorizado } from '../../../../lib/cron-auth';
import { presupuestoApify } from '../../../../lib/apify-budget';
import { guardarMarcas, leerMarcas, marcasNuevas, ventanaActor } from '../../../../lib/instagram-incremental';
import {
  ACTORES,
  PILOT_COHORTS,
  PILOT_LIMITS,
  TOPE_USD,
  candidatoDesdeTexto,
  cuentasCitadas,
  entradaActor,
  pilotItem,
  type Actor,
  type Cohorte,
} from '../../../../lib/instagram-pilot';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const CORTO: Record<Actor, string> = { 'apify~instagram-scraper': 'scraper', 'apify~instagram-post-scraper': 'post' };

/**
 * Una corrida acotada de Instagram vía Apify (nunca sesión propia ni cookies).
 * Se arma a mano en la base: automation_config.instagram_pilot =
 * 'armed-<COHORTE>-<scraper|post>' y se consume al empezar, así que cada
 * corrida pasa una sola vez. Tope de gasto por corrida (TOPE_USD). No depende
 * de APIFY_PAUSED, que sigue en true: la ingesta diaria no raspa Instagram.
 *
 * Guarda evidencia privada (instagram_pilot_items) y cuentas citadas como
 * candidatas (instagram_accounts). No crea eventos: lo que trae es pista.
 */
const pilotoSinReserva = () => true;
export async function GET(request: Request) {
  const db = getAdminDb();
  const token = process.env.APIFY_API_TOKEN;
  if (!db || !token) return reply({ error: 'Configuración incompleta.' }, 503);
  if (!(await cronAutorizado(request, db))) return reply({ error: 'Unauthorized' }, 401);
  const url = new URL(request.url);
  const cohorte = url.searchParams.get('cohorte') as Cohorte | null;
  if (!cohorte || !(cohorte in PILOT_COHORTS)) return reply({ error: 'Cohorte inválida (A, B o BENCH).' }, 400);
  const actor = (url.searchParams.get('actor') || 'apify~instagram-scraper') as Actor;
  if (!ACTORES.includes(actor)) return reply({ error: 'Actor no permitido.' }, 400);
  // El piloto no comparte reserva atómica con scrape; cerrarlo evita gasto concurrente.
  if (pilotoSinReserva()) return reply({ error: 'PILOT_SHARED_RESERVATION_REQUIRED' }, 503);
  const marca = `${cohorte}-${CORTO[actor]}`;
  const cuentas: readonly string[] = PILOT_COHORTS[cohorte];
  const presupuesto = await presupuestoApify(db, { token, topePedido: TOPE_USD[cohorte] });
  if (!presupuesto.correr) return reply({ error: presupuesto.motivo, gastado_mes_usd: presupuesto.gastadoMes, restante_usd: presupuesto.restante }, 429);
  const tope = presupuesto.maxTotalChargeUsd;
  const armed = await db
    .from('automation_config')
    .update({ value: `running-${marca}` })
    .eq('key', 'instagram_pilot')
    .eq('value', `armed-${marca}`)
    .select('key');
  if (armed.error || !armed.data?.length) return reply({ error: `La corrida ${marca} no está armada.` }, 409);
  const started = Date.now();
  const api = async (path: string, init?: RequestInit) => {
    const r = await fetch(`https://api.apify.com/v2/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`APIFY_HTTP_${r.status}`);
    return r.json();
  };
  let runId: string | null = null;
  try {
    const maxItems = cuentas.length * PILOT_LIMITS.postsPerAccount;
    // Incremental: ventana desde las marcas de agua por cuenta (máximo 7 días en el piloto).
    const marcas = await leerMarcas(db, cuentas);
    const ventana = ventanaActor(cuentas, marcas, new Date(), 7);
    const start = obj(
      (await api(`acts/${actor}/runs?timeout=240&maxItems=${maxItems}&maxTotalChargeUsd=${tope}`, {
        method: 'POST',
        body: JSON.stringify(entradaActor(actor, cuentas, PILOT_LIMITS.postsPerAccount, ventana)),
      })) as unknown,
    );
    let run = obj(start.data);
    runId = typeof run.id === 'string' ? run.id : null;
    const datasetId = typeof run.defaultDatasetId === 'string' ? run.defaultDatasetId : null;
    if (!runId || !datasetId) throw new Error('APIFY_INVALID_RUN');
    while (Date.now() - started < 260000 && !['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(String(run.status))) {
      await new Promise((r) => setTimeout(r, 5000));
      run = obj(obj(await api(`actor-runs/${runId}`)).data);
    }
    if (String(run.status) !== 'SUCCEEDED') {
      await api(`actor-runs/${runId}/abort`, { method: 'POST' }).catch(() => undefined);
      throw new Error(`APIFY_${String(run.status || 'DEADLINE')}`);
    }
    const raw = await api(`datasets/${datasetId}/items?format=json&clean=true&limit=200`);
    const crudos = Array.isArray(raw) ? raw.map(obj) : [];
    const rows = crudos.map((x) => pilotItem(x, cuentas)).filter((x) => x !== null);
    // Cuentas que son lugares: el lugar y la ciudad salen del registro, no del texto.
    const reg = await db.from('instagram_accounts').select('username,status,kind,venue_id').limit(2000);
    const conocidas = new Set((reg.data || []).map((r) => String(r.username)));
    const ids = (reg.data || []).filter((r) => r.kind === 'venue' && r.venue_id).map((r) => Number(r.venue_id));
    const lugares = ids.length ? await db.from('venues').select('id,name,city').in('id', ids) : { data: [] };
    const lugarDe = new Map(
      (reg.data || [])
        .filter((r) => r.venue_id)
        .map((r) => {
          const v = (lugares.data || []).find((x) => Number(x.id) === Number(r.venue_id));
          return [String(r.username), v ? { venue: String(v.name), city: String(v.city) } : null] as const;
        }),
    );
    const saved = await db.from('instagram_pilot_items').upsert(
      rows.map((r) => ({
        ...r,
        apify_run_id: runId,
        actor,
        cohort: cohorte,
        candidate: candidatoDesdeTexto(r, lugarDe.get(r.account) ?? null),
      })),
      { onConflict: 'post_url', ignoreDuplicates: true },
    );
    if (saved.error) throw new Error('DB_ITEMS');
    // Descubrimiento: nunca entra activa; se suman apariciones independientes.
    const citadas = cuentasCitadas(rows, conocidas);
    if (citadas.length)
      await db.from('instagram_accounts').upsert(
        citadas.map((c) => ({
          username: c.username,
          status: 'candidate',
          origin: `mention:${c.origenes[0]}`,
          origin_accounts: c.origenes,
          appearances: c.apariciones,
        })),
        { onConflict: 'username', ignoreDuplicates: true },
      );
    const leidas = [...new Set(rows.map((r) => r.account))];
    // La marca avanza solo aquí (corrida exitosa) y nunca en cuentas saturadas.
    await guardarMarcas(
      db,
      marcasNuevas({
        exito: true,
        marcas,
        posts: rows.map((r) => ({ cuenta: r.account, publicado: r.posted_at ?? null })),
        porCuenta: PILOT_LIMITS.postsPerAccount,
        totalMax: maxItems,
      }),
    );
    for (const u of leidas) if (!marcas.has(u)) await db.from('instagram_accounts').update({ last_scraped_at: new Date().toISOString() }).eq('username', u);
    const cost = typeof run.usageTotalUsd === 'number' ? run.usageTotalUsd : null;
    const lleno = (f: (x: Record<string, unknown>) => unknown) => crudos.filter((x) => Boolean(f(x))).length;
    const summary = {
      cohort: cohorte,
      actor,
      accounts_requested: cuentas.length,
      accounts_read: leidas.length,
      accounts_missing: cuentas.filter((c) => !leidas.includes(c)),
      items_returned: crudos.length,
      posts_kept: rows.length,
      field_completeness: {
        timestamp: lleno((x) => x.timestamp),
        caption: lleno((x) => x.caption),
        mentions: lleno((x) => Array.isArray(x.mentions) && x.mentions.length),
        tagged_users: lleno((x) => Array.isArray(x.taggedUsers) && x.taggedUsers.length),
        coauthors: lleno((x) => Array.isArray(x.coauthorProducers) && x.coauthorProducers.length),
        location: lleno((x) => x.locationName),
        display_url: lleno((x) => x.displayUrl),
        pinned_flag: lleno((x) => typeof x.isPinned === 'boolean'),
      },
      candidate_accounts_found: citadas.length,
      cost_usd: cost,
      cap_usd: tope,
      seconds: Math.round((Date.now() - started) / 1000),
    };
    await db.from('automation_config').update({ value: `used-${marca}` }).eq('key', 'instagram_pilot');
    await db.from('instagram_pilot_runs').insert({ apify_run_id: runId, status: 'succeeded', cohort: cohorte, actor, summary });
    return reply({ success: true, apify_run_id: runId, ...summary });
  } catch (e) {
    if (runId) await api(`actor-runs/${runId}/abort`, { method: 'POST' }).catch(() => undefined);
    await db.from('automation_config').update({ value: `used-${marca}` }).eq('key', 'instagram_pilot');
    await db.from('instagram_pilot_runs').insert({
      apify_run_id: runId,
      status: 'failed',
      cohort: cohorte,
      actor,
      summary: { cohort: cohorte, actor, cap_usd: tope, error: e instanceof Error ? e.message : 'ERROR' },
    });
    return reply({ error: e instanceof Error ? e.message : 'ERROR' }, 502);
  }
}
