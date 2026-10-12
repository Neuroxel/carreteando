/**
 * Elegir cuánta profundidad se puede permitir este equipo. Nunca una sola
 * propiedad: varias señales, y las que no existen no rompen nada. Después, la
 * escena mide su propio tiempo por cuadro y baja de perfil si hace falta.
 */
export type Perfil = 'FULL' | 'LITE' | 'STATIC';
export const AJUSTE = 'ds-profundidad'; // 'auto' | 'off'

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

/**
 * WebGL con GPU real. Un renderizador por software (SwiftShader, llvmpipe) no
 * cuenta: ahí cada cuadro cuesta cientos de ms en el hilo principal y el
 * afiche estático es mejor experiencia.
 */
export function webglDisponible() {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const nombre = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|software|softpipe/i.test(nombre);
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
  // QA: ?perfil=static|lite|full fija el perfil (nunca salta las comprobaciones de arriba).
  const forzado = new URLSearchParams(location.search).get('perfil')?.toUpperCase();
  if (forzado === 'STATIC' || forzado === 'LITE' || forzado === 'FULL') return forzado;
  // Las señales de hardware solo eligen entre FULL y LITE: nunca apagan la
  // profundidad por adivinanza. Lo que decide de verdad es el tiempo por cuadro
  // medido en la escena (UMBRAL), que baja de perfil si hace falta.
  const memoria = nav.deviceMemory ?? 8;
  const nucleos = nav.hardwareConcurrency ?? 8;
  const pixeles = window.innerWidth * window.innerHeight * Math.min(window.devicePixelRatio || 1, 3) ** 2;
  if (memoria < 4 || nucleos < 4 || pixeles > 9_000_000) return 'LITE';
  return 'FULL';
}

/** Umbrales de auto-degradación (mediana de tiempo por cuadro, en ms, durante la calibración). */
export const UMBRAL = { FULL_A_LITE: 22, LITE_A_STATIC: 40 } as const;
/** Límites de resolución interna del lienzo (el DOM sigue a resolución nativa). */
export const RESOLUCION = {
  FULL: { dpr: 1.5, pixeles: 1_600_000 },
  LITE: { dpr: 1, pixeles: 800_000 },
} as const;

/** Motivo por el que el perfil es STATIC (para el panel de depuración). */
export function motivoEstatico(): string | null {
  if (typeof window === 'undefined') return 'servidor';
  if (leer(AJUSTE) === 'off') return 'profundidad apagada por el usuario';
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'movimiento reducido del sistema';
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return 'ahorro de datos';
  if (!webglDisponible()) return 'sin WebGL con GPU';
  return null;
}

/** QA: ?3ddebug=1 muestra el panel de sensor y permite simular la inclinación. */
export function depuracion() {
  return typeof window !== 'undefined' && new URLSearchParams(location.search).get('3ddebug') === '1';
}
