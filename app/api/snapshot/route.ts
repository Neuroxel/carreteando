import { getPublicSnapshot } from '../../../lib/snapshot';
export const revalidate = 300;
/**
 * El snapshot público para el teléfono. Lo sirve la CDN de Vercel: una
 * respuesta cacheada no toca ni la función ni la base. Con If-None-Match y la
 * misma versión, responde 304 sin cuerpo.
 */
export async function GET(request: Request) {
  const snap = await getPublicSnapshot();
  const etag = `"${snap.version}"`;
  const headers = {
    ETag: etag,
    'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(JSON.stringify(snap), { headers });
}
