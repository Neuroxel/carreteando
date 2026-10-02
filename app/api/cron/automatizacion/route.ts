import { NextResponse } from 'next/server';
import { cronAutorizado } from '../../../../lib/cron-auth';
import { getAdminDb } from '../../../../lib/server-db';
import { backtest, reevaluate } from '../../../../lib/sources/automation';
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
  if (modo === 'backtest') return reply(await backtest(db));
  return reply(await reevaluate(db));
}
