/**
 * Identidad de ocurrencia: una función concreta de un espectáculo.
 *
 * - La MISMA función encontrada por dos fuentes es una sola ocurrencia, aunque
 *   una diga la apertura (20:00) y otra el show (21:00).
 * - DOS funciones reales del mismo espectáculo el mismo día (20:00 y 22:00)
 *   son dos ocurrencias y ninguna pisa a la otra.
 *
 * La regla es explícita: misma fecha, mismo lugar, título equivalente y horas
 * compatibles. Dos horas son compatibles si falta alguna o si difieren en a lo
 * más `TOLERANCIA_MISMA_FUNCION_MIN` minutos. La hora nunca se agrega al título
 * visible: vive en la clave.
 */
export const TOLERANCIA_MISMA_FUNCION_MIN = 60;

export function minutosDelDia(hora: string | null | undefined): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)/.exec(hora || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function horasCompatibles(a: string | null | undefined, b: string | null | undefined) {
  const x = minutosDelDia(a);
  const y = minutosDelDia(b);
  if (x === null || y === null) return true;
  return Math.abs(x - y) <= TOLERANCIA_MISMA_FUNCION_MIN;
}

/** Sufijo de clave para la hora: "2000". Vacío si la hora no se conoce. */
export function sufijoHora(hora: string | null | undefined) {
  const m = minutosDelDia(hora);
  return m === null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`;
}

/**
 * Agrupa filas en ocurrencias por hora: cada grupo reúne horas compatibles con
 * la primera hora conocida del grupo. Las filas sin hora se suman al primer
 * grupo, salvo que haya más de una función conocida: entonces quedan solas,
 * porque no se puede decidir a cuál pertenecen.
 */
export function agruparPorHora<T>(filas: T[], hora: (f: T) => string | null | undefined): T[][] {
  const conHora = filas.filter((f) => minutosDelDia(hora(f)) !== null);
  const sinHora = filas.filter((f) => minutosDelDia(hora(f)) === null);
  const grupos: T[][] = [];
  for (const f of [...conHora].sort((a, b) => (minutosDelDia(hora(a)) as number) - (minutosDelDia(hora(b)) as number))) {
    const g = grupos.find((x) => horasCompatibles(hora(x[0]), hora(f)));
    if (g) g.push(f);
    else grupos.push([f]);
  }
  if (grupos.length <= 1) return grupos.length ? [[...grupos[0], ...sinHora]] : sinHora.length ? [sinHora] : [];
  return [...grupos, ...sinHora.map((f) => [f])];
}
