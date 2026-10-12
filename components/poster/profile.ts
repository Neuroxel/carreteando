/**
 * ¿Se permite el movimiento decorativo? Nunca con movimiento reducido ni con
 * ahorro de datos. No hay perfiles ni WebGL: la profundidad es un adorno que
 * solo aparece si llegan muestras reales del sensor.
 */
export function motivoEstatico(): string | null {
  if (typeof window === 'undefined') return 'servidor';
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'movimiento reducido del sistema';
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return 'ahorro de datos';
  return null;
}

export const movimientoPermitido = () => motivoEstatico() === null;

/** QA: ?3ddebug=1 muestra el panel de sensor y permite simular la inclinación. */
export function depuracion() {
  return typeof window !== 'undefined' && new URLSearchParams(location.search).get('3ddebug') === '1';
}
