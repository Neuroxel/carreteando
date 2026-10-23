/**
 * Cuánto efecto aguanta el dispositivo. La funcionalidad es la misma en los
 * tres niveles; solo cambia el espectáculo:
 *  - baja: sin luces, sin cantos, giro simple (movimiento reducido, ahorro de
 *    datos, ≤2 núcleos o ≤2 GB);
 *  - media: luces quietas, cantos cortos, inclinación de la carta;
 *  - alta: rayos animados, cantos largos, cada afiche se inclina, giroscopio.
 * Después, una medición real de cuadros puede BAJAR el nivel (nunca subirlo).
 */
export type Nivel = 'baja' | 'media' | 'alta';
export function nivelInicial(d: { nucleos?: number; memoriaGb?: number; ahorroDatos?: boolean; movimientoReducido?: boolean }): Nivel {
  if (d.movimientoReducido || d.ahorroDatos) return 'baja';
  const n = d.nucleos ?? 4;
  const m = d.memoriaGb ?? 4;
  if (n <= 2 || m <= 2) return 'baja';
  if (n <= 4 || m <= 4) return 'media';
  return 'alta';
}
/** Con el tiempo medio por cuadro (ms): si va lento, se baja un nivel; muy lento, a baja. */
export function ajustarPorCuadros(nivel: Nivel, msPorCuadro: number | null): Nivel {
  if (msPorCuadro === null || !Number.isFinite(msPorCuadro)) return nivel;
  if (msPorCuadro > 40) return 'baja';
  if (msPorCuadro > 22) return nivel === 'alta' ? 'media' : nivel === 'media' ? 'baja' : 'baja';
  return nivel;
}
export function leerDispositivo(): Parameters<typeof nivelInicial>[0] {
  if (typeof window === 'undefined') return { movimientoReducido: true };
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    nucleos: nav.hardwareConcurrency,
    memoriaGb: nav.deviceMemory,
    ahorroDatos: Boolean(nav.connection?.saveData),
    movimientoReducido: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  };
}
/** Mide ~20 cuadros; si no llegan en 1,2 s (pestaña congelada), no opina (null). */
export function medirCuadros(cuadros = 20, plazo = 1200): Promise<number | null> {
  return new Promise((resolver) => {
    if (typeof requestAnimationFrame === 'undefined') return resolver(null);
    let n = 0;
    let inicio = 0;
    const corte = setTimeout(() => resolver(null), plazo);
    const paso = (t: number) => {
      if (!inicio) inicio = t;
      if (++n >= cuadros) {
        clearTimeout(corte);
        return resolver((t - inicio) / (cuadros - 1));
      }
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
}
