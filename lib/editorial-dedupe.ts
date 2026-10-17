/**
 * Antes de insertar una fila editorial se mira la base entera, en TODOS sus
 * estados (pública, en cola, inactiva, rechazada, duplicada). Si la misma
 * ficha de origen ya existe para esa fecha, la fila editorial no entra: lo
 * privado sigue privado, lo rechazado sigue rechazado y nada se reactiva.
 *
 * Caso real (17-oct-2026): "Cómpeta en Atril Azul" ya estaba en cola desde el
 * listado regional de PortalTickets con otra clave; el snapshot público no lo
 * mostraba y la fila editorial lo habría duplicado.
 */
type Db = { from: (table: string) => any };
type FilaEditorial = { instagram_id: string; instagram_url: string; date_text: string };
type Existente = {
  id: number;
  instagram_id: string | null;
  date_text: string | null;
  instagram_url: string | null;
  source_detail_url: string | null;
  disposition?: string | null;
  moderation_status?: string | null;
};

/** La misma ficha aunque cambie `www.`, el esquema o la barra final; nunca otra ruta. */
export function urlComparable(valor: string | null | undefined) {
  if (!valor) return null;
  try {
    const u = new URL(valor);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const ruta = u.pathname.replace(/\/+$/, '') || '/';
    return `${host}${ruta}${u.search}`;
  } catch {
    return null;
  }
}

export function separarExistentes<T extends FilaEditorial>(filas: T[], existentes: Existente[]) {
  const porClave = new Map<string, Existente>();
  for (const e of existentes) {
    if (!e.date_text) continue;
    for (const u of [e.instagram_url, e.source_detail_url]) {
      const c = urlComparable(u);
      if (c) porClave.set(`${e.date_text}|${c}`, e);
    }
  }
  const nuevas: T[] = [];
  const omitidas: { instagram_id: string; existente: number; estado: string }[] = [];
  for (const f of filas) {
    const c = urlComparable(f.instagram_url);
    const e = c ? porClave.get(`${f.date_text}|${c}`) : undefined;
    // La misma clave editorial ya insertada la resuelve el upsert; otra clave es duplicado.
    if (e && e.instagram_id !== f.instagram_id)
      omitidas.push({
        instagram_id: f.instagram_id,
        existente: e.id,
        estado: `${e.disposition || '?'}/${e.moderation_status || '?'}`,
      });
    else nuevas.push(f);
  }
  return { nuevas, omitidas };
}

/** PostgREST corta cada respuesta en 1000 filas aunque se pida más: se pagina siempre. */
export const PAGINA_DEDUPE = 1000;
/** Tope de páginas: si se alcanza sin terminar, se falla cerrado en vez de comparar contra una lista truncada. */
export const MAX_PAGINAS_DEDUPE = 20;

/**
 * Consulta por fecha (todas las disposiciones), paginada por id, y compara URLs
 * en código. Si la base falla o el resultado no cabe completo, no se inserta nada.
 */
export async function sinDuplicadosDeFuente<T extends FilaEditorial>(db: Db, filas: T[], pagina = PAGINA_DEDUPE, maxPaginas = MAX_PAGINAS_DEDUPE) {
  if (!filas.length) return { nuevas: filas, omitidas: [] as ReturnType<typeof separarExistentes>['omitidas'] };
  const fechas = [...new Set(filas.map((f) => f.date_text))];
  const existentes: Existente[] = [];
  for (let n = 0; ; n++) {
    if (n >= maxPaginas) throw new Error('DB_EDITORIAL_DEDUPE_TRUNCATED');
    const { data, error } = await db
      .from('events')
      .select('id,instagram_id,date_text,instagram_url,source_detail_url,disposition,moderation_status')
      .in('date_text', fechas)
      .order('id', { ascending: true })
      .range(n * pagina, (n + 1) * pagina - 1);
    if (error || !Array.isArray(data)) throw new Error('DB_EDITORIAL_DEDUPE');
    existentes.push(...(data as Existente[]));
    if (data.length < pagina) break;
  }
  return separarExistentes(filas, existentes);
}
