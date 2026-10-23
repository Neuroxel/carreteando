import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/server-db';
import { cronAutorizado } from '../../../../lib/cron-auth';
import { addDays, fechaDeLaNoche } from '../../../../lib/event-extraction';
import { saludCobertura, siguienteAccion, type FilaEvento, type FilaFuente } from '../../../../lib/salud-cobertura';
import { estadosDeFuentes, reporteCobertura } from '../../../../lib/coverage';
import { SOURCES } from '../../../../lib/sources/registry';
import { getPublicSnapshot } from '../../../../lib/snapshot';
import { PASSLINE_COLA, passlineDelDia } from '../../../../lib/passline';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * Reporte interno de cobertura (operación/Work). Mismo permiso que el cron.
 * Solo agregados y estados: ningún secreto, ningún dato personal.
 * ?fecha=YYYY-MM-DD (por defecto, la fecha de la noche en Chile).
 */
export async function GET(request: Request) {
  const db = getAdminDb();
  if (!db) return reply({ error: 'Configuración incompleta.' }, 503);
  if (!(await cronAutorizado(request, db))) return reply({ error: 'Unauthorized' }, 401);
  const ahora = new Date();
  const pedida = new URL(request.url).searchParams.get('fecha');
  const fecha = pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : fechaDeLaNoche(ahora);
  const [fuentes, eventos, snap, corrida] = await Promise.all([
    db
      .from('event_sources')
      .select('id,active,last_checked_at,last_success_at,last_error,consecutive_failures,candidate_count,parse_failure_count,next_check_at'),
    db.from('events').select('city,date_text,disposition,source_id').gte('date_text', fecha).lte('date_text', addDays(fecha, 6)).limit(5000),
    getPublicSnapshot().catch(() => null),
    db.from('ingestion_runs').select('status,started_at,completed_at,error_code').order('started_at', { ascending: false }).limit(1),
  ]);
  if (fuentes.error || eventos.error) return reply({ error: 'DB' }, 503);
  const salud = saludCobertura({
    ahora,
    fecha,
    snapshotGeneradoEn: snap?.generatedAt ?? null,
    fuentes: (fuentes.data || []) as FilaFuente[],
    registro: SOURCES,
    eventos: (eventos.data || []) as FilaEvento[],
  });
  const estados = await estadosDeFuentes(db, fecha, 7, [], ahora);
  const cobertura = reporteCobertura(estados, fecha, { ahora });
  // Valparaíso y Viña primero: el corredor con más actividad.
  const prioridad = (c: string) => (c === 'Valparaíso' ? 0 : c === 'Viña del Mar' || c === 'Reñaca' ? 1 : 2);
  const locales = cobertura.locales
    .map((l) => ({
      slug: l.slug,
      nombre: l.nombre,
      comuna: l.comuna,
      estado: l.estado,
      rutas: l.rutas.map((r) => ({ tipo: r.tipo, acceso: r.acceso, estado: r.estado, revisada: r.revisadaEn })),
      siguiente: siguienteAccion(l),
    }))
    .sort((a, b) => prioridad(a.comuna) - prioridad(b.comuna) || a.nombre.localeCompare(b.nombre, 'es'));
  return reply({
    ...salud,
    ultima_corrida: corrida.data?.[0] ?? null,
    passline_hoy: passlineDelDia(PASSLINE_COLA, fecha),
    locales: { resumen: cobertura.resumen, detalle: locales },
  });
}
