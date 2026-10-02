import { timingSafeEqual } from 'node:crypto';
import type { getAdminDb } from './server-db';
/**
 * Dos formas de probar autoridad, ninguna de las cuales expone un secreto.
 * Vercel manda su cabecera con CRON_SECRET. La propia base de datos manda un
 * pase de un solo uso que sólo ella pudo crear, porque la tabla está reservada
 * al rol de servicio: así el programador de Postgres no necesita que nadie
 * copie un secreto a mano.
 */
export async function cronAutorizado(request: Request, db: ReturnType<typeof getAdminDb>) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  if (secret) {
    const expected = `Bearer ${secret}`;
    if (
      Buffer.byteLength(auth) === Buffer.byteLength(expected) &&
      timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
    )
      return true;
  }
  const ticket = new URL(request.url).searchParams.get('ticket');
  if (!ticket || !/^[a-f0-9]{48}$/.test(ticket) || !db) return false;
  const { data, error } = await db.rpc('redeem_cron_ticket', { p_nonce: ticket });
  return !error && data === true;
}
