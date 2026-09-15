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
export function validSession(value: string | undefined, secret: string | null, now = Date.now()) {
  if (!secret || !value || value.length > 200) return false;
  const [expires, nonce, signature, extra] = value.split('.');
  if (extra || !signature || !/^\d{13}$/.test(expires) || !/^[a-f0-9]{32}$/.test(nonce))
    return false;
  const remaining = Number(expires) - now;
  return (
    remaining > 0 &&
    remaining <= 7200000 &&
    sameSecret(signature, sign(`${expires}.${nonce}`, secret))
  );
}
export async function isAdmin() {
  return validSession((await cookies()).get(cookieName)?.value, key());
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
): LoginOutcome {
  if (!secret) return 'no-secret';
  if (!hasDb) return 'no-db';
  if (quota === 'error') return 'db-error';
  if (quota === false) return 'rate-limited';
  if (given.length > 200 || !sameSecret(given, secret)) return 'mismatch';
  return 'ok';
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
  const outcome = loginOutcome(given, secret, Boolean(db), quota);
  if (outcome !== 'ok') {
    // Reason codes only. The clave never reaches a log line.
    console.warn(`admin-login rechazado motivo=${outcome}`);
    return false;
  }
  const payload = `${Date.now() + 7200000}.${randomBytes(16).toString('hex')}`;
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
