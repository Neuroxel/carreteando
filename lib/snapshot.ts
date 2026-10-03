import 'server-only';
import { unstable_cache } from 'next/cache';
import { readEvents } from './server-events';
import { getPublicVenues } from './server-venues';
import { getSourceFreshness } from './server-freshness';
import type { Freshness } from './freshness';
import type { Evento } from './types';
import type { Lugar } from './venues';

/**
 * Todo lo que la portada y Explorar necesitan, en un solo objeto público.
 * Se arma en el servidor como mucho cada 5 minutos (o al instante cuando la
 * ingesta o la moderación cambian algo) y el teléfono filtra, busca y pinta
 * el mapa con él sin volver a preguntarle nada al servidor.
 *
 * Solo campos públicos: Evento y Lugar ya son las formas que se muestran en
 * la web. Nada de moderación, auditoría, aportes privados ni texto crudo.
 */
export interface PublicSnapshot {
  version: string;
  generatedAt: string;
  freshness: Freshness;
  status: 'ok' | 'error';
  events: Evento[];
  venues: Lugar[];
}
/** Versión estable del contenido: si no cambió nada, el teléfono no baja nada. */
export function versionOf(value: unknown) {
  const text = JSON.stringify(value);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
async function leer() {
  const [events, venues, freshness] = await Promise.all([readEvents(), getPublicVenues(), getSourceFreshness()]);
  return { events, venues, freshness, ok: events.status === 'ok' && venues.status === 'ok' };
}
async function build(): Promise<PublicSnapshot> {
  let r = await leer();
  if (!r.ok) {
    await new Promise((res) => setTimeout(res, 1000));
    r = await leer();
  }
  // Si la base falla dos veces, no se guarda un snapshot de error: se lanza,
  // la caché no lo retiene y Next sigue sirviendo la última página buena.
  // Sin base configurada (CI) se devuelve el estado de error y listo.
  if (!r.ok && process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('SNAPSHOT_BACKEND_UNAVAILABLE');
  const { events, venues, freshness } = r;
  const status = r.ok ? 'ok' : 'error';
  const contenido = { events: events.events, venues: venues.lugares };
  return {
    version: versionOf(contenido),
    generatedAt: new Date().toISOString(),
    freshness,
    status,
    ...contenido,
  };
}
export const SNAPSHOT_TAG = 'public-snapshot';
export const getPublicSnapshot = unstable_cache(build, ['public-snapshot-v1'], {
  revalidate: 300,
  tags: [SNAPSHOT_TAG],
});
/** Pide regenerar lo público. Nunca rompe a quien lo llama (fuera de Next, o si falla, no pasa nada). */
export async function refrescarPublico(tag: string = SNAPSHOT_TAG) {
  try {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tag);
    return true;
  } catch {
    return false;
  }
}
