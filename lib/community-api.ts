import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAdminDb } from './server-db';
import {
  submissionIdentity,
  validateReport,
  validateSubmission,
  ValidationError,
} from './submission-validation';
const json = (body: object, status: number) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '3600' } : {}) },
  });
export async function receiveCommunity(request: Request, kind: 'submission' | 'report') {
  if (
    request.headers.get('origin') &&
    request.headers.get('origin') !== new URL(request.url).origin
  )
    return json({ error: 'Origen no permitido.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: 'Usa JSON.' }, 415);
  const db = getAdminDb(),
    salt = process.env.CRON_SECRET;
  if (!db || !salt)
    return json({ error: 'No podemos recibir solicitudes ahora. Intenta más tarde.' }, 503);
  try {
    // Bound the streamed body too, not just the user-controlled Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Solicitud vacía.' }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16384) {
        await reader.cancel();
        return json({ error: 'La solicitud es demasiado larga.' }, 413);
      }
      chunks.push(value);
    }
    const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const payload = kind === 'submission' ? validateSubmission(raw) : validateReport(raw);
    const fingerprint = createHash('sha256')
      .update(
        kind +
          '|' +
          (kind === 'submission'
            ? submissionIdentity(payload as ReturnType<typeof validateSubmission>)
            : JSON.stringify(payload)),
      )
      .digest('hex');
    // Vercel overwrites x-vercel-forwarded-for. Never trust caller x-forwarded-for.
    const ip = process.env.VERCEL
      ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim()
      : 'local';
    const requestHash = createHmac('sha256', salt)
      .update(`${new Date().toISOString().slice(0, 10)}|${ip || 'unknown'}`)
      .digest('hex');
    const { data, error } = await db.rpc('receive_community_item', {
      p_kind: kind,
      p_payload: payload,
      p_fingerprint: fingerprint,
      p_request_hash: requestHash,
    });
    if (error) return json({ error: 'No se pudo guardar. Intenta más tarde.' }, 503);
    if (data === 'rate_limited')
      return json({ error: 'Alcanzaste el límite de envíos. Intenta más tarde.' }, 429);
    if (!['received', 'duplicate'].includes(data))
      return json({ error: 'No se pudo confirmar la recepción.' }, 503);
    return json(
      {
        success: true,
        status: 'pending',
        message:
          kind === 'submission'
            ? 'Recibimos tu evento. Lo revisaremos antes de publicarlo.'
            : 'Recibimos tu reporte para revisión.',
      },
      202,
    );
  } catch (error) {
    return json(
      { error: error instanceof ValidationError ? error.message : 'Solicitud inválida.' },
      400,
    );
  }
}
