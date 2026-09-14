import { createHmac } from 'node:crypto';
import { getAdminDb } from '../../../lib/server-db';
import { validLiveReport } from '../../../lib/live-reports';
export async function POST(request: Request) {
  const response = (status: number, body?: unknown) =>
    new Response(body ? JSON.stringify(body) : null, {
      status,
      headers: { 'Cache-Control': 'no-store', 'content-type': 'application/json' },
    });
  if (request.headers.get('origin') !== new URL(request.url).origin) return response(403);
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
      if (size > 512) {
        await reader.cancel();
        return response(413);
      }
      chunks.push(r.value);
    }
    const p = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (
      !p ||
      typeof p !== 'object' ||
      Array.isArray(p) ||
      Object.keys(p).length !== 4 ||
      !['venue', 'event'].includes(p.tipo) ||
      typeof p.id !== 'string' ||
      !/^[a-zA-Z0-9_/-]{1,160}$/.test(p.id) ||
      typeof p.kind !== 'string' ||
      typeof p.valor !== 'string' ||
      !validLiveReport(p.kind, p.valor)
    )
      return response(400);
    const ip = process.env.VERCEL
      ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'unknown'
      : 'local';
    // Rotating daily hash: enough to stop one device flooding, never an identity.
    const hash = createHmac('sha256', salt)
      .update(`live|${new Date().toISOString().slice(0, 10)}|${ip}`)
      .digest('hex');
    const quota = await db.rpc('operation_allowed', {
      p_scope: 'live-report',
      p_key: hash,
      p_limit: 12,
      p_global: 3000,
    });
    if (quota.error) return response(503);
    if (quota.data !== true) return response(429, { status: 'rate_limited' });
    const saved = await db.rpc('add_live_report', {
      p_target_type: p.tipo,
      p_target_id: p.id,
      p_kind: p.kind,
      p_value: p.valor,
      p_hash: hash,
    });
    if (saved.error) return response(503);
    return response(200, { status: saved.data });
  } catch {
    return response(400);
  }
}
