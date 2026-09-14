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
] as const;
export type Metric = (typeof METRICS)[number];
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
