import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { getAdminDb } from './server-db';
const cookieName =
  process.env.NODE_ENV === 'production' ? '__Host-carreteando-admin' : 'carreteando-admin';
// A secret stored with a stray newline used to fail as "clave incorrecta",
// which is indistinguishable from a wrong key and impossible to debug.
export function normalizeSecret(raw: string | undefined) {
  const value = raw?.trim();
  return value && value.length >= 43 ? value : null;
}
function key() {
  return normalizeSecret(process.env.ADMIN_ACCESS_TOKEN);
}
export function sameSecret(a: string, b: string) {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}
function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(`admin-session-v1|${payload}`).digest('base64url');
}
/**
 * La sesión lleva quién es: la auditoría tiene que poder decir quién hizo cada
 * cambio, y con una sola credencial compartida nunca podría.
 */
export function sessionActor(
  value: string | undefined,
  secret: string | null,
  now = Date.now(),
): string | null {
  if (!secret || !value || value.length > 300) return null;
  const [expires, nonce, actor, signature, extra] = value.split('.');
  if (extra || !signature || !/^\d{13}$/.test(expires) || !/^[a-f0-9]{32}$/.test(nonce))
    return null;
  if (!actor || !/^[A-Za-z0-9_-]{1,120}$/.test(actor)) return null;
  const remaining = Number(expires) - now;
  if (remaining <= 0 || remaining > 7200000) return null;
  if (!sameSecret(signature, sign(`${expires}.${nonce}.${actor}`, secret))) return null;
  try {
    return Buffer.from(actor, 'base64url').toString('utf8').slice(0, 60) || null;
  } catch {
    return null;
  }
}
export function validSession(value: string | undefined, secret: string | null, now = Date.now()) {
  return sessionActor(value, secret, now) !== null;
}
export async function isAdmin() {
  return validSession((await cookies()).get(cookieName)?.value, key());
}
/** Quién está moderando, para escribirlo en la auditoría. */
export async function currentActor() {
  return sessionActor((await cookies()).get(cookieName)?.value, key());
}
// Four different failures used to produce one identical message, so a stale
// deployment, a missing service key and a genuinely wrong clave were
// indistinguishable from the outside and from the logs. The cause is now named
// server-side; the browser still learns only that the login did not work.
export type LoginOutcome = 'ok' | 'no-secret' | 'no-db' | 'db-error' | 'rate-limited' | 'mismatch';
export function loginOutcome(
  given: string,
  secret: string | null,
  hasDb: boolean,
  quota: true | false | 'error',
  moderador: string | null = null,
): LoginOutcome {
  if (!secret) return 'no-secret';
  if (!hasDb) return 'no-db';
  if (quota === 'error') return 'db-error';
  if (quota === false) return 'rate-limited';
  if (given.length > 200) return 'mismatch';
  // La clave del propietario o la de un moderador con nombre. Nunca una
  // segunda clave compartida.
  if (!sameSecret(given, secret) && !moderador) return 'mismatch';
  return 'ok';
}
export function tokenFingerprint(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export async function loginAdmin(token: string) {
  const secret = key(),
    db = getAdminDb();
  const given = token.trim();
  let quota: true | false | 'error' = true;
  if (secret && db) {
    const h = await headers();
    const ip = process.env.VERCEL
      ? h.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'unknown'
      : 'local';
    const hash = createHmac('sha256', secret)
      .update(`${new Date().toISOString().slice(0, 10)}|${ip}`)
      .digest('hex');
    const result = await db.rpc('operation_allowed', {
      p_scope: 'admin-login',
      p_key: hash,
      p_limit: 5,
      p_global: 100,
    });
    quota = result.error ? 'error' : result.data === true;
  }
  // Si no es la clave del propietario, puede ser la de un moderador con nombre.
  let moderador: string | null = null;
  if (secret && db && quota === true && !sameSecret(given, secret) && given.length <= 200) {
    const encontrado = await db.rpc('moderator_for_token', { p_sha: tokenFingerprint(given) });
    moderador = !encontrado.error && typeof encontrado.data === 'string' ? encontrado.data : null;
  }
  const outcome = loginOutcome(given, secret, Boolean(db), quota, moderador);
  if (outcome !== 'ok') {
    // Reason codes only. The clave never reaches a log line.
    console.warn(`admin-login rechazado motivo=${outcome}`);
    return false;
  }
  const actor = Buffer.from(moderador || 'propietario', 'utf8').toString('base64url');
  const payload = `${Date.now() + 7200000}.${randomBytes(16).toString('hex')}.${actor}`;
  (await cookies()).set(cookieName, `${payload}.${sign(payload, secret!)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7200,
  });
  return true;
}
export async function logoutAdmin() {
  (await cookies()).delete(cookieName);
}
