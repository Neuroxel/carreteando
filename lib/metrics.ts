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
export function track(name: Metric) {
  if (
    typeof navigator === 'undefined' ||
    navigator.doNotTrack === '1' ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
  )
    return;
  try {
    navigator.sendBeacon(
      '/api/medir',
      new Blob([JSON.stringify({ name })], { type: 'application/json' }),
    );
  } catch {
    /* Metrics never interrupt a journey. */
  }
}
