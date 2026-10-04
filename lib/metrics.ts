export const METRICS = [
  'page_view',
  'event_open',
  'filter',
  'share',
  'source',
  'directions',
  'submission_start',
  'submission_complete',
  'report',
  'venue_open',
  'zone_open',
  'live_report',
  'map_open',
  'search',
  'social_click',
  'marker_open',
  'instagram_click',
  'zero_result_search',
  'venue_proposal',
] as const;
export type Metric = (typeof METRICS)[number];
const pendientes = new Set<Metric>();
let escuchando = false;
/**
 * Filtrar, buscar o abrir el mapa son interacciones locales: no deben costar
 * una petición por toque. Se anotan y se mandan una sola vez al salir de la
 * página (o al pasar a segundo plano).
 */
export function trackLater(name: Metric) {
  if (typeof window === 'undefined') return;
  pendientes.add(name);
  if (escuchando) return;
  escuchando = true;
  const enviar = () => {
    if (document.visibilityState !== 'hidden') return;
    for (const n of pendientes) track(n);
    pendientes.clear();
  };
  document.addEventListener('visibilitychange', enviar);
  window.addEventListener('pagehide', () => {
    for (const n of pendientes) track(n);
    pendientes.clear();
  });
}
let busquedaVacia: string | null = null;
let escuchandoVacia = false;
/**
 * Lo que la gente busca y no encuentra es la lista de lo que falta. Se guarda
 * solo la última búsqueda vacía de la visita, agregada por día y sin ninguna
 * identidad; se manda una vez al salir, nunca por tecla.
 */
export function rememberEmptySearch(q: string | null) {
  if (typeof window === 'undefined') return;
  const t = q?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
  busquedaVacia = t.length >= 2 && t.length <= 60 && !/@|\d{6,}|https?:|www\./.test(t) ? t : null;
  if (escuchandoVacia) return;
  escuchandoVacia = true;
  const enviar = () => {
    if (!busquedaVacia) return;
    track('zero_result_search', busquedaVacia);
    busquedaVacia = null;
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && enviar());
  window.addEventListener('pagehide', enviar);
}
export function track(name: Metric, q?: string) {
  if (
    typeof navigator === 'undefined' ||
    navigator.doNotTrack === '1' ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
  )
    return;
  try {
    navigator.sendBeacon(
      '/api/medir',
      new Blob([JSON.stringify(q ? { name, q } : { name })], { type: 'application/json' }),
    );
  } catch {
    /* Metrics never interrupt a journey. */
  }
}
