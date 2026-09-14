import { createHmac } from 'node:crypto';
import { getAdminDb } from '../../../lib/server-db';
import { METRICS } from '../../../lib/metrics';
export async function POST(request: Request) {
  const response = (status: number) =>
    new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.headers.get('origin') !== new URL(request.url).origin) return response(403);
  if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1')
    return response(204);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return response(415);
  const db = getAdminDb(),
    salt = process.env.CRON_SECRET;
  if (!db || !salt) return response(503);
  try {
    const reader = request.body?.getReader();
    if (!reader) return response(400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > 256) {
        await reader.cancel();
        return response(413);
      }
      chunks.push(r.value);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (
      !payload ||
      Array.isArray(payload) ||
      Object.keys(payload).length !== 1 ||
      !METRICS.includes(payload.name)
    )
      return response(400);
    const ip = process.env.VERCEL
      ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'unknown'
      : 'local';
    const hash = createHmac('sha256', salt)
      .update(`metric|${new Date().toISOString().slice(0, 10)}|${ip}`)
      .digest('hex');
    const quota = await db.rpc('operation_allowed', {
      p_scope: 'metrics',
      p_key: hash,
      p_limit: 60,
      p_global: 5000,
    });
    if (quota.error) return response(503);
    if (quota.data !== true) return response(429);
    const saved = await db.rpc('count_metric', { p_name: payload.name });
    return response(saved.error ? 503 : 204);
  } catch {
    return response(400);
  }
}
