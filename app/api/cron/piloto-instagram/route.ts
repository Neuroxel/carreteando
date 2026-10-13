import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/server-db';
import { cronAutorizado } from '../../../../lib/cron-auth';
import { PILOT_COHORTS, PILOT_LIMITS, pilotItem, type Cohorte } from '../../../../lib/instagram-pilot';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
/**
 * Una corrida por cohorte, armada a mano en la base
 * (automation_config.instagram_pilot = 'armed-A' o 'armed-B') y consumida al
 * empezar: cada cohorte corre a lo más una vez y con su propio tope de 1 USD. No depende de APIFY_PAUSED, que sigue en
 * true: la ingesta diaria no vuelve a raspar Instagram. No crea eventos.
 */
export async function GET(request: Request) {
  const db = getAdminDb();
  const token = process.env.APIFY_API_TOKEN;
  if (!db || !token) return reply({ error: 'Configuración incompleta.' }, 503);
  if (!(await cronAutorizado(request, db))) return reply({ error: 'Unauthorized' }, 401);
  const actor = process.env.APIFY_ACTOR || 'apify~instagram-scraper';
  if (!/^[\w~-]+$/.test(actor)) return reply({ error: 'APIFY_ACTOR inválido.' }, 503);
  const cohorte = new URL(request.url).searchParams.get('cohorte') as Cohorte | null;
  if (cohorte !== 'A' && cohorte !== 'B') return reply({ error: 'Cohorte inválida (A o B).' }, 400);
  const cuentas: readonly string[] = PILOT_COHORTS[cohorte];
  const armed = await db
    .from('automation_config')
    .update({ value: `running-${cohorte}` })
    .eq('key', 'instagram_pilot')
    .eq('value', `armed-${cohorte}`)
    .select('key');
  if (armed.error || !armed.data?.length) return reply({ error: `La cohorte ${cohorte} no está armada.` }, 409);
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
    const start = obj(
      (await api(
        `acts/${actor}/runs?timeout=240&maxItems=${PILOT_LIMITS.maxItems}&maxTotalChargeUsd=${PILOT_LIMITS.maxTotalChargeUsd}`,
        {
          method: 'POST',
          body: JSON.stringify({
            directUrls: cuentas.map((h) => `https://www.instagram.com/${h}/`),
            resultsType: 'posts',
            resultsLimit: PILOT_LIMITS.postsPerAccount,
            onlyPostsNewerThan: PILOT_LIMITS.newerThan,
            addParentData: false,
          }),
        },
      )) as unknown,
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
    const raw = await api(`datasets/${datasetId}/items?format=json&clean=true&limit=100`);
    const rows = (Array.isArray(raw) ? raw : []).map((x) => pilotItem(obj(x), cuentas)).filter((x) => x !== null);
    const cost = typeof run.usageTotalUsd === 'number' ? run.usageTotalUsd : null;
    const accountsRead = new Set(rows.map((r) => r.account)).size;
    const saved = await db.from('instagram_pilot_items').upsert(
      rows.map((r) => ({ ...r, apify_run_id: runId })),
      { onConflict: 'post_url', ignoreDuplicates: true },
    );
    if (saved.error) throw new Error('DB_ITEMS');
    const summary = {
      cohort: cohorte,
      accounts_requested: cuentas.length,
      accounts_read: accountsRead,
      items_returned: Array.isArray(raw) ? raw.length : 0,
      posts_kept: rows.length,
      cost_usd: cost,
      seconds: Math.round((Date.now() - started) / 1000),
    };
    await db.from('automation_config').update({ value: `used-${cohorte}` }).eq('key', 'instagram_pilot');
    await db.from('instagram_pilot_runs').insert({ apify_run_id: runId, status: 'succeeded', summary });
    return reply({ success: true, apify_run_id: runId, ...summary });
  } catch (e) {
    if (runId) await api(`actor-runs/${runId}/abort`, { method: 'POST' }).catch(() => undefined);
    await db.from('automation_config').update({ value: `used-${cohorte}` }).eq('key', 'instagram_pilot');
    await db.from('instagram_pilot_runs').insert({ apify_run_id: runId, status: 'failed', summary: { cohort: cohorte, error: e instanceof Error ? e.message : 'ERROR' } });
    return reply({ error: e instanceof Error ? e.message : 'ERROR' }, 502);
  }
}
