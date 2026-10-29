/**
 * Presupuesto mensual de Apify. `maxTotalChargeUsd` solo acota una corrida;
 * el mes se lleva con lo que la base ya registró (ingesta + piloto) y, si el
 * token responde, con el consumo que informa Apify: se usa el mayor de los dos.
 * Ante cualquier duda (base o API que fallan) no se corre: falla cerrado.
 */
export type LimitesApify = { soft: number; hard: number; porCorrida: number };
export type DecisionApify =
  | { correr: true; maxTotalChargeUsd: number; gastadoMes: number; restante: number }
  | { correr: false; motivo: 'APIFY_MONTHLY_BUDGET' | 'APIFY_SOFT_DAILY' | 'APIFY_BUDGET_UNKNOWN'; gastadoMes: number | null; restante: number | null };

const numero = (v: string | undefined, def: number) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : def;
};
export function limitesApify(env: Record<string, string | undefined> = process.env): LimitesApify {
  const hard = numero(env.APIFY_MONTHLY_HARD_USD, 3);
  return {
    hard,
    soft: Math.min(numero(env.APIFY_MONTHLY_SOFT_USD, 2.5), hard),
    porCorrida: numero(env.APIFY_RUN_CAP_USD, 0.05),
  };
}

const centavos = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Regla pura. Nunca se inicia una corrida cuyo peor caso lleve el mes sobre el
 * tope duro; pasado el tope blando, a lo más una corrida por día (UTC).
 */
export function decidirCorrida(p: { gastadoMes: number | null; corridasHoy: number; limites: LimitesApify; topePedido?: number }): DecisionApify {
  const { gastadoMes, corridasHoy, limites } = p;
  if (gastadoMes === null || !Number.isFinite(gastadoMes)) return { correr: false, motivo: 'APIFY_BUDGET_UNKNOWN', gastadoMes: null, restante: null };
  const restante = centavos(Math.max(0, limites.hard - gastadoMes));
  const tope = centavos(Math.min(limites.porCorrida, p.topePedido ?? Infinity));
  if (tope <= 0 || gastadoMes + tope > limites.hard) return { correr: false, motivo: 'APIFY_MONTHLY_BUDGET', gastadoMes, restante };
  if (gastadoMes >= limites.soft && corridasHoy >= 1) return { correr: false, motivo: 'APIFY_SOFT_DAILY', gastadoMes, restante };
  return { correr: true, maxTotalChargeUsd: tope, gastadoMes, restante };
}

type Db = { from: (t: string) => any };
type FilaIngesta = { started_at?: string | null; apify_run_id?: string | null; cost_usd?: number | string | null };
type FilaPiloto = { created_at?: string | null; apify_run_id?: string | null; summary?: { cost_usd?: unknown; cap_usd?: unknown } | null };

/** Inicio del mes y del día en UTC: Apify factura por mes calendario UTC. */
export function ventanasUtc(ahora: Date) {
  const mes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1)).toISOString();
  const dia = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())).toISOString();
  return { mes, dia };
}

/**
 * Lo gastado en el mes según la base. Una corrida con id de Apify y sin costo
 * registrado (cortada, sin respuesta) se cuenta por su tope: nunca por cero.
 */
export async function gastoRegistrado(db: Db, ahora: Date, topeSinCosto: number) {
  const { mes, dia } = ventanasUtc(ahora);
  const [ing, pil] = await Promise.all([
    db.from('ingestion_runs').select('started_at,apify_run_id,cost_usd').gte('started_at', mes).not('apify_run_id', 'is', null).limit(1000),
    db.from('instagram_pilot_runs').select('created_at,apify_run_id,summary').gte('created_at', mes).limit(1000),
  ]);
  if (ing.error || pil.error) throw new Error('APIFY_LEDGER_UNREADABLE');
  let total = 0;
  let hoy = 0;
  for (const r of (ing.data || []) as FilaIngesta[]) {
    if (!r.apify_run_id) continue;
    const c = Number(r.cost_usd);
    total += r.cost_usd !== null && r.cost_usd !== undefined && Number.isFinite(c) ? c : topeSinCosto;
    if ((r.started_at || '') >= dia) hoy += 1;
  }
  for (const r of (pil.data || []) as FilaPiloto[]) {
    const c = Number(r.summary?.cost_usd);
    const cap = Number(r.summary?.cap_usd);
    total += Number.isFinite(c) && r.summary?.cost_usd !== null && r.summary?.cost_usd !== undefined ? c : Number.isFinite(cap) ? cap : r.apify_run_id ? topeSinCosto : 0;
    if ((r.created_at || '') >= dia) hoy += 1;
  }
  return { gastadoMes: centavos(total), corridasHoy: hoy };
}

/** Consumo del ciclo según Apify. null si no se pudo leer (no se inventa cero). */
export async function consumoApify(token: string, fetcher: typeof fetch = fetch): Promise<number | null> {
  try {
    const r = await fetcher('https://api.apify.com/v2/users/me/limits', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const usd = Number((await r.json())?.data?.current?.monthlyUsageUsd);
    return Number.isFinite(usd) && usd >= 0 ? usd : null;
  } catch {
    return null;
  }
}

/**
 * Decide si se puede iniciar una corrida ahora. La base es obligatoria; el
 * consumo de Apify es obligatorio y solo puede subir la cifra (cubre corridas
 * lanzadas fuera de esta app con el mismo token).
 */
export async function presupuestoApify(
  db: Db,
  opciones: { token?: string; ahora?: Date; topePedido?: number; env?: Record<string, string | undefined>; fetcher?: typeof fetch } = {},
): Promise<DecisionApify> {
  const limites = limitesApify(opciones.env);
  let registro: { gastadoMes: number; corridasHoy: number };
  try {
    registro = await gastoRegistrado(db, opciones.ahora || new Date(), limites.porCorrida);
  } catch {
    return decidirCorrida({ gastadoMes: null, corridasHoy: 0, limites });
  }
  const apify = opciones.token ? await consumoApify(opciones.token, opciones.fetcher) : null;
  if (apify === null) return decidirCorrida({ gastadoMes: null, corridasHoy: registro.corridasHoy, limites });
  const gastadoMes = Math.max(registro.gastadoMes, apify);
  return decidirCorrida({ gastadoMes, corridasHoy: registro.corridasHoy, limites, topePedido: opciones.topePedido });
}
