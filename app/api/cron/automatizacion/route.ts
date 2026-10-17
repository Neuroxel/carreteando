import { NextResponse } from 'next/server';
import { refrescarPublico } from '../../../../lib/snapshot';
import { cronAutorizado } from '../../../../lib/cron-auth';
import { getAdminDb } from '../../../../lib/server-db';
import { backtest, reevaluate } from '../../../../lib/sources/automation';
import { editorialRows } from '../../../../lib/editorial-feed';
import { sinDuplicadosDeFuente } from '../../../../lib/editorial-dedupe';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
/**
 * Reevaluación de la cola sin esperar la próxima ingesta, y backtest del motor
 * sobre el histórico. Misma autoridad que el cron: pase de un solo uso emitido
 * por la base o la cabecera de Vercel.
 */
export async function GET(request: Request) {
  const db = getAdminDb();
  if (!db) return reply({ error: 'Base no disponible.' }, 503);
  if (!(await cronAutorizado(request, db))) return reply({ error: 'Unauthorized' }, 401);
  const modo = new URL(request.url).searchParams.get('modo');
  // Cierre de una revisión editorial directa: misma autoridad, sin reevaluar la cola.
  if (modo === 'refresh') return reply({ snapshot_refreshed: await refrescarPublico() });
  if (modo === 'backtest') return reply(await backtest(db));
  // La selección editorial (puente manual, programas oficiales) entra también
  // aquí, sin esperar la próxima ingesta. Solo inserta: nunca pisa nada.
  // Misma ficha y fecha ya en la base, en cualquier estado: no se duplica ni se
  // reactiva. Si no se puede comprobar, no se inserta (falla cerrado).
  let editorialInsertados = 0;
  let editorialOmitidas: unknown[] = [];
  let editorialError: string | null = null;
  try {
    const { nuevas, omitidas } = await sinDuplicadosDeFuente(db, editorialRows());
    editorialOmitidas = omitidas;
    if (nuevas.length) {
      const { data } = await db
        .from('events')
        .upsert(nuevas, { onConflict: 'instagram_id', ignoreDuplicates: true })
        .select('instagram_id');
      editorialInsertados = data?.length || 0;
    }
  } catch (e) {
    editorialError = e instanceof Error ? e.message : 'DB_EDITORIAL_DEDUPE';
  }
  const r = await reevaluate(db);
  if (r.applied > 0 || editorialInsertados > 0) await refrescarPublico();
  return reply({ ...r, editorialInsertados, editorialOmitidas, editorialError });
}
