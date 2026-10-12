/**
 * Elegir cuánta profundidad se puede permitir este equipo. Nunca una sola
 * propiedad: varias señales, y las que no existen no rompen nada. Después, la
 * escena mide su propio tiempo por cuadro y baja de perfil si hace falta.
 */
export type Perfil = 'FULL' | 'LITE' | 'STATIC';
export const AJUSTE = 'ds-profundidad'; // 'auto' | 'off'
export const SENSOR = 'ds-sensor'; // 'granted' | 'denied'

export function leer(clave: string) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}
export function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* sin almacenamiento: se decide de nuevo en la próxima visita */
  }
}

export function webglDisponible() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function elegirPerfil(): Perfil {
  if (typeof window === 'undefined') return 'STATIC';
  if (leer(AJUSTE) === 'off') return 'STATIC';
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'STATIC';
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return 'STATIC';
  if (!webglDisponible()) return 'STATIC';
  const memoria = nav.deviceMemory ?? 8;
  const nucleos = nav.hardwareConcurrency ?? 8;
  if (memoria <= 2 || nucleos <= 2) return 'STATIC';
  const pixeles = window.innerWidth * window.innerHeight * Math.min(window.devicePixelRatio || 1, 3) ** 2;
  if (memoria <= 4 || nucleos <= 4 || pixeles > 9_000_000) return 'LITE';
  return 'FULL';
}

/** Umbrales de auto-degradación (mediana de tiempo por cuadro, en ms, durante la calibración). */
export const UMBRAL = { FULL_A_LITE: 22, LITE_A_STATIC: 40 } as const;
/** Límites de resolución interna del lienzo (el DOM sigue a resolución nativa). */
export const RESOLUCION = {
  FULL: { dpr: 1.5, pixeles: 1_600_000 },
  LITE: { dpr: 1, pixeles: 800_000 },
} as const;

/** Solo en pantallas táctiles (iOS): ahí el permiso existe y tiene sentido pedirlo. */
export function necesitaPermisoSensor() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(pointer: coarse)').matches) &&
    typeof (window as unknown as { DeviceOrientationEvent?: { requestPermission?: unknown } }).DeviceOrientationEvent
      ?.requestPermission === 'function'
  );
}
