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
