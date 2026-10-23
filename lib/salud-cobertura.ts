/**
 * Salud de la cobertura (P0 23-oct). Puro y testeable: el endpoint interno
 * junta los datos y esto decide el estado. Sin umbral fijo de "pocos eventos":
 * se mira qué fuentes críticas se leyeron, la cola de revisión y la edad del
 * snapshot.
 *  STALE: el snapshot público tiene más de 6 h.
 *  DEGRADED: PortalTickets regional sin lectura exitosa en 12 h un jue/vie/sáb
 *            (24 h otros días), o menos de la mitad de las fuentes frecuentes
 *            leídas con éxito en 24 h.
 *  REVIEW_BACKLOG: hay candidatos de hoy en revisión y la portada tiene igual o menos.
 *  HEALTHY: nada de lo anterior.
 */
import { addDays } from './event-extraction';
import { FUENTES_FRECUENTES } from './sources/dispatcher';
import type { SourceDefinition } from './sources/types';

export type EstadoSalud = 'HEALTHY' | 'DEGRADED' | 'REVIEW_BACKLOG' | 'STALE';
const GRAVEDAD: Record<EstadoSalud, number> = { HEALTHY: 0, REVIEW_BACKLOG: 1, DEGRADED: 2, STALE: 3 };
export interface FilaFuente {
  id: string;
  active: boolean;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  consecutive_failures: number | null;
  candidate_count: number | null;
  parse_failure_count: number | null;
  next_check_at: string | null;
}
export interface FilaEvento {
  city: string | null;
  date_text: string;
  disposition: string | null;
  source_id: string | null;
}
const horasDesde = (iso: string | null, ahora: Date) => (iso ? (ahora.getTime() - Date.parse(iso)) / 3600_000 : Infinity);

export function saludCobertura(e: {
  ahora: Date;
  /** Fecha de la noche (lib/event-extraction fechaDeLaNoche). */
  fecha: string;
  snapshotGeneradoEn: string | null;
  fuentes: FilaFuente[];
  registro: Pick<SourceDefinition, 'id' | 'accessMode'>[];
  eventos: FilaEvento[];
}) {
  const motivos: { estado: EstadoSalud; motivo: string }[] = [];
  const dia = new Date(`${e.fecha}T12:00:00Z`).getUTCDay();
  const findeLargo = dia >= 4 && dia <= 6;
  // Snapshot.
  const edadSnapshot = horasDesde(e.snapshotGeneradoEn, e.ahora);
  if (edadSnapshot > 6) motivos.push({ estado: 'STALE', motivo: `snapshot de hace ${Number.isFinite(edadSnapshot) ? Math.round(edadSnapshot) : '∞'} h` });
  // Fuentes.
  const porId = new Map(e.fuentes.map((f) => [f.id, f]));
  const pt = porId.get('portaldisc-region');
  const limitePt = findeLargo ? 12 : 24;
  if (!pt || horasDesde(pt.last_success_at, e.ahora) > limitePt)
    motivos.push({ estado: 'DEGRADED', motivo: `PortalTickets regional sin lectura exitosa en ${limitePt} h` });
  const frecuentes = e.registro.filter(FUENTES_FRECUENTES).map((s) => s.id);
  const sanas = frecuentes.filter((id) => horasDesde(porId.get(id)?.last_success_at ?? null, e.ahora) <= 24);
  if (frecuentes.length && sanas.length < frecuentes.length / 2)
    motivos.push({ estado: 'DEGRADED', motivo: `solo ${sanas.length} de ${frecuentes.length} fuentes frecuentes leídas en 24 h` });
  // Eventos de hoy por comuna.
  const comunas = new Map<string, { publicos: number; revision: number }>();
  let publicosHoy = 0;
  let revisionHoy = 0;
  for (const ev of e.eventos) {
    if (ev.date_text !== e.fecha) continue;
    const c = comunas.get(ev.city || 'Sin comuna') || { publicos: 0, revision: 0 };
    if (ev.disposition === 'public') {
      c.publicos++;
      publicosHoy++;
    } else if (ev.disposition === 'review') {
      c.revision++;
      revisionHoy++;
    }
    comunas.set(ev.city || 'Sin comuna', c);
  }
  if (revisionHoy > 0 && revisionHoy >= publicosHoy)
    motivos.push({ estado: 'REVIEW_BACKLOG', motivo: `${revisionHoy} candidatos de hoy en revisión y ${publicosHoy} públicos` });
  const estado = motivos.reduce<EstadoSalud>((max, m) => (GRAVEDAD[m.estado] > GRAVEDAD[max] ? m.estado : max), 'HEALTHY');
  const leidas = (h: number) => e.fuentes.filter((f) => f.active && horasDesde(f.last_checked_at, e.ahora) <= h).length;
  return {
    estado,
    motivos,
    fecha: e.fecha,
    snapshot_horas: Number.isFinite(edadSnapshot) ? Math.round(edadSnapshot * 10) / 10 : null,
    hoy: { publicos: publicosHoy, revision: revisionHoy },
    por_comuna: [...comunas].map(([comuna, v]) => ({ comuna, ...v })).sort((a, b) => b.publicos + b.revision - (a.publicos + a.revision)),
    proximos_7_dias: e.eventos.filter((ev) => ev.date_text >= e.fecha && ev.date_text <= addDays(e.fecha, 6) && ev.disposition === 'review').length,
    fuentes: {
      activas: e.fuentes.filter((f) => f.active).length,
      leidas_6h: leidas(6),
      leidas_12h: leidas(12),
      leidas_24h: leidas(24),
      fallidas: e.fuentes
        .filter((f) => f.active && (f.consecutive_failures || 0) > 0)
        .map((f) => ({ id: f.id, error: f.last_error, fallas_seguidas: f.consecutive_failures, ultima_exitosa: f.last_success_at })),
      pausadas: e.fuentes.filter((f) => !f.active).map((f) => ({ id: f.id, ultima_exitosa: f.last_success_at })),
      frecuentes: frecuentes.map((id) => {
        const f = porId.get(id);
        return { id, ultima_exitosa: f?.last_success_at ?? null, candidatos: f?.candidate_count ?? null, fallas_parseo: f?.parse_failure_count ?? null, proxima: f?.next_check_at ?? null };
      }),
    },
  };
}

/** Qué hacer con cada local según su cobertura (para el reporte por local). */
export function siguienteAccion(l: { estado: string; rutas: { acceso: string }[] }) {
  if (!l.rutas.length) return 'buscar ruta pública (Vesti, Evently, PortalTickets, sitio oficial)';
  if (l.rutas.every((r) => r.acceso === 'bloqueado')) return 'revisión humana (fuente bloqueada: cola manual)';
  if (l.estado === 'PENDING') return 'esperar lectura o activar ruta';
  if (l.estado === 'BLOCKED') return 'revisión humana';
  return 'ok';
}
