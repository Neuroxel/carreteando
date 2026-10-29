import { normalizeText } from './event-extraction';
import { SOURCES } from './ingestion';

/**
 * Instagram incremental de verdad: cada cuenta tiene su marca de agua
 * (instagram_accounts.last_post_at, la publicación más nueva ya procesada).
 *  - Ventana pedida al actor: desde la marca más vieja del lote menos un
 *    solape de seguridad (12 h), nunca más atrás que el máximo (14 días).
 *    El actor acepta una sola ventana para todas las cuentas; lo repetido se
 *    descarta por post_id.
 *  - La marca solo avanza tras una corrida exitosa y NO avanza si la cuenta (o
 *    la corrida) quedó saturada: con el tope lleno pudo quedar algo más viejo
 *    sin leer, y avanzar lo saltaría para siempre.
 */
export const SOLAPE_HORAS = 12;
export const MAX_DIAS = 14;

export function desdeCuenta(marca: string | null | undefined, ahora: Date, maxDias = MAX_DIAS) {
  const piso = ahora.getTime() - maxDias * 86_400_000;
  const m = marca ? Date.parse(marca) : NaN;
  return new Date(Number.isFinite(m) ? Math.max(piso, m - SOLAPE_HORAS * 3_600_000) : piso);
}

/** onlyPostsNewerThan para el actor ("N days"), desde la cuenta más atrasada. */
export function ventanaActor(cuentas: readonly string[], marcas: Map<string, string | null>, ahora: Date, maxDias = MAX_DIAS) {
  const desde = cuentas.map((c) => desdeCuenta(marcas.get(c) ?? null, ahora, maxDias).getTime());
  const masVieja = desde.length ? Math.min(...desde) : ahora.getTime() - maxDias * 86_400_000;
  const dias = Math.max(1, Math.min(maxDias, Math.ceil((ahora.getTime() - masVieja) / 86_400_000)));
  return `${dias} days`;
}

/** Marcas nuevas a guardar: solo cuentas no saturadas, con algo más nuevo, tras éxito. */
export function marcasNuevas(p: {
  exito: boolean;
  marcas: Map<string, string | null>;
  posts: { cuenta: string; publicado: string | null }[];
  porCuenta: number;
  totalMax: number;
}) {
  const nuevas = new Map<string, string>();
  if (!p.exito || p.posts.length >= p.totalMax) return nuevas;
  const grupos = new Map<string, string[]>();
  for (const x of p.posts) if (x.publicado) grupos.set(x.cuenta, [...(grupos.get(x.cuenta) || []), x.publicado]);
  const conteo = new Map<string, number>();
  for (const x of p.posts) conteo.set(x.cuenta, (conteo.get(x.cuenta) || 0) + 1);
  for (const [cuenta, fechas] of grupos) {
    if ((conteo.get(cuenta) || 0) >= p.porCuenta) continue; // saturada: no avanza
    const max = fechas.sort().pop() as string;
    const prev = p.marcas.get(cuenta);
    if (!prev || Date.parse(max) > Date.parse(prev)) nuevas.set(cuenta, new Date(max).toISOString());
  }
  return nuevas;
}

type Db = { from: (t: string) => any };
export async function leerMarcas(db: Db, cuentas: readonly string[]) {
  const marcas = new Map<string, string | null>();
  const r = await db.from('instagram_accounts').select('username,last_post_at').in('username', [...cuentas]);
  if (!r.error) for (const f of (r.data || []) as { username: string; last_post_at: string | null }[]) marcas.set(f.username, f.last_post_at);
  return marcas;
}
export async function guardarMarcas(db: Db, nuevas: Map<string, string>, ahora = new Date()) {
  for (const [username, last_post_at] of nuevas)
    await db.from('instagram_accounts').update({ last_post_at, last_scraped_at: ahora.toISOString() }).eq('username', username);
}

/** Cuántas cuentas válidas había en la selección (propiedad no enumerable). */
export const VALIDAS = Symbol('validas');
/** Cuántas plazas de esta selección fueron reintentos (propiedad no enumerable). */
export const REINTENTADAS = Symbol('reintentadas');
/** Reintentos de cuentas que fallaron: a lo más `reintentos` plazas por corrida y sólo pasado el backoff. */
export const REINTENTOS_POR_CORRIDA = 1;
export const BACKOFF_REINTENTO_HORAS = 6;
/** Sólo se reintenta un fallo reciente de una cuenta que ya tuvo una lectura completa. */
export const REINTENTO_MAX_DIAS = 3;
/** El cron de ingesta corre una vez al día (vercel.json: 0 18 * * *). */
export const CORRIDAS_POR_DIA = 1;
/**
 * Solo cuentas activas de recintos aprobados cuyo Instagram coincide con el registro.
 * Rotación: primero las nunca revisadas y luego la revisión más antigua. Una cuenta
 * cuyo último intento no fue una lectura completa (last_checked_at posterior a
 * last_scraped_at) es "fallida": nunca entra por la rotación normal, sólo por la plaza
 * de reintento (a lo más `reintentos` por corrida), tras el backoff y sólo si su fallo
 * es reciente (≤ REINTENTO_MAX_DIAS desde su última lectura completa). El backoff es
 * global: ninguna cuenta cuyo último intento falló vuelve antes de él. Una cuenta que
 * nunca entrega datos o lleva días fallando vuelve a la rotación común cuando le toca
 * por antigüedad, así no ocupa la plaza de reintento todos los días.
 */
export function seleccionarCuentas(rows: { username: string; venue_id: number | null; city: string | null; last_checked_at: string | null; last_scraped_at?: string | null; venues: { id: number; name: string; city: string; is_active: boolean; moderation_status: string; instagram_url: string | null } | { id: number; name: string; city: string; is_active: boolean; moderation_status: string; instagram_url: string | null }[] | null }[], limite = 5, opciones: { ahora?: Date; reintentos?: number; backoffHoras?: number } = {}) {
  const validas: Record<string, { venue: string; city: string; identity: string }> = Object.create(null);
  const ordered = [...rows].sort((a, b) => (a.last_checked_at || '').localeCompare(b.last_checked_at || '') || a.username.localeCompare(b.username));
  for (const row of ordered) {
    const v = Array.isArray(row.venues) ? (row.venues.length === 1 ? row.venues[0] : null) : row.venues;
    if (!v || !v.is_active || v.moderation_status !== 'approved' || !row.venue_id || row.venue_id !== v.id || !/^[a-z0-9._]{1,30}$/.test(row.username) || !v.name || !v.city || (row.city && row.city !== v.city)) continue;
    let url: URL;
    try { url = new URL(v.instagram_url || ''); } catch { continue; }
    if (!['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase()) || url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase() !== row.username) continue;
    // Conserva las identidades históricas, también para alias nuevos del mismo local.
    const sameVenue = (source: { venue: string; city: string }) =>
      normalizeText(source.venue) === normalizeText(v.name) && normalizeText(source.city) === normalizeText(v.city);
    const historicAccount = Object.hasOwn(SOURCES, row.username) ? SOURCES[row.username] : null;
    if (historicAccount && !sameVenue(historicAccount)) continue;
    const identities = [...new Set(Object.values(SOURCES).filter(sameVenue).map((source) => source.identity))];
    if (identities.length > 1) continue;
    validas[row.username] = { venue: v.name, city: v.city, identity: identities[0] || `venue-${v.id}` };
  }
  const ahora = (opciones.ahora ?? new Date()).getTime();
  const espera = (opciones.backoffHoras ?? BACKOFF_REINTENTO_HORAS) * 3_600_000;
  const fallo = (r: (typeof rows)[number]) => Boolean(r.last_checked_at) && (!r.last_scraped_at || r.last_scraped_at < r.last_checked_at!);
  // Fallo reciente de una cuenta que sí se leyó antes: candidata a reintento, tras el backoff.
  const reciente = (r: (typeof rows)[number]) =>
    fallo(r) && Boolean(r.last_scraped_at) && Date.parse(r.last_checked_at!) - Date.parse(r.last_scraped_at!) <= REINTENTO_MAX_DIAS * 86_400_000;
  const listaReintento = (r: (typeof rows)[number]) => reciente(r) && Date.parse(r.last_checked_at!) <= ahora - espera;
  const reintentar = ordered.filter((r) => r.username in validas && listaReintento(r)).slice(0, opciones.reintentos ?? REINTENTOS_POR_CORRIDA).map((r) => r.username);
  // Rotación común: nunca una cuenta con fallo reciente (ésas sólo por la plaza de reintento),
  // y el backoff es global: ninguna cuenta cuyo último intento falló vuelve antes de `espera`,
  // tampoco una nunca leída o con fallo antiguo, aunque sobren plazas.
  const enBackoff = (r: (typeof rows)[number]) => fallo(r) && Date.parse(r.last_checked_at!) > ahora - espera;
  const rotacion = ordered.filter((r) => r.username in validas && !reciente(r) && !enBackoff(r) && !reintentar.includes(r.username)).map((r) => r.username);
  const elegidas = [...reintentar, ...rotacion].slice(0, limite);
  const result: Record<string, { venue: string; city: string; identity: string }> = Object.create(null);
  for (const u of elegidas) result[u] = validas[u];
  Object.defineProperty(result, VALIDAS, { value: Object.keys(validas).length, enumerable: false });
  Object.defineProperty(result, REINTENTADAS, { value: reintentar.filter((u) => elegidas.includes(u)).length, enumerable: false });
  return result;
}

/**
 * Cobertura honesta de la rotación: cuántos días tarda en volver a cada cuenta frente a
 * la ventana del actor. No promete cobertura: si el ciclo no cabe en la ventana, lo dice
 * (y cuántas plazas harían falta) para que operación decida presupuesto o plazas.
 * Además, una cuenta que publica más que `porCuenta` posts en la ventana, o una corrida
 * que llega a `totalMax`, queda saturada: no avanza su marca y se relee (sin perder posts
 * nuevos, pero las más antiguas pueden quedar fuera de la ventana).
 */
export function coberturaRotacion(p: { validas: number; plazas: number; reintentos: number; corridasPorDia?: number; ventanaDias?: number }) {
  const rotacion = Math.max(1, p.plazas - p.reintentos);
  const corridasPorDia = p.corridasPorDia ?? CORRIDAS_POR_DIA;
  const ventanaDias = p.ventanaDias ?? MAX_DIAS;
  const cicloDias = Math.ceil(p.validas / rotacion) / corridasPorDia;
  // Margen del solape: el ciclo debe caber con al menos SOLAPE_HORAS de holgura.
  const suficiente = cicloDias * 24 + SOLAPE_HORAS <= ventanaDias * 24;
  const diasUtiles = ventanaDias - SOLAPE_HORAS / 24;
  const plazasNecesarias = Math.ceil(p.validas / Math.max(1, Math.floor(diasUtiles * corridasPorDia))) + p.reintentos;
  return { validas: p.validas, plazas_rotacion: rotacion, ciclo_dias: cicloDias, ventana_dias: ventanaDias, suficiente, plazas_necesarias: plazasNecesarias };
}

/** Una cuenta solo se declara leída si hay evidencia identificable y no está saturada. */
export function cuentasCompletas(cuentas: string[], posts: { cuenta: string | null; publicado: string | null; error: boolean }[], porCuenta: number, totalMax: number) {
  if (posts.length >= totalMax || posts.some(p => !p.cuenta || p.error)) return [];
  return cuentas.filter(cuenta => {
    const grupo = posts.filter(p => p.cuenta === cuenta);
    return grupo.length > 0 && grupo.length < porCuenta && grupo.every(p => p.publicado && Number.isFinite(Date.parse(p.publicado)));
  });
}
