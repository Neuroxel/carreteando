import { minutosDelDia } from './occurrence';

/**
 * Estado temporal de un evento, sin inventar duraciones:
 * 1. con final explícito y ya pasado → `finalizado`;
 * 2. comienzo en el futuro → `proximo`;
 * 3. comienzo pasado y sin final explícito → `iniciado` ("Ya empezó"), nunca terminado;
 * 4. sin hora conocida → `sin_hora`.
 * No hay duración por defecto: si algún día se quiere una, tiene que ser una
 * política de producto explícita y versionada, no un supuesto escondido aquí.
 */
export type EstadoTemporal = 'proximo' | 'sin_hora' | 'iniciado' | 'finalizado';
export const ORDEN_TEMPORAL: Record<EstadoTemporal, number> = { proximo: 0, sin_hora: 1, iniciado: 2, finalizado: 3 };

export interface AhoraChile {
  fecha: string;
  minutos: number;
}
export function ahoraEnChile(now: Date = new Date()): AhoraChile {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return { fecha: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

const MIN_DIA = 24 * 60;
/** Minutos desde la medianoche del día de hoy (puede ser negativo o mayor que un día). */
function minutosRelativos(fecha: string, minutos: number, hoy: string) {
  const dias = Math.round((Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);
  return dias * MIN_DIA + minutos;
}

export function estadoTemporal(e: { fecha: string; hora?: string | null; fin?: string | null }, ahora: AhoraChile): EstadoTemporal {
  const inicio = minutosDelDia(e.hora);
  const fin = minutosDelDia(e.fin);
  if (inicio !== null && fin !== null) {
    // Un final menor que el inicio cae al día siguiente (23:00 → 04:00).
    const finAbs = minutosRelativos(e.fecha, fin + (fin <= inicio ? MIN_DIA : 0), ahora.fecha);
    if (finAbs <= ahora.minutos) return 'finalizado';
  }
  if (e.fecha > ahora.fecha) return 'proximo';
  if (inicio === null) return e.fecha === ahora.fecha ? 'sin_hora' : 'iniciado';
  return minutosRelativos(e.fecha, inicio, ahora.fecha) > ahora.minutos ? 'proximo' : 'iniciado';
}

/** Orden estable: próximos, sin hora, iniciados y finalizados; dentro de cada grupo, el orden de entrada. */
export function porEstadoTemporal<T extends { fecha: string; hora?: string | null; fin?: string | null }>(lista: T[], ahora: AhoraChile) {
  return lista
    .map((e, i) => ({ e, i, o: ORDEN_TEMPORAL[estadoTemporal(e, ahora)] }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map((x) => x.e);
}
