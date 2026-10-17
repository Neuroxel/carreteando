/**
 * Base en memoria con el subconjunto de PostgREST que usa la ingesta:
 * select/eq/neq/in/is/gte/lte/or(eq,eq)/order/limit/range, insert, upsert
 * (onConflict + ignoreDuplicates) y update. Solo para pruebas.
 */
type Fila = Record<string, any>;
type Filtro = (f: Fila) => boolean;

export function baseMemoria(tablas: Record<string, Fila[]> = {}) {
  let siguienteId = 1000;
  const tabla = (t: string) => (tablas[t] ||= []);
  const consulta = (t: string) => {
    const filtros: Filtro[] = [];
    let op: 'select' | 'update' | 'upsert' | 'insert' = 'select';
    let datos: Fila[] | Fila | null = null;
    let opciones: { onConflict?: string; ignoreDuplicates?: boolean } = {};
    let limite = Infinity;
    let desde = 0;
    let devolver = false;
    const q: any = {
      select: () => {
        if (op !== 'select') devolver = true;
        return q;
      },
      eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), q),
      neq: (c: string, v: unknown) => (filtros.push((f) => f[c] !== v), q),
      in: (c: string, v: unknown[]) => (filtros.push((f) => v.includes(f[c])), q),
      is: (c: string, v: unknown) => (filtros.push((f) => (f[c] ?? null) === v), q),
      not: (c: string, _op: string, v: unknown) => (filtros.push((f) => (f[c] ?? null) !== v), q),
      gte: (c: string, v: any) => (filtros.push((f) => f[c] >= v), q),
      lte: (c: string, v: any) => (filtros.push((f) => f[c] <= v), q),
      or: (expr: string) => {
        const partes = [...expr.matchAll(/(\w+)\.eq\."([^"]*)"/g)].map((m) => [m[1], m[2]] as const);
        filtros.push((f) => partes.some(([c, v]) => f[c] === v));
        return q;
      },
      order: () => q,
      limit: (n: number) => ((limite = n), q),
      range: (a: number, b: number) => ((desde = a), (limite = b - a + 1), q),
      update: (d: Fila) => ((op = 'update'), (datos = d), q),
      insert: (d: Fila[] | Fila) => ((op = 'insert'), (datos = d), q),
      upsert: (d: Fila[] | Fila, o: typeof opciones = {}) => ((op = 'upsert'), (datos = d), (opciones = o), q),
      then: (res: (v: unknown) => void) => {
        const filas = tabla(t);
        const pasan = (f: Fila) => filtros.every((g) => g(f));
        if (op === 'select') return res({ data: filas.filter(pasan).slice(desde, desde + limite), error: null });
        if (op === 'update') {
          const cambiadas = filas.filter(pasan);
          for (const f of cambiadas) Object.assign(f, datos);
          return res({ data: devolver ? cambiadas : null, error: null });
        }
        const lote = Array.isArray(datos) ? datos : [datos as Fila];
        const insertadas: Fila[] = [];
        for (const d of lote) {
          const clave = opciones.onConflict;
          const ya = clave ? filas.find((f) => f[clave] === d[clave]) : undefined;
          // El índice único de la base: dos filas con la misma event_key es un error.
          if (!ya && d.event_key && filas.some((f) => f.event_key === d.event_key))
            return res({ data: null, error: { message: 'duplicate key value violates unique constraint "events_canonical_key"' } });
          if (ya) {
            if (!opciones.ignoreDuplicates) Object.assign(ya, d);
            continue;
          }
          const nueva = { id: siguienteId++, disposition: 'review', ...d };
          filas.push(nueva);
          insertadas.push(nueva);
        }
        return res({ data: devolver ? insertadas : null, error: null });
      },
    };
    return q;
  };
  return { db: { from: (t: string) => consulta(t), rpc: async () => ({ data: null, error: null }) }, tablas };
}
