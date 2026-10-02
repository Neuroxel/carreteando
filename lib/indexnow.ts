import { SITE_URL } from './site';
/**
 * IndexNow avisa a Bing (y a otros buscadores que lo comparten) que una URL es
 * nueva. La clave no es un secreto: el protocolo exige publicarla en el propio
 * sitio para demostrar que el aviso viene del dueño del dominio.
 * Google no usa IndexNow; para Google bastan el sitemap y Search Console.
 */
export const INDEXNOW_KEY = 'd2eb0788d0339985b31b80605fad90ec';
export const INDEXNOW_KEY_PATH = '/indexnow-key.txt';
export function indexNowPayload(paths: string[]) {
  const host = new URL(SITE_URL).host;
  const urlList = [...new Set(paths)].slice(0, 100).map((p) => `${SITE_URL}${p}`);
  return { host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}${INDEXNOW_KEY_PATH}`, urlList };
}
/** Nunca rompe la ingesta: si el aviso falla, el sitemap lo cubre igual. */
export async function notifyIndexNow(paths: string[], doFetch: typeof fetch = fetch) {
  if (!paths.length) return { sent: 0, status: null as number | null };
  try {
    const response = await doFetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(indexNowPayload(paths)),
      signal: AbortSignal.timeout(8000),
    });
    return { sent: Math.min(paths.length, 100), status: response.status };
  } catch {
    return { sent: 0, status: null };
  }
}
