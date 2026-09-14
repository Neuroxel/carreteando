import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { getAdminDb } from './server-db';
const cookieName =
  process.env.NODE_ENV === 'production' ? '__Host-carreteando-admin' : 'carreteando-admin';
function key() {
  const value = process.env.ADMIN_ACCESS_TOKEN;
  return value && value.length >= 43 ? value : null;
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
export async function loginAdmin(token: string) {
  const secret = key(),
    db = getAdminDb();
  if (!secret || !db) return false;
  const h = await headers();
  const ip = process.env.VERCEL
    ? h.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'unknown'
    : 'local';
  const hash = createHmac('sha256', secret)
    .update(`${new Date().toISOString().slice(0, 10)}|${ip}`)
    .digest('hex');
  const quota = await db.rpc('operation_allowed', {
    p_scope: 'admin-login',
    p_key: hash,
    p_limit: 5,
    p_global: 100,
  });
  if (quota.error || quota.data !== true || token.length > 200 || !sameSecret(token, secret))
    return false;
  const payload = `${Date.now() + 7200000}.${randomBytes(16).toString('hex')}`;
  (await cookies()).set(cookieName, `${payload}.${sign(payload, secret)}`, {
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
